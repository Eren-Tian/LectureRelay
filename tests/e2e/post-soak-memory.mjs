// Diagnostic GC is explicitly AFTER baseline capture and is never a production fix.
// Edge custom command route: https://github.com/SeleniumHQ/selenium/blob/trunk/dotnet/src/webdriver/Edge/EdgeDriver.cs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const root = 'target/acceptance-v0.3-2026-10-03';
const soak = JSON.parse(await fs.readFile(`${root}/soak-result.json`, 'utf8'));
assert.ok(soak.passed && soak.wallSeconds >= 5400);
const d = await WebDriver.current();
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
assert.equal((await d.native('live_status')).active, false);
const samples = [];
async function sample(stage) {
  const heap = await d.read(
    'return {used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,dom:document.querySelectorAll("*").length};',
  );
  const end = Date.now() + 5000;
  let processes;
  do {
    const r = spawnSync(
      process.env.LECTURERELAY_TEST_PYTHON ||
        'C:/ProgramData/miniconda3/python.exe',
      [
        'tests/e2e/app-process-snapshot.py',
        '--exe',
        path.resolve(root, 'app/lecturerelay-desktop.exe'),
      ],
      { windowsHide: true, encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    processes = JSON.parse(r.stdout);
    if (
      !processes.processes.some((p) =>
        ['asr-worker.exe', 'llama-server.exe'].includes(p.name),
      )
    )
      break;
    await new Promise((r) => setTimeout(r, 250));
  } while (Date.now() < end);
  assert.ok(
    !processes.processes.some((p) =>
      ['asr-worker.exe', 'llama-server.exe'].includes(p.name),
    ),
    'An inference process remained alive after normal drain',
  );
  const entry = { stage, heap, ...processes };
  samples.push(entry);
  await fs.writeFile(
    `${root}/post-soak-memory.json`,
    JSON.stringify(
      {
        samples,
        scope:
          'After capture/drain only. Forced GC is diagnostic and is not included in the 90-minute performance baseline.',
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(entry));
}
await sample('after-stop');
await new Promise((r) => setTimeout(r, 30000));
await sample('idle-30-seconds');
try {
  await d.command('POST', '/ms/cdp/execute', {
    cmd: 'HeapProfiler.collectGarbage',
    params: {},
  });
  await new Promise((r) => setTimeout(r, 1500));
  await sample('after-diagnostic-garbage-collection');
} catch (error) {
  await fs.writeFile(
    `${root}/post-soak-memory-gc-unavailable.json`,
    JSON.stringify({ error: String(error) }, null, 2),
  );
  console.log(
    'Diagnostic GC unavailable; baseline and idle observations remain valid.',
  );
}
