import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicDir = resolve(root, 'apps/desktop/public');
await mkdir(publicDir, { recursive: true });
await copyFile(
  resolve(root, 'assets/branding/phoenix/phoenix.svg'),
  resolve(publicDir, 'app-icon.svg'),
);
