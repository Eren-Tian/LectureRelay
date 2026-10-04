// Run only after moving the installed native outer window onto the allowed monitor.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const d = await WebDriver.current();
const root = 'target/engineering-audit';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (read, accept = Boolean, ms = 180000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await pause(200);
  }
  throw Error('Installed audit wait timed out');
};
const original = await d.native('bootstrap');
assert.equal(original.storage.version, '0.3.2');
assert.equal(original.settings.provider, 'none');
assert.equal(original.settings.speechProvider, 'local');
assert.equal(original.settings.translationMode, 'local');
assert.equal(original.recording, null);
assert.equal(original.job, null);
assert.equal((await d.native('live_status')).active, false);
await fs.writeFile(
  `${root}/installed-original.json`,
  JSON.stringify(original, null, 2),
  { flag: 'wx' },
);
const baseline = spawnSync(
  'python',
  ['tests/e2e/audit-preservation.py', 'before'],
  { windowsHide: true, encoding: 'utf8' },
);
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
console.log(baseline.stdout.trim());
await d.clickText('Settings');
for (const theme of ['dark', 'light']) {
  await d.click(`.theme-option:has(.theme-preview.${theme})`);
  await wait(
    () => d.native('bootstrap'),
    (b) => b.settings.theme === theme,
  );
  await pause(250);
  const muted = await d.read(
    'return getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();',
  );
  assert.equal(muted, theme === 'dark' ? '#b8c6b4' : '#505e54');
  await d.screenshot(`v032-settings-${theme}`);
}
if (original.settings.theme !== 'light') {
  await d.click(`.theme-option:has(.theme-preview.${original.settings.theme})`);
  await wait(
    () => d.native('bootstrap'),
    (b) => b.settings.theme === original.settings.theme,
  );
}
await d.clickText('AI Providers');
if (!original.settings.liveTranslation) {
  await d.click('.settings-detail input[role="switch"]');
  await d.clickText('Save changes');
  await wait(
    () => d.native('bootstrap'),
    (b) => b.settings.liveTranslation,
  );
}
await d.clickText('Courses');
await d.clickText('New Course');
const name = `[ACCEPTANCE 2026-10-03] Engineering audit ${Date.now()}`;
await d.fill('.modal input[maxlength="150"]', name);
await d.fill(
  '.modal textarea',
  'Synthetic biology classroom for recording, local translation and readability verification. 中文 日本語 한국어',
);
await d.clickText('Save Course');
await d.clickText('Start Lecture');
await d.click('.modal select option[value="system"]');
const title = `[ACCEPTANCE] v0.3.2 recording and contrast ${Date.now()}`;
await d.fill('.modal input', title);
await d.clickText('Start Recording');
const rec = await wait(() => d.native('recording_status'));
const id = rec.lectureId;
await fs.writeFile(
  `${root}/installed-pending.json`,
  JSON.stringify({ id, name, title }, null, 2),
);
const player = spawn(
  'python',
  [
    '-X',
    'utf8',
    'tests/e2e/play-audio.py',
    '--audio',
    'target/installed-acceptance/soak.wav',
    '--seconds',
    '1',
    '--log',
    `${root}/installed-playback.jsonl`,
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let completed = false;
try {
  await pause(65000);
  const captions = await wait(
    () =>
      d.read(
        'return [...document.querySelectorAll(".live-caption")].map(e=>({en:e.querySelector(".caption-english")?.textContent,translation:e.querySelector(".caption-translation")?.textContent}));',
      ),
    (rows) => rows.filter((r) => r.en && r.translation).length >= 3,
  );
  await d.screenshot('v032-live-captions');
  await d.clickText('Pause');
  await wait(
    () => d.native('recording_status'),
    (v) => v.paused,
  );
  const paused = await d.native('recording_status');
  await pause(1000);
  assert.equal(
    (await d.native('recording_status')).durationSeconds,
    paused.durationSeconds,
  );
  await d.clickText('Resume');
  await wait(
    () => d.native('recording_status'),
    (v) => !v.paused,
  );
  await pause(1000);
  const beforeStop = await d.native('recording_status');
  const stoppedAt = Date.now();
  await d.clickText('Stop & save');
  await wait(
    () => d.native('recording_status'),
    (v) => v === null,
    15000,
  );
  const stopMs = Date.now() - stoppedAt;
  await wait(
    () => d.native('live_status'),
    (v) => !v.active,
  );
  player.kill();
  const detail = await d.native('lecture_detail', { id });
  assert.equal(detail.lecture.status, 'completed');
  assert.ok(detail.segments.length >= 3);
  assert.ok(
    detail.segments.every(
      (s) => s.origin === 'local' && s.provider === 'local' && s.translatedText,
    ),
  );
  const directory = path.join(
    original.storage.library,
    'Courses',
    detail.course.id,
    id,
  );
  const quality = JSON.parse(
    await fs.readFile(path.join(directory, 'recording-quality.json'), 'utf8'),
  );
  assert.equal(quality.failed, false);
  assert.equal(
    quality.droppedChunks,
    quality.droppedBuffers + quality.deviceDiscontinuities,
  );
  assert.equal(detail.recordingWarning, quality.warning);
  if (quality.warning)
    await wait(() =>
      d.read('return document.body.innerText.includes(arguments[0]);', [
        quality.warning,
      ]),
    );
  await d.click('.transcript-segment .timestamp');
  await pause(1000);
  assert.ok(
    await d.read(
      'const a=document.querySelector("audio");return a.currentTime>0&&!a.paused&&!a.error;',
    ),
  );
  await d.screenshot('v032-saved-warning');
  // Navigating away unmounts the audio element and stops replay.
  await d.clickText('Settings');
  await d.clickText('AI Providers');
  if (!original.settings.liveTranslation) {
    await d.click('.settings-detail input[role="switch"]');
    await d.clickText('Save changes');
  }
  await wait(
    () => d.native('bootstrap'),
    (b) => JSON.stringify(b.settings) === JSON.stringify(original.settings),
  );
  await d.clickText('Courses');
  const report = {
    passed: true,
    version: '0.3.2',
    name,
    title,
    id,
    stopMs,
    pauseResume: true,
    timestampPlayback: true,
    themes: ['light', 'dark'],
    beforeStop,
    quality,
    captions,
    detail,
    recording: path.join(directory, 'recording.wav'),
  };
  await fs.writeFile(
    `${root}/installed-short.json`,
    JSON.stringify(report, null, 2),
  );
  completed = true;
  console.log(
    JSON.stringify({
      passed: true,
      id,
      stopMs,
      segments: detail.segments.length,
      quality,
    }),
  );
} finally {
  player.kill();
  if (!completed)
    console.error(
      'Controller did not finish. Inspect the active recording and restore preferences from installed-original.json; preserve the baseline.',
    );
}
