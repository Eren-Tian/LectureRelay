import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = join(root, 'target/native/speech-worker');
const archive = join(cache, 'nemo-speech-0.1.0-windows-x86_64-cpu.zip');
const hash = '5e4ea81046012edcd77fd8848de8eefb5a4ba38cc26f52eb544ab184695a75d6';
await mkdir(cache, { recursive: true });
let bytes = await readFile(archive).catch(() => null);
// Reuse a previously verified SDK archive without moving historical benchmark data.
if (!bytes)
  bytes = await readFile(
    join(
      root,
      'target/asr-evaluation/nemo-speech-0.1.0-windows-x86_64-cpu.zip',
    ),
  ).catch(() => null);
if (bytes && createHash('sha256').update(bytes).digest('hex') === hash)
  await writeFile(archive, bytes);
if (!bytes || createHash('sha256').update(bytes).digest('hex') !== hash) {
  const response = await fetch(
    'https://github.com/NVIDIA/NeMo-Speech.cpp/releases/download/v0.1.0/nemo-speech-0.1.0-windows-x86_64-cpu.zip',
  );
  if (!response.ok) throw Error('Pinned native ASR SDK download failed.');
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== hash)
    throw Error('Native SDK integrity check failed.');
  await writeFile(archive, bytes);
}
// The archive is upstream's pinned SDK; weights are never bundled here.
const extract = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(root, 'scripts/build/extract-asr.ps1'),
    '-Archive',
    archive,
    '-Destination',
    join(cache, 'nemo'),
  ],
  { cwd: root, stdio: 'inherit' },
);
if (extract.status !== 0) throw Error('Native ASR SDK extraction failed.');
const build = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(root, 'scripts/build/build-asr.ps1'),
  ],
  { cwd: root, stdio: 'inherit' },
);
if (build.status !== 0) throw Error('Native ASR worker build failed.');
