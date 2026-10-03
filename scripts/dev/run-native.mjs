import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = { ...process.env, CARGO_TARGET_DIR: join(root, 'target') };
const localCargo = join(root, '.tools', 'cargo');

if (existsSync(join(localCargo, 'bin', 'rustup.exe'))) {
  env.CARGO_HOME = localCargo;
  env.RUSTUP_HOME = join(root, '.tools', 'rustup');
  // Windows environment names are case-insensitive. Keep the original key to
  // avoid passing both Path and PATH to child processes.
  const pathKey =
    Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'Path';
  env[pathKey] = `${join(localCargo, 'bin')}${delimiter}${env[pathKey] ?? ''}`;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  throw new Error('Expected a Tauri command or cargo');
}

const cargo = command === 'cargo';
const executable = cargo ? 'cargo' : process.execPath;
const parameters = cargo
  ? args
  : [
      join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
      command,
      ...args,
    ];

const child = spawn(executable, parameters, {
  cwd: cargo ? root : join(root, 'apps', 'desktop'),
  env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Native tool could not start: ${error.message}`);
  console.error(
    'Run pnpm run setup and pnpm run doctor to verify the toolchain.',
  );
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
