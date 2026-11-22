'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const inception = require('./inception');
const tools = require('./tools');
const config = require('./config');
const ws = require('./workspace');

function buildSystemPrompt() {
  return `You are Arena Code Agent, an autonomous pair-programmer running inside a real Linux sandbox.
The user's filesystem is mounted at ${ws.ROOT}; all paths you use are relative to that root.

# Your job
Complete the user's coding task end to end by taking real actions with your tools. Do not just describe what should be done — do it. Then verify it.

# How to work
1. Explore before editing. Use list_dir, find_files and search to learn the project, and read_file to see exact code.
2. Make focused edits. Use edit_file with enough surrounding context to be unambiguous. Use write_file only for new files or full rewrites.
3. Verify your work. Run the project's tests, type checker, linter or a quick script with run_command. Fix what you broke.
4. Use git when it helps: git_status, git_diff, git_stage, git_commit.
5. When finished or genuinely blocked, call finish with a short summary.

# Rules
- Never invent file contents. If you need to know what a file says, read it.
- Paths are relative to the workspace root and cannot escape it. Paths must be relative, e.g. "server/index.js" — never start with "/".
- Do not run destructive commands (rm -rf /, mkfs, dd to a device) or exfiltrate secrets.
- Do not print API keys or tokens into files or command output.
- Prefer non-interactive commands (e.g. \`npm install --yes\`, \`git commit -m\`). Commands are killed after ${Math.round(
    config.limits.commandTimeoutMs / 1000
  )}s by default.
- Keep replies short. Your visible text goes to a chat UI; put detail in the tools, not in prose.
- If a tool returns an error, read it carefully and adjust instead of repeating the same call.
- Write code that matches the existing style of the project.`;
}

