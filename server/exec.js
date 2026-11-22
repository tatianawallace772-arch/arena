'use strict';

const { spawn } = require('child_process');
const config = require('./config');

/**
 * Run a one-shot shell command in the workspace, capturing output.
 * Used by the agent's `run_command` tool. Never rejects on non-zero exit —
 * the exit code is part of the result so the model can reason about it.
 */
function runCommand(command, { cwd = config.workspaceRoot, timeoutMs = config.limits.commandTimeoutMs } = {}) {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : '/bin/bash';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;

    const child = spawn(shell, args, {
      cwd,
      env: { ...process.env, TERM: 'dumb', CI: '1', GIT_PAGER: 'cat', PAGER: 'cat' },
      detached: process.platform !== 'win32',
    });

    const cap = config.limits.maxTerminalOutput;
    const append = (cur, chunk) => (cur + chunk).slice(-cap);

    child.stdout.on('data', (d) => {
      stdout = append(stdout, d.toString());
    });
    child.stderr.on('data', (d) => {
      stderr = append(stderr, d.toString());
    });

    const timer = setTimeout(() => {
      timedOut = true;
      if (!killed) {
        killed = true;
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        command,
        exitCode: -1,
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${err.message}`,
        timedOut,
      });
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        command,
        exitCode: code == null ? -1 : code,
        signal: signal || null,
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        timedOut,
      });
    });
  });
}

module.exports = { runCommand };
