// Short installed acceptance only. Move the native outer frame to the permitted monitor first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';

const d = await WebDriver.current();
const root = process.env.LECTURERELAY_CONTINUITY_ROOT || 'target/ci-audio';
const sourceRoot = 'target/ci-audio';
await fs.mkdir(root, { recursive: true });
assert.equal(
  await fs.access(`${root}/installed-course.json`).then(
    () => true,
    () => false,
  ),
  false,
  'Preserve previous evidence: select a fresh LECTURERELAY_CONTINUITY_ROOT',
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (read, accept = Boolean, seconds = 120) => {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const value = await read();
    if (accept(value)) return value;
    await sleep(400);
  }
  throw Error('Installed continuity condition timed out');
};
const b = await d.native('bootstrap');
const original = JSON.parse(
  await fs.readFile(`${sourceRoot}/installed-original.json`, 'utf8'),
);
await fs.access(`${sourceRoot}/installed-before.db`);
await fs.access(`${sourceRoot}/installed-files.json`);
assert.equal(b.storage.database, original.storage.database);
assert.equal(b.storage.library, original.storage.library);
assert.equal(b.storage.version, '0.3.3');
assert.equal(b.settings.provider, 'none');
assert.equal(b.settings.speechProvider, 'local');
assert.equal(b.settings.translationMode, 'local');
assert.ok(b.settings.quietMode);
assert.equal(b.recording, null);
assert.equal((await d.native('live_status')).active, false);
assert.ok((await d.native('local_model_status')).installed);
if (!b.settings.liveTranslation) {
  await d.clickText('Settings');
  await d.clickText('AI Providers');
  await d.click('.settings-detail input[role="switch"]');
  await d.clickText('Save changes');
  await wait(
    () => d.native('bootstrap'),
    (v) => v.settings.liveTranslation,
  );
}
await d.clickText('Courses');
await d.clickText('New Course');
const name = `[ACCEPTANCE 2026-10-04] Audio continuity ${Date.now()}`;
await d.fill('.modal input[maxlength="150"]', name);
await d.fill(
  '.modal textarea',
  'Non-sensitive synthetic classroom speech and unique audio timing pilot. Local AI continuity verification.',
);
await d.clickText('Save Course');
await fs.writeFile(`${root}/installed-course.json`, JSON.stringify({ name }), {
  flag: 'wx',
});
function play(source, scenario) {
  const child = spawn(
    'python',
    [
      'tests/e2e/continuity-play.py',
      '--audio',
      `${sourceRoot}/${source}.wav`,
      '--log',
      `${root}/installed-${scenario}-playback.jsonl`,
    ],
    { windowsHide: true, stdio: 'inherit' },
  );
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(`Playback failed: ${code}`)),
    );
  });
}
for (const scenario of ['continuous', 'pause-idle']) {
  await d.clickText('Courses');
  await d.course(name);
  await d.clickText('Start Lecture');
  await d.click('.modal select option[value="system"]');
  const title = `[ACCEPTANCE] v0.3.3 ${scenario} local AI ${Date.now()}`;
  await d.fill('.modal input', title);
  await d.clickText('Start Recording');
  const recording = await wait(() => d.native('recording_status'));
  const start = performance.now();
  await fs.writeFile(
    `${root}/installed-${scenario}-pending.json`,
    JSON.stringify({ title, id: recording.lectureId }),
  );
  await sleep(2000);
  const playback = play('source', scenario);
  if (scenario === 'pause-idle') {
    await sleep(10000);
    await d.clickText('Pause');
    await sleep(2000);
    await d.clickText('Resume');
  }
  await playback;
  if (scenario === 'pause-idle') {
    await sleep(3000);
    await play('tail', scenario);
  }
  await sleep(2000);
  const captions = await wait(
    () =>
      d.read(
        'return [...document.querySelectorAll(".live-caption")].map(e=>({en:e.querySelector(".caption-english")?.textContent,translation:e.querySelector(".caption-translation")?.textContent}));',
      ),
    (rows) => rows.filter((r) => r.en && r.translation).length >= 2,
  );
  await d.screenshot(`v033-${path.basename(root)}-${scenario}-bilingual`);
  const stopAt = performance.now();
  await d.clickText('Stop & save');
  await wait(
    () => d.native('recording_status'),
    (v) => v === null,
    15,
  );
  const stopMs = performance.now() - stopAt;
  await wait(
    () => d.native('live_status'),
    (v) => !v.active,
  );
  const detail = await d.native('lecture_detail', { id: recording.lectureId });
  assert.equal(detail.lecture.status, 'completed');
  assert.ok(detail.segments.length >= 2);
  assert.ok(
    detail.segments.every(
      (s) => s.origin === 'local' && s.provider === 'local' && s.translatedText,
    ),
  );
  const directory = path.join(
    b.storage.library,
    'Courses',
    detail.course.id,
    recording.lectureId,
  );
  const trace = JSON.parse(
    await fs.readFile(path.join(directory, 'recording-events.json'), 'utf8'),
  );
  assert.ok(trace.complete);
  assert.equal(trace.acceptedButUnwrittenSamples, 0);
  assert.equal(trace.discardedQueueFullSamples, 0);
  assert.equal(trace.persistenceFailures, 0);
  const quality = JSON.parse(
    await fs.readFile(path.join(directory, 'recording-quality.json'), 'utf8'),
  );
  assert.equal(detail.recordingWarning, quality.warning);
  if (quality.warning)
    assert.ok(
      await d.read('return document.body.innerText.includes(arguments[0]);', [
        quality.warning,
      ]),
    );
  await d.click('.transcript-segment .timestamp');
  await sleep(1200);
  assert.ok(
    await d.read(
      'const a=document.querySelector("audio");return a.currentTime>0&&!a.paused&&!a.error;',
    ),
  );
  await d.clickText('Courses');
  const result = {
    scenario,
    name,
    title,
    id: recording.lectureId,
    elapsedSeconds: (performance.now() - start) / 1000,
    stopMs,
    recording: path.join(directory, 'recording.wav'),
    captions,
    detail,
    quality,
    trace,
  };
  await fs.writeFile(
    `${root}/installed-${scenario}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      scenario,
      stopMs,
      savedSeconds: detail.lecture.durationSeconds,
      segments: detail.segments.length,
      quality,
    }),
  );
}
// Leave live translation enabled for the subsequent plain-app long run.
// Restore the saved original preference through Settings after that run.
