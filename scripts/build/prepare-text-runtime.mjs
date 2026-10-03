import { createHash } from 'node:crypto';
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tag = 'b11366';
const hash = '33dbed3c969e394e2977105e89f5c4b5dbbb5233d038d14b6954b3d32bbde9ec';
const cache = resolve(root, 'target/local-text-runtime');
const out = resolve(root, 'apps/desktop/src-tauri/resources/local-text');
const digest = (data) => createHash('sha256').update(data).digest('hex');
async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Upstream download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
await mkdir(cache, { recursive: true });
await mkdir(out, { recursive: true });
const archive = join(cache, 'runtime.zip');
let bytes = await readFile(archive).catch(() => null);
if (!bytes || digest(bytes) !== hash) {
  bytes = await fetchBytes(
    `https://github.com/ggml-org/llama.cpp/releases/download/${tag}/llama-${tag}-bin-win-cpu-x64.zip`,
  );
  if (digest(bytes) !== hash)
    throw new Error('llama.cpp runtime checksum mismatch');
  await writeFile(archive, bytes);
}
const unpacked = join(cache, 'unpacked');
execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    'Expand-Archive -LiteralPath $env:LR_TEXT_ARCHIVE -DestinationPath $env:LR_TEXT_UNPACK -Force',
  ],
  {
    env: { ...process.env, LR_TEXT_ARCHIVE: archive, LR_TEXT_UNPACK: unpacked },
    windowsHide: true,
    stdio: 'pipe',
  },
);
const files = (await readdir(unpacked)).filter(
  (name) =>
    /^(ggml(?:-base|-cpu-[a-z0-9]+)?|llama(?:-common|-server-impl)?|mtmd|libomp)\.dll$/.test(
      name,
    ) ||
    name === 'llama-server.exe' ||
    name.startsWith('LICENSE'),
);
for (const name of files) await copyFile(join(unpacked, name), join(out, name));
const licenses = [
  [
    'LICENSE-cpp-httplib',
    `https://raw.githubusercontent.com/ggml-org/llama.cpp/${tag}/vendor/cpp-httplib/LICENSE`,
  ],
  [
    'LICENSE-sha256',
    `https://raw.githubusercontent.com/ggml-org/llama.cpp/${tag}/vendor/hash/sha256/LICENSE`,
  ],
  [
    'LICENSE-xxhash',
    `https://raw.githubusercontent.com/ggml-org/llama.cpp/${tag}/vendor/hash/xxhash/LICENSE`,
  ],
  [
    'LICENSE-rotate-bits',
    `https://raw.githubusercontent.com/ggml-org/llama.cpp/${tag}/vendor/hash/rotate-bits/LICENSE.md`,
  ],
  // These upstream single-header dependencies embed their own copyright/license text.
  [
    'NOTICE-nlohmann-json.hpp.txt',
    `https://raw.githubusercontent.com/ggml-org/llama.cpp/${tag}/vendor/nlohmann/json.hpp`,
  ],
  [
    'NOTICE-stb-image.h.txt',
    `https://raw.githubusercontent.com/ggml-org/llama.cpp/${tag}/vendor/stb/stb_image.h`,
  ],
  [
    'LICENSE-llama.cpp',
    `https://raw.githubusercontent.com/ggml-org/llama.cpp/${tag}/LICENSE`,
  ],
  [
    'LICENSE-Hy-MT2.txt',
    'https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF/resolve/a0c709d9fac510f2c807aa3af52872340dc37a4a/LICENSE.txt',
  ],
  [
    'LICENSE-Qwen3.5.txt',
    'https://huggingface.co/Qwen/Qwen3.5-4B/resolve/851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a/LICENSE',
  ],
];
for (const [name, url] of licenses) {
  const data =
    (await readFile(join(cache, name)).catch(() => null)) ??
    (await fetchBytes(url));
  await writeFile(join(cache, name), data);
  await writeFile(join(out, name), data);
  files.push(name);
}
const manifest = {
  runtime: `llama.cpp ${tag} CPU`,
  archiveSha256: hash,
  files: {},
};
for (const name of files)
  manifest.files[name] = digest(await readFile(join(out, name)));
await writeFile(
  join(out, 'runtime-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `Prepared ${manifest.runtime}: ${files.length} runtime and license files`,
);
