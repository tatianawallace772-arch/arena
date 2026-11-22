'use strict';
/* Verifies the 'ask' approval mode: risky tools pause, and a denial is
   fed back to the model instead of being executed. */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const APP = process.env.APP_URL || 'http://127.0.0.1:3001';
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const results = [];
  const check = (name, cond, extra = '') => results.push({ name, ok: !!cond, extra });

  const events = [];
  let approvalSeen = null;

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`${APP.replace('http', 'ws')}/ws/agent?session=approval-${Date.now()}`);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('approval test timed out'));
    }, 45000);

    socket.on('open', () => {
      socket.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ready') {
          socket.send(
            JSON.stringify({
              type: 'chat',
              message: 'Make the summary file',
              approvalMode: 'ask',
            })
          );
        } else if (msg.type === 'agent_event') {
          events.push(msg.event);
          if (msg.event.type === 'approval_request') {
            if (!approvalSeen) approvalSeen = msg.event;
            // Deny the write, approve everything else. Every request must be
            // answered, otherwise the agent waits forever.
            const approve = msg.event.tool !== 'write_file';
            socket.send(
              JSON.stringify({ type: 'approval', approvalId: msg.event.approvalId, approved: approve })
            );
          }
          if (msg.event.type === 'turn_end') {
            clearTimeout(timer);
            setTimeout(() => socket.close(), 100);
            resolve();
          }
        }
      });
    });
    socket.on('error', reject);
  });

  const approvalRequests = events.filter((e) => e.type === 'approval_request');
  const approvalResolved = events.filter((e) => e.type === 'approval_resolved');
  const writeResult = events.find((e) => e.type === 'tool_result' && e.tool === 'write_file');

  check('turn_started', events.some((e) => e.type === 'turn_start'));
  check('approval was requested for risky tools', approvalRequests.length > 0,
    `requests=${approvalRequests.length}`);
  check('approval request names the tool', !!approvalSeen && !!approvalSeen.tool);
  check('approval resolution was reported', approvalResolved.length > 0);
  check('denied write_file was not executed successfully',
    writeResult && writeResult.ok === false, JSON.stringify(writeResult));
  check('denial message explains the refusal',
    writeResult && /denied permission/i.test(writeResult.output || ''),
    writeResult ? String(writeResult.output).slice(0, 160) : 'missing');
  check('the denied file does not exist on disk',
    !fs.existsSync(path.join(ROOT, 'sandbox-summary.md')));

  let failed = 0;
  console.log('\nApproval gate ("ask" mode)\n');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n      ${r.extra}`}`);
    if (!r.ok) failed++;
  }
  console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('approval harness error:', err.message);
  process.exit(1);
});
