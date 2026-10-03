import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const path = 'target/asr-evaluation/nemo-speech-0.1.0-windows-x86_64-cuda.zip';
const response = await fetch(
  'https://github.com/NVIDIA/NeMo-Speech.cpp/releases/download/v0.1.0/nemo-speech-0.1.0-windows-x86_64-cuda.zip',
);
if (!response.ok) throw Error(`CUDA SDK download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (
  createHash('sha256').update(bytes).digest('hex') !==
  'ba024204e76ca2fa4eefa8787506c3c49e418147f627f60cf9206a582b60089c'
)
  throw Error('CUDA SDK integrity failure');
await mkdir('target/asr-evaluation', { recursive: true });
await writeFile(path, bytes);
console.log('Verified developer-only CUDA SDK', bytes.length);
