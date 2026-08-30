/**
 * Tiny regex highlighter: enough to make code fences inside the simulated transcript
 * look like a real terminal with tree-sitter-ish colours. Not a parser.
 */

const KEYWORDS_JS =
  /\b(?:const|let|var|function|return|if|else|for|while|of|in|new|class|extends|implements|interface|type|enum|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|as|delete|void|do|switch|case|break|continue|static|get|set|yield|null|undefined|true|false|this|super)\b/;

const RULES = {
  js: [
    ['com', /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ['str', /`(?:\\[\s\S]|[^\\`])*`|'(?:\\[\s\S]|[^\n'\\])*'|"(?:\\[\s\S]|[^\n"\\])*"/],
    ['num', /\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/],
    ['kw', KEYWORDS_JS],
    ['type', /\b[A-Z][\w$]*\b/],
    ['fn', /\b[\w$]+(?=\s*\()/],
    ['prop', /(?<=\.)[\w$]+/],
    ['punc', /[{}()[\];,.]/],
    ['op', /[+\-*/%=<>!&|?:^~]+/],
  ],
  ts: null, // filled below (same rules)
  json: [
    ['prop', /"(?:\\.|[^"\\])*"(?=\s*:)/],
    ['str', /"(?:\\.|[^"\\])*"/],
    ['num', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['kw', /\b(?:true|false|null)\b/],
    ['punc', /[{}[\],:]/],
  ],
  bash: [
    ['com', /#[^\n]*/],
    ['str', /'(?:\\[\s\S]|[^'])*'|"(?:\\[\s\S]|[^"])*"/],
    ['kw', /^\s*(?:if|then|fi|else|elif|for|in|do|done|while|case|esac|function|export|local|source|return|set|cd|echo|exit)\b/m],
    ['fn', /^\s*[\w./-]+/],
    ['num', /\b\d+\b/],
    ['op', /[|&;<>()$`]/],
  ],
  py: [
    ['com', /#[^\n]*/],
    ['str', /(?:[rRbBuUfF]{0,2})(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/],
    ['kw', /\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|lambda|yield|pass|break|continue|global|nonlocal|assert|del|async|await|None|True|False|self)\b/],
    ['fn', /\b[\w]+(?=\s*\()/],
    ['num', /\b\d+(?:\.\d+)?\b/],
    ['punc', /[{}()[\];,.:]/],
  ],
  toml: [
    ['com', /#[^\n]*/],
    ['type', /^\s*\[[^\]]+\]/m],
    ['prop', /^\s*[\w.-]+(?=\s*=)/m],
    ['str', /"(?:\\.|[^"\\])*"|'(?:[^'])*'/],
    ['num', /\b\d+(?:\.\d+)*\b|\b(?:true|false)\b/],
  ],
  md: [
    ['meta', /^#{1,6}\s.*$/m],
    ['str', /`[^`]*`/],
    ['kw', /\*\*[^*]+\*\*/],
    ['com', /^\s*>.*$/m],
  ],
  diff: [
    ['diffAdd', /^\+[^\n]*/m],
    ['diffDel', /^-[^\n]*/m],
    ['meta', /^@@[^\n]*/m],
  ],
  text: [],
  sh: null,
  yaml: [
    ['com', /#[^\n]*/],
    ['prop', /^[\w.-]+(?=\s*:)/m],
    ['str', /"(?:\\.|[^"\\])*"|'(?:[^'])*'/],
    ['kw', /\b(?:true|false|null|yes|no)\b/],
    ['num', /\b\d+(?:\.\d+)?\b/],
  ],
};
RULES.ts = RULES.js.map(([t, re]) => [t, re]);
RULES.tsx = RULES.js;
RULES.jsx = RULES.js;
RULES.sh = RULES.bash;
RULES.zsh = RULES.bash;
RULES.env = RULES.yaml;

export const LANG_ALIASES = {
  javascript: 'js',
  typescript: 'ts',
  'typescriptreact': 'tsx',
  'javascriptreact': 'jsx',
  python: 'py',
  shell: 'bash',
  console: 'bash',
  jsonc: 'json',
  yml: 'yaml',
  markdown: 'md',
  rust: 'text',
  go: 'text',
};

function langKey(lang) {
  if (!lang) return 'text';
  const l = String(lang).toLowerCase().trim();
  const resolved = LANG_ALIASES[l] || l;
  return RULES[resolved] ? resolved : 'text';
}

/**
 * @param {string} code
 * @param {string} [lang]
 * @returns {{text:string,type:string}[]} styled runs
 */
export function highlight(code, lang) {
  const rules = RULES[langKey(lang)];
  const runs = [];
  if (!rules || !rules.length) return [{ text: code, type: 'text' }];
  const compiled = rules.map(([type, re]) => ({ type, re: new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g') }));
  let i = 0;
  outer: while (i < code.length) {
    for (const { type, re } of compiled) {
      re.lastIndex = i;
      // force anchor: match must start exactly at i
      const m = re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        runs.push({ text: m[0], type });
        i += m[0].length;
        continue outer;
      }
    }
    const prev = runs[runs.length - 1];
    if (prev && prev.type === 'text') prev.text += code[i];
    else runs.push({ text: code[i], type: 'text' });
    i++;
  }
  return runs;
}
