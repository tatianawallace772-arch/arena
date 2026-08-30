import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVfs, glob, grep, listFiles, normalize, readFile } from '../src/app/vfs.js';
import { runShell, runTests, toolEdit, toolGlob, toolGrep, toolRead, toolWrite } from '../src/app/tools.js';

const fresh = () => createVfs();

test('the repo has a working tree with the planted bug', () => {
  const vfs = fresh();
  assert.ok(listFiles(vfs).length >= 14, 'plausible file count');
  assert.equal(readFile(vfs, 'src/util/sort.js').ok, true);
  assert.match(vfs.files['src/util/sort.js'], /const dir = rawDir \?\? 'desc';/);
  const res = runTests(vfs);
  assert.equal(res.fail, 1, 'one test fails before the fix');
  assert.equal(res.pass, 5);
});

test('read/glob/grep behave like the real tools', () => {
  const vfs = fresh();
  const read = toolRead(vfs, { file_path: 'src/util/sort.js', limit: 3 });
  assert.equal(read.lines, 3);
  assert.match(read.content, /^\s+1\t/m, 'content is cat -n style');
  assert.equal(toolRead(vfs, { file_path: 'nope.js' }).ok, false);
  const files = toolGlob(vfs, { pattern: 'src/**/*.js' }).files;
  assert.ok(files.includes('src/util/sort.js') && files.includes('src/db.js'));
  const hits = toolGrep(vfs, { pattern: 'parseSortKey', glob: 'src/**/*.js' });
  assert.ok(hits.hits.length >= 2);
  assert.match(hits.summary, /matches? in src\/\*\*\/\*\.js/);
});

test('paths are normalised the way the CLI accepts them', () => {
  assert.equal(normalize('./src/db.js'), 'src/db.js');
  assert.equal(normalize('~/code/pocketmix/README.md'), 'README.md');
  assert.deepEqual(glob(fresh(), 'tests/*.test.js').length, 2);
  assert.ok(grep(fresh(), 'escapeHtml').some((h) => h.file === 'src/render.js'));
});

test('edits apply for real and show up in git', () => {
  const vfs = fresh();
  const res = toolEdit(vfs, {
    file_path: 'src/util/sort.js',
    old_string: "const dir = rawDir ?? 'desc';",
    new_string: "const dir = (rawDir ?? 'desc').toLowerCase();",
  });
  assert.equal(res.ok, true);
  assert.equal(res.stats.added, 1);
  assert.equal(res.stats.removed, 1);
  assert.equal(runTests(vfs).fail, 0, 'fixing the source turns the suite green');
  const status = runShell(vfs, 'git status').stdout;
  assert.match(status, /modified:   src\/util\/sort\.js/);
  const diff = runShell(vfs, 'git diff').stdout;
  assert.match(diff, /\+   const dir = \(rawDir \?\? 'desc'\)\.toLowerCase\(\);/);
  assert.match(diff, /-   const dir = rawDir \?\? 'desc';/);
});

test('an ambiguous edit fails the way the Edit tool does', () => {
  const vfs = fresh();
  const res = toolEdit(vfs, { file_path: 'src/util/sort.js', old_string: 'const', new_string: 'let' });
  assert.equal(res.ok, false);
  assert.match(res.error, /matched \d+ times/);
});

test('a written test file is picked up by the runner', () => {
  const vfs = fresh();
  toolWrite(vfs, {
    file_path: 'tests/new.test.js',
    content: "import { test } from 'node:test';\ntest('one works', () => {});\ntest('two works', () => {});\n",
  });
  const res = runTests(vfs);
  assert.equal(res.pass, 7, 'existing six plus the two new ones, minus nothing');
  assert.match(res.stdout, /▶ tests\/new\.test\.js/);
});

test('the shell runs the commands a coding agent reaches for', () => {
  const vfs = fresh();
  const lint = runShell(vfs, 'npm run lint');
  assert.equal(lint.stdout, '', 'a clean lint writes nothing to stdout');
  assert.match(lint.summary, /no lint problems/);
  assert.equal(runShell(vfs, 'npx eslint .').stdout, '', 'same for eslint');
  assert.equal(runShell(vfs, 'node --version').stdout, 'v22.16.0');
  assert.match(runShell(vfs, 'cat package.json').stdout, /pocketmix/);
  assert.match(runShell(vfs, 'ls -la').stdout, /drwxr-xr-x/);
  assert.match(runShell(vfs, 'wc -l README.md').stdout, /^\s+\d+/);
  assert.match(runShell(vfs, 'git log').stdout, /feat\(api\)/);
  assert.equal(runShell(vfs, 'rm README.md').stdout, '');
  assert.equal('README.md' in vfs.files, false);
  assert.match(runShell(vfs, 'definitely-not-a-command').error, /command not found/);
  assert.match(runShell(vfs, 'curl example.com').error, /network egress is disabled/);
});

test('writing files marks them untracked, edits show up per file and in --stat', () => {
  const vfs = fresh();
  toolWrite(vfs, { file_path: 'docs/NEW.md', content: '# new\n' });
  const status = runShell(vfs, 'git status').stdout;
  assert.match(status, /Untracked files:/);
  assert.match(status, /docs\/NEW\.md/);
  assert.equal(runShell(vfs, 'git diff --stat').stdout, '', 'untracked files never appear in git diff');
  assert.equal(runShell(vfs, 'git diff src/util/sort.js').stdout, '', 'an untouched file has no diff');
  toolEdit(vfs, {
    file_path: 'src/util/sort.js',
    old_string: "const dir = rawDir ?? 'desc';",
    new_string: "const dir = (rawDir ?? 'desc').toLowerCase();",
  });
  assert.match(runShell(vfs, 'git diff src/util/sort.js').stdout, /diff --git a\/src\/util\/sort\.js/);
  assert.match(runShell(vfs, 'git diff --stat').stdout, /src\/util\/sort\.js\s+\|\s+2/);
  assert.match(runShell(vfs, 'git show').stdout, /commit [0-9a-f]{7}/);
});
