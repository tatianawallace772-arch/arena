// Headless smoke-test of lib.js pure functions (run with: node scripts/test-lib.js)
const CC = require('../public/js/lib.js');

let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { console.error('  ✗ ' + name); failures++; }
}

/* markdown */
const md = CC.renderMarkdown(
  '# Title\n\nSome **bold** and `code` and [link](https://example.com).\n\n- item 1\n- item 2\n\n> quoted\n\n' +
    '```js\nconst x = "hi"; // note\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'
);
check('md: h1', md.includes('<h1>Title</h1>'));
check('md: strong', md.includes('<strong>bold</strong>'));
check('md: inline code', md.includes('<code class="inline">code</code>'));
check('md: link', md.includes('<a href="https://example.com"'));
check('md: list', md.includes('<ul>') && md.includes('<li>item 1</li>'));
check('md: blockquote', md.includes('<blockquote>quoted</blockquote>'));
check('md: code block w/ lang', md.includes('code-lang">js') && md.includes('tk-cm'));
check('md: table', md.includes('<table>') && md.includes('<th>a</th>'));

const xss = CC.renderMarkdown('<script>alert(1)</script> **ok**');
check('md: html escaped', !xss.includes('<script>') && xss.includes('&lt;script&gt;'));
check('md: unclosed fence handled', CC.renderMarkdown('```js\nlet x = 1;').includes('code-block'));

/* highlight */
const hl = CC.highlight('const s = "abc"; // note', 'js');
check('hl: keyword', hl.includes('tk-kw'));
check('hl: string', hl.includes('tk-str'));
check('hl: comment', hl.includes('tk-cm'));
const hlHtml = CC.highlight('<div class="a">x</div> <!-- c -->', 'html');
check('hl: html tag', hlHtml.includes('tk-tag'));
check('hl: html escaped', !hlHtml.includes('<div') || hlHtml.includes('&lt;div'));
const hlPy = CC.highlight('def f(x):\n    return None  # hi', 'python');
check('hl: python kw', hlPy.includes('tk-kw'));

/* zip */
const zip = CC.makeZip([
  { name: 'hello.txt', content: 'Hello Core Codex!' },
  { name: 'dir/app.js', content: 'console.log(1)\n'.repeat(40) },
]);
check('zip: signature', zip[0] === 0x50 && zip[1] === 0x4b && zip[2] === 3 && zip[3] === 4);
const eocdSig = String.fromCharCode(...zip.slice(zip.length - 22, zip.length - 18));
check('zip: EOCD', eocdSig === 'PK\x05\x06');
require('fs').writeFileSync('/tmp/test.zip', Buffer.from(zip));
const { execSync } = require('child_process');
const listing = execSync('unzip -l /tmp/test.zip 2>&1 || python3 -c "import zipfile;z=zipfile.ZipFile(\'/tmp/test.zip\');print(z.namelist());print(z.read(\'hello.txt\'))"').toString();
console.log(listing);
check('zip: valid archive', listing.includes('hello.txt') || listing.includes('dir/app.js'));

console.log(failures ? `\n${failures} FAILURES` : '\nAll lib tests passed ✓');
process.exit(failures ? 1 : 0);
