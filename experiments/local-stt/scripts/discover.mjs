import { mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../../../', import.meta.url);
const cache = new URL('target/asr-evaluation/', root);
await mkdir(cache, { recursive: true });
async function get(url, name) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'LectureRelay-benchmark' },
  });
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  const text = await r.text();
  await writeFile(new URL(name, cache), text);
  return text;
}
for (const repo of [
  'NVIDIA/NeMo-Speech.cpp',
  'handy-computer/transcribe.cpp',
  'ggml-org/whisper.cpp',
]) {
  const name = repo.split('/')[1];
  const releases = JSON.parse(
    await get(
      `https://api.github.com/repos/${repo}/releases`,
      `${name}-releases.json`,
    ),
  );
  console.log(
    name,
    releases.slice(0, 2).map((r) => ({
      tag: r.tag_name,
      assets: r.assets.map((a) => ({
        name: a.name,
        size: a.size,
        url: a.browser_download_url,
        digest: a.digest,
      })),
    })),
  );
}
for (const [repo, branch, files] of [
  [
    'NVIDIA/NeMo-Speech.cpp',
    'v0.1.0',
    [
      'docs/cli.md',
      'docs/asr/models.md',
      'docs/asr/context-biasing.md',
      'LICENSE',
      'include/nemo-speech.h',
    ],
  ],
  [
    'handy-computer/transcribe.cpp',
    'main',
    [
      'README.md',
      'docs/models/moonshine-streaming-small.md',
      'CMakeLists.txt',
      'include/transcribe.h',
      'catalog/models.json',
      'LICENSE',
    ],
  ],
])
  for (const file of files) {
    try {
      await get(
        `https://raw.githubusercontent.com/${repo}/${branch}/${file}`,
        `${repo.split('/')[1]}-${file.replaceAll('/', '_')}`,
      );
    } catch (e) {
      console.log(e.message);
    }
  }
for (const repo of [
  'nvidia/nemotron-speech-streaming-en-0.6b',
  'nvidia/parakeet-tdt-0.6b-v3',
  'UsefulSensors/moonshine-streaming-small',
  'handy-computer/moonshine-streaming-small-GGUF',
  'ggerganov/whisper.cpp',
]) {
  try {
    const data = JSON.parse(
      await get(
        `https://huggingface.co/api/models/${repo}?blobs=true`,
        `${repo.split('/')[1]}-metadata.json`,
      ),
    );
    console.log(repo, {
      sha: data.sha,
      license: data.cardData?.license,
      files: data.siblings.filter((f) =>
        /gguf|ggml-tiny.en.bin|ggml-base.en.bin/.test(f.rfilename),
      ),
    });
  } catch (e) {
    console.log(e.message);
  }
}
