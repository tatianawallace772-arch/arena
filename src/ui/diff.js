/**
 * Line diff (unified, with hunks). Used by the simulated Edit/Write tools so the
 * permission prompts show a real diff of the virtual file, not a fake string.
 */

function lcsDiff(a, b) {
  const n = a.length;
  const m = b.length;
  // Trim common prefix/suffix first: keeps the DP table small for realistic edits.
  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start++;
  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const ops = [];
  for (let i = 0; i < start; i++) ops.push({ type: ' ', text: a[i] });

  const n2 = midA.length;
  const m2 = midB.length;
  if (n2 * m2 > 90000 || n2 === 0 || m2 === 0) {
    for (const line of midA) ops.push({ type: '-', text: line });
    for (const line of midB) ops.push({ type: '+', text: line });
  } else {
    const dp = new Uint16Array((n2 + 1) * (m2 + 1));
    const at = (i, j) => i * (m2 + 1) + j;
    for (let i = n2 - 1; i >= 0; i--) {
      for (let j = m2 - 1; j >= 0; j--) {
        dp[at(i, j)] = midA[i] === midB[j] ? dp[at(i + 1, j + 1)] + 1 : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n2 && j < m2) {
      if (midA[i] === midB[j]) {
        ops.push({ type: ' ', text: midA[i] });
        i++;
        j++;
      } else if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) {
        ops.push({ type: '-', text: midA[i++] });
      } else {
        ops.push({ type: '+', text: midB[j++] });
      }
    }
    while (i < n2) ops.push({ type: '-', text: midA[i++] });
    while (j < m2) ops.push({ type: '+', text: midB[j++] });
  }
  for (let k = endA; k < n; k++) ops.push({ type: ' ', text: a[k] });

  // assign line numbers
  let oldNo = 0;
  let newNo = 0;
  for (const op of ops) {
    if (op.type === '-') op.old = ++oldNo;
    else if (op.type === '+') op.new = ++newNo;
    else {
      op.old = ++oldNo;
      op.new = ++newNo;
    }
  }
  return ops;
}

/**
 * @returns {{ops: object[], hunks: object[], added: number, removed: number, identical: boolean}}
 */
export function diffLines(oldText, newText, { context = 3 } = {}) {
  const a = String(oldText ?? '').replace(/\n$/, '').split('\n');
  const b = String(newText ?? '').replace(/\n$/, '').split('\n');
  const ops = lcsDiff(a, b);
  const added = ops.filter((o) => o.type === '+').length;
  const removed = ops.filter((o) => o.type === '-').length;

  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.type === ' ') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) keep[k] = true;
  });
  const hunks = [];
  let cur = null;
  ops.forEach((op, idx) => {
    if (!keep[idx]) {
      if (cur) {
        hunks.push(cur);
        cur = null;
      }
      return;
    }
    if (!cur) cur = { oldStart: op.old ?? 0, newStart: op.new ?? 0, lines: [] };
    cur.lines.push(op);
    if (op.type !== '+' && op.old) cur.oldCount = op.old - cur.oldStart + 1;
    if (op.type !== '-' && op.new) cur.newCount = op.new - cur.newStart + 1;
  });
  if (cur) hunks.push(cur);
  return { ops, hunks, added, removed, identical: added === 0 && removed === 0 };
}

/**
 * Render a diff to display lines, terminal-style: `old│- text` gutter columns,
 * hunk headers, and +/- colours. Returns [{runs}] plus style tokens per line.
 * @param {{context?:number,maxLines?:number}} [opts]
 */
export function diffToLines(oldText, newText, opts = {}) {
  const { context = 3, maxLines = 40, oldLabel = 'old', newLabel = 'new' } = opts;
  const d = diffLines(oldText, newText, { context });
  const lines = [];
  for (const hunk of d.hunks) {
    lines.push({
      kind: 'hunk',
      text: `@@ -${hunk.oldStart},${hunk.oldCount ?? 0} +${hunk.newStart},${hunk.newCount ?? 0} @@`,
    });
    for (const op of hunk.lines) {
      lines.push({
        kind: op.type === '+' ? 'add' : op.type === '-' ? 'del' : 'ctx',
        old: op.old ?? '',
        new: op.new ?? '',
        text: op.text,
      });
    }
  }
  let hidden = 0;
  let shown = lines;
  if (maxLines && lines.length > maxLines) {
    shown = lines.slice(0, maxLines);
    hidden = lines.length - maxLines;
    shown.push({ kind: 'hunk', text: `… ${hidden} more ${hidden === 1 ? 'line' : 'lines'} in diff · ctrl+o for full` });
  }
  return { ...d, lines: shown, oldLabel, newLabel, hidden };
}

/** Apply exact-string replacements (the semantics of Claude Code's Edit tool). */
export function applyEdits(text, edits) {
  let out = String(text);
  let replaced = 0;
  let occurrences = 0;
  const problems = [];
  for (const edit of edits) {
    const { oldText, newText, replaceAll = false } = edit;
    if (!oldText) {
      problems.push('oldText was empty');
      continue;
    }
    const count = out.split(oldText).length - 1;
    if (count === 0) {
      problems.push('old string not found in file');
      continue;
    }
    if (count > 1 && !replaceAll) {
      problems.push(`old string matched ${count} times — needs to be unique (or set replaceAll)`);
      continue;
    }
    out = replaceAll ? out.split(oldText).join(newText) : out.replace(oldText, newText);
    replaced++;
    occurrences += replaceAll ? count : 1;
  }
  return { text: out, replaced, occurrences, problems };
}
