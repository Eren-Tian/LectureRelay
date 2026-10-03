import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const output = path.resolve('target/installed-acceptance');
const application = path.join(output, 'app/lecturerelay-desktop.exe');
const python =
  process.env.LECTURERELAY_TEST_PYTHON ||
  'C:/ProgramData/miniconda3/python.exe';
let driver = await WebDriver.current();
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, predicate, seconds = 45) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await sleep(250);
  }
  throw new Error('Fault assertion timed out');
}
const bootstrap = await driver.native('bootstrap');
assert.equal(bootstrap.settings.provider, 'none');
const testCourse = bootstrap.courses.find(
  (c) => c.name === '[ACCEPTANCE 2026-09-30] Classroom',
);
assert(testCourse);
async function start(title) {
  await wait(
    () => driver.native('live_status'),
    (v) => !v.active,
  );
  await driver.clickText('Courses');
  await driver.course(testCourse.name);
  await wait(
    () =>
      driver.read(
        'return [...document.querySelectorAll("button")].some(e=>e.innerText.trim()==="Start Lecture"&&!e.disabled);',
      ),
    Boolean,
  );
  await driver.clickText('Start Lecture');
  await driver.click('.modal select option[value="system"]');
  await driver.fill('.modal input', title);
  await driver.clickText('Start Recording');
  const recording = await wait(
    () => driver.native('recording_status'),
    Boolean,
  );
  const player = spawn(
    python,
    [
      'tests/e2e/play-audio.py',
      '--audio',
      'target/installed-acceptance/short.wav',
      '--seconds',
      '1',
      '--log',
      `${output}/${recording.lectureId}-playback.jsonl`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  await sleep(8000);
  return { id: recording.lectureId, player };
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
      bootstrap.storage.state,
      '--lecture',
      id,
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
async function save(id) {
  await driver.clickText('Stop & save');
  await wait(
    () => driver.native('live_status'),
    (v) => !v.active,
  );
  const detail = await driver.native('lecture_detail', { id });
  assert(detail.lecture.durationSeconds > 5);
  await wait(
    () => driver.read('return document.querySelector("audio")?.readyState;'),
    (v) => v >= 1,
  );
  assert(
    !(await driver.read(
      'return document.querySelector("audio")?.error?.code;',
    )),
  );
  return detail;
}
try {
  let { id, player } = await start('[ACCEPTANCE] STT worker exit');
  const fault = inject('worker', id);
  await wait(
    () => driver.native('live_status'),
    (v) => v.state === 'unavailable',
  );
  const before = await driver.native('recording_status');
  await sleep(4000);
  const after = await driver.native('recording_status');
  assert(!after.failed && after.durationSeconds > before.durationSeconds + 2);
  assert(
    (
      await driver.read('return document.querySelector("main").innerText;')
    ).includes('Recording'),
  );
  const preserved = await save(id);
  player.kill();
  assert(
    await driver.read(
      'return [...document.querySelectorAll("[role=alert]")].some(e=>e.innerText.includes("saved recording"));',
    ),
  );
  await driver.screenshot('fault-worker-exit');
  results.push({
    name: 'STT worker exit keeps recording',
    passed: true,
    fault,
    duration: preserved.lecture.durationSeconds,
  });
  ({ id, player } = await start('[ACCEPTANCE] checkpoint write failure'));
  inject('checkpoint-on', id);
  try {
    const failed = await wait(
      () => driver.native('recording_status'),
      (v) => v.failed,
    );
    assert(failed.warning.includes('checkpoint'));
    results.push({
      name: 'Controlled checkpoint write failure is explicit',
      passed: true,
      duration: failed.durationSeconds,
      warning: failed.warning,
    });
    await driver.screenshot('fault-checkpoint');
  } finally {
    inject('checkpoint-off', id);
  }
  const interrupted = await save(id);
  player.kill();
  assert.equal(interrupted.lecture.status, 'interrupted');
  results.push({
    name: 'Write failure preserves playable earlier audio',
    passed: true,
    duration: interrupted.lecture.durationSeconds,
  });
  ({ id, player } = await start('[ACCEPTANCE] unexpected app exit'));
  const beforeCrash = await driver.native('recording_status');
  inject('crash', id);
  player.kill();
  try {
    await driver.command('DELETE', '');
  } catch {}
  driver = await WebDriver.start(application);
  await wait(
    () => driver.read('return !!document.querySelector(".course-card");'),
    Boolean,
  );
  const recovered = await driver.native('lecture_detail', { id });
  assert.equal(recovered.lecture.status, 'interrupted');
  assert(
    recovered.lecture.durationSeconds >= beforeCrash.durationSeconds - 1.5,
  );
  await driver.course(testCourse.name);
  await driver.lecture(recovered.lecture.title);
  await wait(
    () => driver.read('return document.querySelector("audio")?.readyState;'),
    (v) => v >= 1,
  );
  assert(
    (await driver.read('return document.querySelector("main").innerText;'))
      .toLowerCase()
      .includes('interrupted'),
  );
  await driver.screenshot('fault-crash-recovered');
  results.push({
    name: 'Unexpected app exit recovers checkpointed audio on restart',
    passed: true,
    duration: recovered.lecture.durationSeconds,
    beforeCrash: beforeCrash.durationSeconds,
  });
  await fs.writeFile(
    path.join(output, 'faults.json'),
    JSON.stringify({ passed: true, results }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  await fs.writeFile(
    path.join(output, 'faults.json'),
    JSON.stringify({ passed: false, error: String(error), results }, null, 2),
  );
  throw error;
}
