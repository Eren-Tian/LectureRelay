// Installed production EXE; failures confined to the new acceptance course.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const root = path.resolve(
  process.env.LECTURERELAY_ACCEPTANCE_ROOT ||
    'target/acceptance-v0.3-2026-10-03',
);
const application =
  process.env.LECTURERELAY_INSTALLED_EXE ||
  path.join(root, 'app/lecturerelay-desktop.exe');
const course = '[ACCEPTANCE 2026-10-03] Local AI classroom';
const python =
  process.env.LECTURERELAY_TEST_PYTHON ||
  'C:/ProgramData/miniconda3/python.exe';
const d = await WebDriver.current();
const b = await d.native('bootstrap');
assert.equal(b.settings.provider, 'none');
assert.equal(b.settings.speechProvider, 'local');
assert.equal(b.settings.translationMode, 'local');
assert.equal(await d.native('recording_status'), null);
const checks = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, accept = Boolean, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await sleep(250);
  }
  throw Error('Fault acceptance timed out');
}
async function pass(name, details) {
  checks.push({ name, details, utc: new Date().toISOString() });
  await fs.writeFile(root + '/faults.json', JSON.stringify(checks, null, 2));
  console.log(name);
}
function inject(action, id) {
  const r = spawnSync(
    python,
    [
      'tests/e2e/fault-injection.py',
      action,
      '--exe',
      application,
      '--state',
      b.storage.state,
      '--lecture',
      id,
      '--course',
      course,
      '--backups',
      root + '/fault-backups',
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
async function start(name) {
  await wait(
    () => d.native('live_status'),
    (v) => !v.active,
  );
  await d.clickText('Courses');
  await wait(() => d.read('return !!document.querySelector(".course-card");'));
  await d.course(course);
  await d.clickText('Start Lecture');
  await d.click('.modal select option[value="system"]');
  await d.fill(
    '.modal input',
    '[ACCEPTANCE] v' + b.storage.version + ' fault ' + name + ' ' + Date.now(),
  );
  await d.clickText('Start Recording');
  const rec = await wait(() => d.native('recording_status'));
  const player = spawn(
    python,
    [
      'tests/e2e/play-audio.py',
      '--audio',
      'target/installed-acceptance/short.wav',
      '--seconds',
      '1',
      '--log',
      root + '/' + rec.lectureId + '-playback.jsonl',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  await sleep(9000);
  return { id: rec.lectureId, player };
}
async function save(id) {
  await d.clickText('Stop & save');
  await wait(
    () => d.native('recording_status'),
    (v) => v === null,
  );
  await wait(
    () => d.native('live_status'),
    (v) => !v.active,
    120000,
  );
  await wait(
    () => d.read('return document.querySelector("audio")?.readyState;'),
    (v) => v >= 1,
  );
  const detail = await d.native('lecture_detail', { id });
  assert.ok(detail.lecture.durationSeconds > 5);
  assert.ok(
    !(await d.read('return document.querySelector("audio").error?.code;')),
  );
  const rect = await d.read(
    'const r=document.querySelector("audio").getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};',
  );
  await d.clickAt(rect.x + 20, rect.y + rect.height / 2);
  await sleep(700);
  const playback = await d.read(
    'const a=document.querySelector("audio");return {paused:a.paused,time:a.currentTime,error:a.error?.code};',
  );
  assert.ok(
    !playback.paused && playback.time > 0 && !playback.error,
    'Saved fault recording did not play',
  );
  await d.clickAt(rect.x + 20, rect.y + rect.height / 2);
  await fs.writeFile(
    root + '/' + id + '-fault-detail.json',
    JSON.stringify({ detail, playback }, null, 2),
  );
  return detail;
}
let active;
try {
  active = await start('speech-worker');
  const fault = inject('worker', active.id);
  await wait(
    () => d.native('live_status'),
    (v) => v.state === 'unavailable',
  );
  const before = await d.native('recording_status');
  await sleep(5000);
  const after = await d.native('recording_status');
  assert.ok(
    !after.failed && after.durationSeconds > before.durationSeconds + 3,
  );
  const saved = await save(active.id);
  active.player.kill();
  await d.screenshot(`v${b.storage.version}-fault-speech`);
  await pass(
    'Killed speech worker leaves recording active and saved audio playable',
    { fault, lectureId: active.id, seconds: saved.lecture.durationSeconds },
  );
  active = await start('translation-worker');
  await wait(
    () => d.native('live_status'),
    (v) => v.translationQueue > 0,
    60000,
  );
  // The first queue publication precedes child creation; wait for the actual process.
  await wait(
    () => inject('workers', active.id),
    (v) => v.workers.some((p) => p.name === 'llama-server.exe'),
    30000,
  );
  const textFault = inject('text-worker', active.id);
  await wait(
    () => d.native('live_status'),
    (v) => v.translation.deferredIds.length > 0,
    30000,
  );
  const textBefore = await d.native('recording_status');
  await sleep(5000);
  const textAfter = await d.native('recording_status');
  assert.ok(
    !textAfter.failed &&
      textAfter.durationSeconds > textBefore.durationSeconds + 3,
  );
  const failureState = await d.native('live_status');
  const failureUi = await d.read(
    'return document.querySelector(".live-caption-area").innerText;',
  );
  assert.match(
    failureUi,
    /retried after class|another try|retry from lecture/i,
  );
  const textSaved = await save(active.id);
  active.player.kill();
  assert.ok(textSaved.segments.length > 0);
  await pass(
    'Killed translator preserves English/audio and exposes deferred translation',
    {
      fault: textFault,
      lectureId: active.id,
      seconds: textSaved.lecture.durationSeconds,
      deferred: failureState.translation.deferredIds.length,
      message: failureState.translation.message,
    },
  );
  active = await start('checkpoint-write');
  inject('checkpoint-on', active.id);
  let failed;
  try {
    failed = await wait(
      () => d.native('recording_status'),
      (v) => v.failed,
    );
    assert.match(failed.warning, /checkpoint/);
    await d.screenshot(`v${b.storage.version}-fault-write`);
  } finally {
    inject('checkpoint-off', active.id);
  }
  const interrupted = await save(active.id);
  active.player.kill();
  assert.equal(interrupted.lecture.status, 'interrupted');
  await pass(
    'Controlled checkpoint write failure reports error and preserves earlier WAV',
    {
      lectureId: active.id,
      warning: failed.warning,
      seconds: interrupted.lecture.durationSeconds,
    },
  );
  active = await start('app-crash');
  const beforeCrash = await d.native('recording_status');
  const crashed = inject('crash', active.id);
  active.player.kill();
  await fs.writeFile(
    root + '/crash-pending.json',
    JSON.stringify({ lectureId: active.id, beforeCrash, crashed }, null, 2),
  );
  await pass('Crash injected; restart verification remains pending', {
    lectureId: active.id,
  });
  console.log(
    'Restart the installed app, move native window to portrait, and verify crash-pending.json.',
  );
} finally {
  active?.player.kill();
}
