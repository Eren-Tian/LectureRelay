// Keeps native (Rust) messages and their Simplified Chinese translations in step.
// Rust reports English; apps/desktop/src/i18n/native-messages.ts translates it.
// - every user-facing sentence in the Rust source must have a translation in
//   `nativeMessages`, or in `nativeTemplates` when it is a format! template;
// - every entry in those two sections must still be emitted by the Rust source,
//   so stale translations cannot pile up (`externalMessages` is exempt: browser,
//   PDF.js and messages saved by earlier versions);
// - Rust source must not contain Chinese user text.
// A string that is not user-facing (a model prompt, native dialog text) is
// marked with an `// i18n-exempt: <reason>` comment on its own line or the line
// before it. Only Node built-ins are used. Run standalone with
// `node scripts/verification/native-messages.mjs`.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HAN = /[㐀-鿿]/u;
const RUST_DIR = 'apps/desktop/src-tauri/src';
const CATALOG = 'apps/desktop/src/i18n/native-messages.ts';
const CHECKED_SECTIONS = ['nativeMessages', 'nativeTemplates'];

/** The catalog's sections, evaluated from their plain object literals. */
export async function readNativeCatalog(root) {
  const text = await readFile(join(root, CATALOG), 'utf8');
  const sections = {};
  for (const match of text.matchAll(
    /export const (\w+): Record<string, string> = (\{[\s\S]*?\n\});/g,
  ))
    sections[match[1]] = Function(`"use strict"; return (${match[2]});`)();
  return sections;
}

async function rustFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'tests') files.push(...(await rustFiles(path)));
    } else if (entry.name.endsWith('.rs')) files.push(path);
  }
  return files;
}

function unescape(body) {
  return body
    .replace(/\\\r?\n\s*/g, '')
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(
      /\\(.)/g,
      (_, c) => ({ n: '\n', t: '\t', r: '\r', 0: '\0' })[c] ?? c,
    );
}

/** String literals with their line, plus the lines that carry an exemption. */
export function lexRust(source) {
  const literals = [];
  const exempt = new Set();
  const comments = new Set();
  let line = 1;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '\n') {
      line++;
    } else if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const text = source.slice(i, end < 0 ? source.length : end);
      comments.add(line);
      if (text.includes('i18n-exempt')) exempt.add(line);
      i = (end < 0 ? source.length : end) - 1;
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const text = source.slice(i, end < 0 ? source.length : end);
      line += text.split('\n').length - 1;
      i = (end < 0 ? source.length : end) + 1;
    } else if (
      c === 'r' &&
      /[#"]/.test(source[i + 1] ?? '') &&
      !/\w/.test(source[i - 1] ?? '')
    ) {
      const hashes = /^#*/.exec(source.slice(i + 1))[0];
      if (source[i + 1 + hashes.length] !== '"') continue;
      const start = i + 2 + hashes.length;
      const end = source.indexOf(`"${hashes}`, start);
      const value = source.slice(start, end);
      literals.push({
        value,
        line,
        before: source.slice(Math.max(0, i - 40), i),
      });
      line += value.split('\n').length - 1;
      i = end + hashes.length;
    } else if (c === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"')
        j += source[j] === '\\' ? 2 : 1;
      const raw = source.slice(i + 1, j);
      literals.push({
        value: unescape(raw),
        line,
        before: source.slice(Math.max(0, i - 40), i),
      });
      line += raw.split('\n').length - 1;
      i = j;
    } else if (c === "'") {
      // Character literal (possibly escaped: '\'' or '\u{2026}') or lifetime.
      if (source[i + 1] === '\\')
        i = source[i + 2] === 'u' ? source.indexOf('}', i) + 1 : i + 3;
      else if (source[i + 2] === "'") i += 2;
    }
  }
  // A comment-only line exempts the next line that is not itself a comment.
  for (const comment of [...exempt]) {
    let next = comment + 1;
    while (comments.has(next) && !exempt.has(next)) next++;
    exempt.add(next);
  }
  return { literals, exempt };
}

const template = (value) => value.replace(/\{[^{}]*\}/g, '{}');
const isTemplate = (value) => /(?<!\{)\{[^{}]*\}(?!\})/.test(value);

export async function nativeMessageIssues(root) {
  const issues = [];
  const catalog = await readNativeCatalog(root);
  for (const name of [...CHECKED_SECTIONS, 'externalMessages'])
    if (!catalog[name]) issues.push(`${CATALOG}: missing section ${name}`);
  if (issues.length) return issues;
  const { nativeMessages, nativeTemplates, externalMessages } = catalog;
  for (const key of Object.keys(nativeMessages))
    if (Object.hasOwn(externalMessages, key))
      issues.push(
        `${CATALOG}: "${key}" is in both nativeMessages and externalMessages`,
      );
  const emitted = new Set();
  const emittedTemplates = new Set();
  for (const file of await rustFiles(join(root, RUST_DIR))) {
    let source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
    const tests = source.indexOf('#[cfg(test)]');
    if (tests >= 0) source = source.slice(0, tests);
    const name = relative(root, file).replaceAll('\\', '/');
    const { literals, exempt } = lexRust(source);
    for (const { value, line, before } of literals) {
      if (exempt.has(line)) continue;
      // Messages embedded in SQL, e.g. recovery notes stored for later display.
      const stored = [...value.matchAll(/message='([^']+)'/g)].map((m) => m[1]);
      for (const message of [value, ...stored]) {
        if (isTemplate(message)) emittedTemplates.add(template(message));
        else emitted.add(message);
        const sentence =
          /^[A-Z]/.test(message) &&
          message.includes(' ') &&
          (/[.!?…]$/.test(message) ||
            /(?:user_error|ok_or|Err)\(\s*$/.test(before));
        if (HAN.test(message)) {
          issues.push(
            `${name}:${line}: native text must be English; translate it in ${CATALOG} or mark it i18n-exempt: ${message.slice(0, 60)}`,
          );
        } else if (!sentence) {
          continue;
        } else if (isTemplate(message)) {
          if (!Object.hasOwn(nativeTemplates, template(message)))
            issues.push(
              `${name}:${line}: no Chinese translation in nativeTemplates for "${template(message)}"`,
            );
        } else if (!Object.hasOwn(nativeMessages, message)) {
          issues.push(
            Object.hasOwn(externalMessages, message)
              ? `${name}:${line}: move "${message}" from externalMessages to nativeMessages`
              : `${name}:${line}: no Chinese translation in nativeMessages for "${message}"`,
          );
        }
      }
    }
  }
  for (const key of Object.keys(nativeMessages))
    if (!emitted.has(key))
      issues.push(
        `${CATALOG}: nativeMessages entry is no longer emitted by Rust; remove it or move it to externalMessages: "${key}"`,
      );
  for (const key of Object.keys(nativeTemplates)) {
    if (!emittedTemplates.has(key))
      issues.push(
        `${CATALOG}: nativeTemplates entry is no longer emitted by Rust: "${key}"`,
      );
    const holes = (text) => text.split('{}').length - 1;
    if (holes(key) !== holes(nativeTemplates[key]))
      issues.push(
        `${CATALOG}: "${key}" and its translation use different numbers of {} values`,
      );
  }
  return issues;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const issues = await nativeMessageIssues(root);
  for (const issue of issues) console.log(issue);
  if (issues.length) {
    console.log(`${issues.length} native message issue(s) found.`);
    process.exit(1);
  }
  console.log('Native message catalog is in step with the Rust source.');
}
