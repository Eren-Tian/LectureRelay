// Guards the frontend UI string catalog:
// - user-visible Chinese text must live in apps/desktop/src/i18n, never inline
//   in components or helpers;
// - every key in the Simplified Chinese catalog must be referenced as
//   `ui.<key>` somewhere in apps/desktop/src, so dead entries cannot pile up.
// Only Node built-ins are used. Run standalone with
// `node scripts/verification/ui-strings.mjs`.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HAN = /[\u3400-\u9fff]/u;
const SOURCE_DIR = 'apps/desktop/src';
const CATALOG_DIR = 'apps/desktop/src/i18n';
const ZH_CATALOG = 'apps/desktop/src/i18n/zh-CN.ts';
const EN_CATALOG = 'apps/desktop/src/i18n/en.ts';
// Keywords after which `/` starts a regular expression and `<` may start JSX.
const EXPRESSION_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);
const isIdentifierStart = (char) => /[A-Za-z_$]/.test(char);
const isIdentifierPart = (char) => /[\w$]/.test(char);

/**
 * Minimal TypeScript/TSX lexer. It finds string literals, template literal
 * chunks, regular expressions and JSX text, and returns a copy of the source
 * with comments and all literal text blanked out (newlines are preserved).
 */
export function lexSource(source, { jsx }) {
  const literals = [];
  const code = source.split('');
  let i = 0;
  const blank = (start, end) => {
    for (let k = start; k < end; k++) if (code[k] !== '\n') code[k] = ' ';
  };
  const record = (kind, start, end, text = source.slice(start, end)) => {
    literals.push({ kind, start, text });
    blank(start, end);
  };
  const skipSpace = () => {
    while (i < source.length && /\s/.test(source[i])) i++;
  };

  function readQuoted(quote, kind) {
    const start = i++;
    // JSX attribute strings may span lines and have no escape sequences.
    const jsxAttribute = kind === 'jsx-attribute';
    while (
      i < source.length &&
      source[i] !== quote &&
      (jsxAttribute || source[i] !== '\n')
    )
      i += source[i] === '\\' && !jsxAttribute ? 2 : 1;
    i++;
    record(kind, start, Math.min(i, source.length));
  }

  function readTemplate() {
    let chunk = i++;
    while (i < source.length) {
      if (source[i] === '\\') i += 2;
      else if (source[i] === '`') {
        record('template', chunk, ++i);
        return;
      } else if (source[i] === '$' && source[i + 1] === '{') {
        record('template', chunk, (i += 2));
        scanCode(true);
        chunk = i - 1;
      } else i++;
    }
    record('template', chunk, i);
  }

  function readRegex() {
    const start = i++;
    let inClass = false;
    while (i < source.length && source[i] !== '\n') {
      const char = source[i];
      if (char === '\\') i += 2;
      else {
        i++;
        if (char === '[') inClass = true;
        else if (char === ']') inClass = false;
        else if (char === '/' && !inClass) break;
      }
    }
    while (i < source.length && isIdentifierPart(source[i])) i++;
    record('regex', start, i);
  }

  // `<` at an expression start in TSX: JSX unless it is a generic arrow
  // function's type parameter list such as `<T,>` or `<T extends U>`.
  function looksLikeJsx() {
    const rest = source.slice(i + 1, i + 80);
    if (rest.startsWith('>')) return true;
    const match = rest.match(/^([A-Za-z_$][\w$.:-]*)(\s*)(.?)/);
    if (!match) return false;
    if (match[3] === ',') return false;
    return !/^\s*extends\b/.test(rest.slice(match[1].length));
  }

  function readJsxElement() {
    i++;
    if (source[i] === '>') {
      i++;
      readJsxChildren();
      return;
    }
    while (i < source.length && /[\w$.:-]/.test(source[i])) i++;
    while (i < source.length) {
      skipSpace();
      const char = source[i];
      if (char === '/' && source[i + 1] === '>') {
        i += 2;
        return;
      }
      if (char === '>') {
        i++;
        readJsxChildren();
        return;
      }
      if (char === '{') {
        i++;
        scanCode(true);
      } else if (char === '"' || char === "'")
        readQuoted(char, 'jsx-attribute');
      else if (/[\w$:-]/.test(char)) {
        while (i < source.length && /[\w$:-]/.test(source[i])) i++;
      } else i++;
    }
  }

  function readJsxChildren() {
    let text = i;
    const flush = () => {
      if (i > text && source.slice(text, i).trim()) record('jsx-text', text, i);
    };
    while (i < source.length) {
      const char = source[i];
      if (char === '<') {
        flush();
        if (source[i + 1] === '/') {
          while (i < source.length && source[i] !== '>') i++;
          i++;
          return;
        }
        readJsxElement();
        text = i;
      } else if (char === '{') {
        flush();
        i++;
        scanCode(true);
        text = i;
      } else i++;
    }
    flush();
  }

  // Scans code until the end of input, or (nested) until the unmatched `}`.
  function scanCode(nested) {
    let depth = 0;
    let previous = null;
    const expressionStart = () =>
      previous === null ||
      (previous.type === 'punctuator' && !')]}'.includes(previous.value)) ||
      (previous.type === 'word' && EXPRESSION_KEYWORDS.has(previous.value));
    while (i < source.length) {
      const char = source[i];
      if (char === '/' && source[i + 1] === '/') {
        const start = i;
        while (i < source.length && source[i] !== '\n') i++;
        blank(start, i);
      } else if (char === '/' && source[i + 1] === '*') {
        const start = i;
        const end = source.indexOf('*/', i + 2);
        i = end < 0 ? source.length : end + 2;
        blank(start, i);
      } else if (char === "'" || char === '"') {
        readQuoted(char, 'string');
        previous = { type: 'literal' };
      } else if (char === '`') {
        readTemplate();
        previous = { type: 'literal' };
      } else if (/\s/.test(char)) i++;
      else if (isIdentifierStart(char)) {
        const start = i;
        while (i < source.length && isIdentifierPart(source[i])) i++;
        previous = { type: 'word', value: source.slice(start, i) };
      } else if (/\d/.test(char)) {
        while (i < source.length && /[\w.]/.test(source[i])) i++;
        previous = { type: 'literal' };
      } else if (char === '/' && expressionStart()) {
        readRegex();
        previous = { type: 'literal' };
      } else if (char === '<' && jsx && expressionStart() && looksLikeJsx()) {
        readJsxElement();
        previous = { type: 'literal' };
      } else if (char === '{') {
        depth++;
        i++;
        previous = { type: 'punctuator', value: char };
      } else if (char === '}') {
        i++;
        if (nested && depth === 0) return;
        depth--;
        previous = { type: 'punctuator', value: char };
      } else {
        if (HAN.test(char)) record('code', i, i + 1);
        i++;
        previous = { type: 'punctuator', value: char };
      }
    }
  }

  scanCode(false);
  return { literals, code: code.join('') };
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

// Top-level keys of the first object literal assigned in a catalog file.
function catalogKeys(code) {
  const keys = [];
  const open = code.indexOf('{', code.search(/=\s*\{/));
  if (open < 0) return keys;
  let depth = 0;
  let expectKey = true;
  for (let i = open; i < code.length; i++) {
    const char = code[i];
    if ('{[('.includes(char)) {
      depth++;
      if (depth === 1) expectKey = true;
    } else if ('}])'.includes(char)) {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1 && char === ',') expectKey = true;
    else if (depth === 1 && expectKey && isIdentifierStart(char)) {
      const match = code.slice(i).match(/^([A-Za-z_$][\w$]*)\s*:/);
      if (match) keys.push(match[1]);
      expectKey = false;
    }
  }
  return keys;
}

const lineOf = (source, offset) => source.slice(0, offset).split('\n').length;
const preview = (text) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 57)}…` : flat;
};

export async function uiStringIssues(root) {
  const issues = [];
  const sourceRoot = resolve(root, SOURCE_DIR);
  const catalogRoot = resolve(root, CATALOG_DIR);
  const references = new Set();
  for (const path of await sourceFiles(sourceRoot)) {
    const file = relative(root, path).replaceAll('\\', '/');
    const source = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
    const { literals, code } = lexSource(source, { jsx: path.endsWith('x') });
    const inCatalog = !relative(catalogRoot, path).startsWith('..');
    for (const match of code.matchAll(/(?<![\w$.])ui\b(\s*\.\s*([\w$]+))?/g)) {
      if (match[2]) references.add(match[2]);
      else if (
        !inCatalog &&
        !/\bimport\s*(?:type\s*)?\{[^}]*$/.test(
          code.slice(Math.max(0, match.index - 200), match.index),
        )
      )
        issues.push(
          `${file}:${lineOf(source, match.index)}: indirect UI catalog access; reference entries as ui.<key> so unused keys can be detected`,
        );
    }
    if (inCatalog) continue;
    for (const literal of literals)
      if (HAN.test(literal.text))
        issues.push(
          `${file}:${lineOf(source, literal.start)}: Chinese ${literal.kind} outside apps/desktop/src/i18n: ${preview(literal.text)}`,
        );
  }
  const keysIn = async (file) => {
    const source = await readFile(resolve(root, file), 'utf8');
    return catalogKeys(lexSource(source, { jsx: false }).code);
  };
  const zhKeys = await keysIn(ZH_CATALOG);
  const enKeys = new Set(await keysIn(EN_CATALOG));
  if (!zhKeys.length) issues.push(`${ZH_CATALOG}: no catalog keys found`);
  for (const key of zhKeys) {
    if (!references.has(key))
      issues.push(`${ZH_CATALOG}: unused UI string key ui.${key}`);
    if (!enKeys.has(key))
      issues.push(`${EN_CATALOG}: missing English entry for ${key}`);
  }
  for (const key of enKeys)
    if (!zhKeys.includes(key))
      issues.push(`${EN_CATALOG}: ${key} has no Simplified Chinese entry`);
  return issues;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const issues = await uiStringIssues(root);
  for (const issue of issues) console.log(issue);
  if (issues.length) {
    console.log(`${issues.length} UI string issue(s) found.`);
    process.exit(1);
  }
  console.log('UI string catalog is clean.');
}
