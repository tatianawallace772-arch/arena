'use strict';
/* Integration smoke test for the Arena Code Agent backend. Run: node test/smoke.js */

const WebSocket = require('ws');
const assert = require('assert');

let pass = 0;
let fail = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, err });
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

function wsTerminal() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:3000/ws/terminal?cols=100&rows=30');
    let output = '';
    const timer = setTimeout(() => reject(new Error(`terminal timeout. got: ${JSON.stringify(output.slice(-400))}`)), 12000);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'start', cols: 100, rows: 30 })));
    socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'started') {
        socket.send(JSON.stringify({ type: 'input', data: 'echo TERM_MARKER_$((6*7)); uname -s; pwd\n' }));
      } else if (msg.type === 'data') {
        output += msg.data;
        if (output.includes('TERM_MARKER_42') && output.includes('/home/user/arena')) {
          clearTimeout(timer);
          socket.close();
          resolve(output);
        }
      }
    });
    socket.on('error', reject);
  });
}

(async () => {
  console.log('\nArena Code Agent — smoke tests\n');

  const base = 'http://127.0.0.1:3000';

  await test('health endpoint reports workspace + model', async () => {
    const res = await fetch(`${base}/api/health`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.ok(json.workspace.length > 0);
    assert.ok(json.model);
  });

  await test('file listing returns the project tree', async () => {
    const res = await fetch(`${base}/api/files?depth=2`);
    const json = await res.json();
    assert.ok(json.entries.length > 5);
    assert.ok(json.entries.some((e) => e.path === 'server/index.js'));
  });

  await test('read file returns content and language', async () => {
    const res = await fetch(`${base}/api/file?path=server/config.js`);
    const json = await res.json();
    assert.ok(json.content.includes('INCEPTION_API_KEY') || json.content.includes('config'));
    assert.equal(json.language, 'javascript');
  });

  await test('write then read round-trips', async () => {
    const content = 'hello from the smoke test\n';
    const put = await fetch(`${base}/api/file`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'test/tmp-roundtrip.txt', content }),
    });
    assert.ok(put.ok);
    const res = await fetch(`${base}/api/file?path=test/tmp-roundtrip.txt`);
    const json = await res.json();
    assert.equal(json.content, content);
  });

  await test('path traversal is blocked', async () => {
    const res = await fetch(`${base}/api/file?path=../../etc/passwd`);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(/escapes the workspace/.test(json.error));
  });

  await test('symlink escape is blocked', async () => {
    const fs = require('fs');
    const { execSync } = require('child_process');
    fs.mkdirSync('test/.tmp', { recursive: true });
    try {
      fs.symlinkSync('/etc/hostname', 'test/.tmp/escape-link');
    } catch {
      /* may already exist */
    }
    const res = await fetch(`${base}/api/file?path=test/.tmp/escape-link`);
    const json = await res.json();
    assert.ok(/escapes the workspace/.test(json.error || ''), `expected block, got: ${JSON.stringify(json).slice(0, 200)}`);
  });

  await test('delete removes the file', async () => {
    const res = await fetch(`${base}/api/file?path=test/tmp-roundtrip.txt`, { method: 'DELETE' });
    assert.ok(res.ok);
    const check = await fetch(`${base}/api/file?path=test/tmp-roundtrip.txt`);
    assert.equal(check.status, 404);
  });

  await test('search finds text across files', async () => {
    const res = await fetch(`${base}/api/search?q=AgentSession`);
    const json = await res.json();
    assert.ok(json.hits.length > 0);
    assert.ok(json.hits.some((h) => h.path.includes('agent.js')));
  });

  await test('git status reports the branch', async () => {
    const res = await fetch(`${base}/api/git/status`);
    const json = await res.json();
    assert.equal(json.isRepo, true);
    assert.ok(json.branch.length > 0);
  });

  await test('git log returns commits', async () => {
    const res = await fetch(`${base}/api/git/log?limit=5`);
    const json = await res.json();
    assert.ok(Array.isArray(json.commits));
    assert.ok(json.commits.length >= 1);
  });

  await test('terminal runs a real command in a PTY', async () => {
    const output = await wsTerminal();
    assert.ok(output.includes('TERM_MARKER_42'), 'echo worked');
    assert.ok(output.includes('Linux'), 'uname ran');
    assert.ok(output.includes('/home/user/arena'), 'pwd is workspace');
  });

  await test('agent websocket connects and reports ready', async () => {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket('ws://127.0.0.1:3000/ws/agent?session=test-session');
      const timer = setTimeout(() => reject(new Error('no ready message')), 8000);
      socket.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ready') {
          clearTimeout(timer);
          assert.ok(msg.workspace);
          socket.close();
          resolve();
        }
      });
      socket.on('error', reject);
    });
  });

  await test('agent websocket surfaces an error for a bad API host', async () => {
    // The sandbox cannot reach api.inceptionlabs.ai, so a chat turn must
    // fail gracefully with an error event rather than hang or crash the server.
    const events = [];
    await new Promise((resolve) => {
      const socket = new WebSocket('ws://127.0.0.1:3000/ws/agent?session=test-error');
      const timer = setTimeout(() => {
        socket.close();
        resolve();
      }, 15000);
      socket.on('open', () => {
        socket.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'agent_event') {
            events.push(msg.event);
            if (msg.event.type === 'turn_end') {
              clearTimeout(timer);
              socket.close();
              resolve();
            }
          }
        });
        socket.send(JSON.stringify({ type: 'chat', message: 'say hi' }));
      });
    });
    const types = events.map((e) => e.type);
    assert.ok(types.includes('turn_start'), `turn_start seen: ${types.join(',')}`);
    assert.ok(types.includes('turn_end'), 'turn_end seen (did not hang)');
    assert.ok(
      types.includes('error') || types.includes('text_delta'),
      'either an error or a response was produced'
    );
  });

  await test('tool layer edits a file correctly', async () => {
    const tools = require('../server/tools');
    await tools.execute('create_file', { path: 'test/.tmp/edit-me.txt', content: 'alpha beta gamma' });
    const edit = await tools.execute('edit_file', {
      path: 'test/.tmp/edit-me.txt',
      old_text: 'beta',
      new_text: 'BETA',
    });
    assert.ok(edit.ok, edit.output);
    const read = await tools.execute('read_file', { path: 'test/.tmp/edit-me.txt' });
    assert.ok(read.output.includes('alpha BETA gamma'));
  });

  await test('tool layer rejects ambiguous edits', async () => {
    const tools = require('../server/tools');
    await tools.execute('create_file', { path: 'test/.tmp/dup.txt', content: 'x\nx\n' });
    const edit = await tools.execute('edit_file', { path: 'test/.tmp/dup.txt', old_text: 'x', new_text: 'y' });
    assert.equal(edit.ok, false);
    assert.ok(/appears 2 times/.test(edit.output));
  });

  await test('tool layer runs shell commands and reports exit codes', async () => {
    const tools = require('../server/tools');
    const ok = await tools.execute('run_command', { command: 'echo hi && exit 0' });
    assert.equal(ok.exitCode, 0);
    assert.ok(ok.output.includes('hi'));
    const bad = await tools.execute('run_command', { command: 'exit 3' });
    assert.equal(bad.exitCode, 3);
  });

  await test('tool layer refuses paths outside the workspace', async () => {
    const tools = require('../server/tools');
    const res = await tools.execute('read_file', { path: '../../../etc/passwd' });
    assert.equal(res.ok, false);
    assert.ok(/escapes the workspace/.test(res.output));
  });

  // cleanup
  const fs = require('fs');
  fs.rmSync('test/.tmp', { recursive: true, force: true });

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  if (fail) {
    for (const f of failures) console.log(`  FAILED: ${f.name}\n  ${f.err.stack}\n`);
    process.exit(1);
  }
})();
