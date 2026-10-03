import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
const cache = 'target/asr-evaluation';
await mkdir(`${cache}/models`, { recursive: true });
async function download(url, path, hash) {
  console.log('Downloading', path);
  const r = await fetch(url);
  if (!r.ok) throw Error(`${r.status} ${url}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(path));
  const digest = createHash('sha256');
  for await (const b of createReadStream(path)) digest.update(b);
  const result = digest.digest('hex');
  if (hash && result !== hash) throw Error(`Hash mismatch ${path}`);
  console.log('Verified', path, result);
}
for (const [file, match] of [
  ['NeMo-Speech.cpp-releases.json', /windows-x86_64-cpu.zip$/],
  ['transcribe.cpp-releases.json', /windows-x86_64-cpu-vulkan.tar.gz$/],
]) {
  const release = JSON.parse(await readFile(`${cache}/${file}`))[0];
  const a = release.assets.find((a) => match.test(a.name));
  await download(
    a.browser_download_url,
    `${cache}/${a.name}`,
    a.digest?.split(':')[1],
  );
}
for (const [repo, filename] of [
  [
    'nvidia/nemotron-speech-streaming-en-0.6b',
    'nemotron-speech-streaming-en-0.6b.q8_0.gguf',
  ],
  ['nvidia/parakeet-tdt-0.6b-v3', 'parakeet-tdt-0.6b-v3.q8_0.gguf'],
  [
    'handy-computer/moonshine-streaming-small-GGUF',
    'moonshine-streaming-small-Q8_0.gguf',
  ],
  ['ggerganov/whisper.cpp', 'ggml-tiny.en.bin'],
]) {
  const info = JSON.parse(
    await readFile(`${cache}/${repo.split('/')[1]}-metadata.json`),
  );
  const f = info.siblings.find((f) => f.rfilename === filename);
  await download(
    `https://huggingface.co/${repo}/resolve/${info.sha}/${filename}`,
    `${cache}/models/${filename}`,
    f.lfs.sha256,
  );
}
await download(
  'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.4/samples/jfk.wav',
  `${cache}/jfk.wav`,
);
