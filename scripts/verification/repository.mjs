import { execFileSync } from 'node:child_process';
import { readFile, stat, mkdir, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  ...new Set(
    execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean),
  ),
];
// Also inspect ignored local environment files, without traversing toolchains, downloads or user/test data.
const localSecretFiles = [];
async function findLocalSecrets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (
        ![
          '.git',
          '.tools',
          '.pnpm-store',
          'node_modules',
          'target',
          'dist',
          'build',
          'gen',
          'local-asr',
          '__pycache__',
        ].includes(entry.name)
      )
        await findLocalSecrets(resolve(directory, entry.name));
    } else if (
      /^\.env(?:\.|$)|^(?:secrets|credentials|tokens?)\.(?:json|txt|toml)$/i.test(
        entry.name,
      )
    ) {
      localSecretFiles.push(
        relative(root, resolve(directory, entry.name)).replaceAll('\\', '/'),
      );
    }
  }
}
await findLocalSecrets(root);
for (const file of localSecretFiles)
  if (!files.includes(file)) files.push(file);
const issues = [];
const graph = new Map();
const binaries = [];
const secrets = [];
const exists = async (path) =>
  stat(path).then(
    () => true,
    () => false,
  );
for (const file of files) {
  const path = resolve(root, file);
  if (!(await exists(path))) continue;
  if (/\.(exe|dll|msi|obj|pdb|gguf|onnx|safetensors|wav|mp3|m4a)$/i.test(file))
    issues.push(`Generated/private binary in source inventory: ${file}`);
  if (/\.(png|ico|pdf)$/i.test(file)) {
    binaries.push(file);
    continue;
  }
  const text = await readFile(path, 'utf8');
  // Findings expose locations only. Synthetic credential tests intentionally use short non-provider strings.
  const patterns = [
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    /\bgsk_[A-Za-z0-9]{20,}\b/g,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /Bearer\s+[A-Za-z0-9._-]{24,}/g,
    /https?:\/\/[^\s/@]+:[^\s/@]+@/g,
    /(?:api[_-]?key|client_secret|access_token)["']?\s*[:=]\s*["'][A-Za-z0-9._-]{16,}["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern))
      secrets.push({
        file,
        line: text.slice(0, match.index).split('\n').length,
      });
  }
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.example'))
    secrets.push({ file, line: 1 });
  if (extname(file) === '.md') {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g, '').split('#')[0];
      if (!link || /^[a-z]+:|^\/\//i.test(link)) continue;
      if (!(await exists(resolve(dirname(path), decodeURIComponent(link)))))
        issues.push(`Broken document link: ${file} -> ${link}`);
    }
  }
  if (/^apps\/desktop\/src\/.*\.tsx?$/.test(file)) {
    const imports = [];
    for (const match of text.matchAll(
      /(?:from\s+|import\s*)['"]([^'"]+)['"]/g,
    )) {
      if (!match[1].startsWith('.')) continue;
      const base = resolve(dirname(path), match[1]);
      const target = (
        await Promise.all(
          ['', '.ts', '.tsx', '/index.ts'].map(async (suffix) =>
            (await exists(base + suffix)) ? base + suffix : null,
          ),
        )
      ).find(Boolean);
      if (!target)
        issues.push(`Unresolved frontend import: ${file} -> ${match[1]}`);
      else if (/\.tsx?$/.test(target))
        imports.push(relative(root, target).replaceAll('\\', '/'));
    }
    graph.set(file, imports);
  }
}
const visited = new Set();
const active = [];
function visit(file) {
  if (active.includes(file)) {
    issues.push(
      `Frontend import cycle: ${[...active.slice(active.indexOf(file)), file].join(' -> ')}`,
    );
    return;
  }
  if (visited.has(file)) return;
  active.push(file);
  for (const target of graph.get(file) ?? []) visit(target);
  active.pop();
  visited.add(file);
}
for (const file of graph.keys()) visit(file);
for (const finding of secrets)
  issues.push(
    `Potential credential: ${finding.file}:${finding.line} (value withheld)`,
  );
const report = {
  sourceFiles: files.length,
  frontendModules: graph.size,
  sourceBinaryInputs: binaries,
  potentialSecrets: secrets,
  issues,
};
await mkdir(resolve(root, 'target/repository-cleanup'), { recursive: true });
await writeFile(
  resolve(root, 'target/repository-cleanup/repository-audit.json'),
  JSON.stringify(report, null, 2),
);
console.log(
  `Repository audit: ${files.length} source files, ${graph.size} frontend modules, ${secrets.length} potential secrets, ${issues.length} issues.`,
);
for (const issue of issues) console.error(issue);
process.exitCode = issues.length ? 1 : 0;
