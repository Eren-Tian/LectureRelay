import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const children = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function port() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}
function start(executable, args, env = process.env, cwd = root) {
  const child = spawn(executable, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: 'inherit',
  });
  children.push(child);
  child.on('error', (error) => {
    child.startError = error;
  });
  return child;
}
async function run(executable, args, env) {
  const child = start(executable, args, env);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(Error(`${executable} exited ${code}`)),
    );
  });
}
async function ready(child, url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.startError || child.exitCode !== null)
      throw child.startError || Error('Test service exited');
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    await pause(150);
  }
  throw Error(`Test service startup timed out: ${url}`);
}
try {
  await run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(root, 'scripts/test/setup-component-driver.ps1'),
  ]);
  const webPort = await port(),
    driverPort = await port();
  const env = {
    ...process.env,
    LECTURERELAY_COMPONENT_DRIVER_PORT: String(driverPort),
    LECTURERELAY_COMPONENT_URL: `http://127.0.0.1:${webPort}`,
  };
  const vite = start(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      String(webPort),
      '--strictPort',
    ],
    env,
    join(root, 'apps/desktop'),
  );
  const driver = start(
    join(root, 'target/component-tools/msedgedriver.exe'),
    [`--port=${driverPort}`],
    env,
  );
  await Promise.all([
    ready(vite, env.LECTURERELAY_COMPONENT_URL),
    ready(driver, `http://127.0.0.1:${driverPort}/status`),
  ]);
  const suites = [
    'classroom-summary.mjs',
    'model-controls.mjs',
    'audit-components.mjs',
    'caption-reader.mjs',
    'theme-contrast.mjs',
    'localization.mjs',
    'live-summary-components.mjs',
  ];
  const requested = process.argv.slice(2);
  if (requested.some((script) => !suites.includes(script)))
    throw Error('Unknown component test suite');
  for (const script of requested.length ? requested : suites)
    await run(process.execPath, [join(root, 'tests/e2e', script)], env);
} finally {
  for (const child of children.reverse())
    if (child.exitCode === null && child.pid) child.kill();
}
