// Reopen the isolated native library after the real lecturer audio runs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebDriver } from './webdriver.mjs';
const exe = process.env.LECTURERELAY_LATENCY_EXE;
assert.ok(exe);
const driver = await WebDriver.start(path.resolve(exe));
try {
  // WebDriver can return its session before WebView2's native IPC is ready.
  let boot;
  const deadline = Date.now() + 15000;
  while (!boot && Date.now() < deadline) {
    try {
      boot = await driver.native('bootstrap');
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  assert.ok(boot, 'The restarted native app did not initialize');
  assert.equal(
    path.resolve(boot.storage.database),
    path.resolve('target/classroom-fixes/ui-1/app-data/app.db'),
  );
  assert.equal(boot.recording, null);
  assert.equal(boot.settings.provider, 'none');
  assert.equal(boot.settings.quietMode, true);
  assert.equal(boot.settings.translationMode, 'local');
  const live = await driver.native('live_status');
  assert.equal(live.active, false);
  assert.equal(live.draft, null);
  assert.deepEqual(live.translationPreviews, []);
  const results = [];
  for (const label of [
    'mit-before',
    'mit-after',
    'mit-microphone',
    'mit-final',
  ]) {
    const original = JSON.parse(
      await fs.readFile(
        `target/local-latency/${label}/observation.json`,
        'utf8',
      ),
    );
    const reopened = await driver.native('lecture_detail', {
      id: original.lectureId,
    });
    assert.equal(reopened.lecture.status, 'completed');
    assert.deepEqual(reopened.segments, original.detail.segments);
    assert.equal(reopened.recordingWarning, original.detail.recordingWarning);
    assert.equal(
      reopened.lecture.durationSeconds,
      original.detail.lecture.durationSeconds,
    );
    results.push({
      label,
      recordingPreserved: true,
      finalTextPreserved: true,
      warningPreserved: true,
      segments: reopened.segments.length,
    });
  }
  await fs.writeFile(
    'target/local-latency/restart.json',
    JSON.stringify(
      {
        passed: true,
        provisionalStateCleared: true,
        preferencesPreserved: true,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, results }));
} finally {
  await driver.command('DELETE', '');
}