class AgentSession extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} [opts.id]
   * @param {string} [opts.model]
   * @param {'ask'|'auto'} [opts.approvalMode]  'ask' = pause before risky tools
   */
  constructor({ id, model, approvalMode = 'auto' } = {}) {
    super();
    this.id = id || crypto.randomUUID();
    this.model = model || config.inception.model;
    this.approvalMode = approvalMode;
    this.messages = [{ role: 'system', content: buildSystemPrompt() }];
    this.running = false;
    this.abortController = null;
    this.pendingApprovals = new Map();
    this.createdAt = Date.now();
    this.lastUsage = null;
  }

  emitEvent(type, payload = {}) {
    this.emit('event', { type, ...payload });
  }

  /** Reset conversation but keep settings. */
  reset() {
    this.messages = [{ role: 'system', content: buildSystemPrompt() }];
    this.emitEvent('reset');
  }

  /** Compact old turns so very long sessions stay inside the context window. */
  trimHistory(maxMessages = 60) {
    if (this.messages.length <= maxMessages) return;
    const [system, ...rest] = this.messages;
    // Keep the first user turn for goal context, drop the middle.
    const kept = rest.slice(-(maxMessages - 2));
    this.messages = [
      system,
      {
        role: 'user',
        content: '[Earlier conversation trimmed to save context. Continue the current task.]',
      },
      ...kept,
    ];
  }

  abort() {
    if (this.abortController) this.abortController.abort();
    // Release any pending approvals as denied.
    for (const [, pending] of this.pendingApprovals) {
      pending.resolve({ approved: false, reason: 'Run aborted' });
    }
    this.pendingApprovals.clear();
  }

  /** Called by the server when the user clicks approve/deny. */
  resolveApproval(approvalId, decision) {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) return false;
    this.pendingApprovals.delete(approvalId);
    pending.resolve(decision);
    return true;
  }

  async requestApproval({ tool, args, callId }) {
    if (this.approvalMode !== 'ask' || !tools.RISKY.has(tool)) {
      return { approved: true };
    }
    const approvalId = crypto.randomUUID();
    const decision = new Promise((resolve) => {
      this.pendingApprovals.set(approvalId, { resolve, tool, args });
    });
    this.emitEvent('approval_request', { approvalId, tool, args, callId });
    const result = await decision;
    this.emitEvent('approval_resolved', { approvalId, approved: !!result.approved, tool });
    return result;
  }

  /**
   * Run the agent loop for one user turn.
   * Emits 'event' with: turn_start, text_delta, thinking, tool_call, tool_result,
   * approval_request, approval_resolved, usage, error, turn_end.
   */
  async run(userMessage) {
    if (this.running) throw new Error('Agent is already running');
    this.running = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const turnStart = Date.now();
    let step = 0;
    let finished = false;

    try {
      if (userMessage && userMessage.trim()) {
        this.messages.push({ role: 'user', content: userMessage.trim() });
      }
      this.trimHistory();
      this.emitEvent('turn_start', { model: this.model, step });

      for (step = 0; step < config.limits.maxSteps && !finished; step++) {
        if (signal.aborted) {
          this.emitEvent('turn_end', { aborted: true, steps: step, durationMs: Date.now() - turnStart });
          return;
        }

        const assistantText = [];
        let toolCalls = [];

        const stream = inception.chatStream({
          messages: this.messages,
          tools: tools.TOOLS,
          model: this.model,
          signal,
        });

        for await (const evt of stream) {
          if (signal.aborted) break;
          if (evt.type === 'text') {
            assistantText.push(evt.text);
            this.emitEvent('text_delta', { text: evt.text, step });
          } else if (evt.type === 'tool_call_delta') {
            if (evt.name) this.emitEvent('thinking', { text: `Preparing ${evt.name}…`, step });
          } else if (evt.type === 'usage') {
            this.lastUsage = evt.usage;
            this.emitEvent('usage', { usage: evt.usage });
          } else if (evt.type === 'tool_calls') {
            toolCalls = evt.toolCalls;
          }
        }

        if (signal.aborted) {
          this.emitEvent('turn_end', { aborted: true, steps: step, durationMs: Date.now() - turnStart });
          return;
        }

        const text = assistantText.join('');

        // Record the assistant message (text and/or tool calls).
        const assistantMessage = { role: 'assistant', content: text || null };
        if (toolCalls.length) {
          assistantMessage.tool_calls = toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          }));
        }
        this.messages.push(assistantMessage);

        if (!toolCalls.length) {
          // Plain answer, no actions requested — the turn is done.
          this.emitEvent('text_done', { step });
          finished = true;
          break;
        }

        // Execute each requested tool, feeding results back to the model.
        for (const call of toolCalls) {
          if (signal.aborted) break;
          let parsedArgs = {};
          try {
            parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
          } catch {
            parsedArgs = null;
          }

          this.emitEvent('tool_call', {
            callId: call.id,
            tool: call.name,
            args: parsedArgs ?? call.arguments,
            step,
          });

          let result;
          if (parsedArgs === null) {
            result = { ok: false, output: `Could not parse arguments as JSON: ${call.arguments}` };
          } else {
            const approval = await this.requestApproval({
              tool: call.name,
              args: parsedArgs,
              callId: call.id,
            });
            if (!approval.approved) {
              result = {
                ok: false,
                output: `The user denied permission to run ${call.name}. ${
                  approval.reason || 'Adjust your approach or ask the user how to proceed.'
                }`,
              };
            } else {
              result = await tools.execute(call.name, parsedArgs);
            }
          }

          this.emitEvent('tool_result', {
            callId: call.id,
            tool: call.name,
            ok: result.ok !== false,
            output: tools.clip(result.output ?? '', 6000),
            changed: !!result.changed,
            step,
          });

          // Feed the tool result back.
          this.messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content: tools.clip(typeof result.output === 'string' ? result.output : JSON.stringify(result), 16_000),
          });

          if (result.finish) {
            finished = true;
            this.emitEvent('finish', { summary: result.summary, status: result.status });
            break;
          }
        }
      }

      if (!finished && step >= config.limits.maxSteps) {
        this.emitEvent('error', {
          message: `Stopped after ${config.limits.maxSteps} steps. Send another message to continue.`,
        });
      }

      this.emitEvent('turn_end', { steps: step, durationMs: Date.now() - turnStart });
    } catch (err) {
      if (err.name === 'AbortError') {
        this.emitEvent('turn_end', { aborted: true, steps: step, durationMs: Date.now() - turnStart });
      } else {
        const message =
          err.name === 'InceptionError'
            ? err.status === 401
              ? 'Inception Labs rejected the API key (401). Check INCEPTION_API_KEY in .env.'
              : `${err.message}${err.body ? ` — ${String(err.body).slice(0, 300)}` : ''}`
            : err.message;
        this.emitEvent('error', { message });
        this.emitEvent('turn_end', { error: true, steps: step, durationMs: Date.now() - turnStart });
      }
    } finally {
      this.running = false;
      this.abortController = null;
    }
  }

  /** Serialize for persistence in the UI. */
  toJSON() {
    return {
      id: this.id,
      model: this.model,
      approvalMode: this.approvalMode,
      createdAt: this.createdAt,
      messages: this.messages.filter((m) => m.role !== 'system'),
    };
  }
}

module.exports = { AgentSession, buildSystemPrompt };
