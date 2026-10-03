import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';

const output = path.resolve('target/installed-acceptance');
const application = path.join(output, 'app/lecturerelay-desktop.exe');
let driver = await WebDriver.current();
const evidence = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(read, predicate, seconds = 60) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await sleep(250);
  }
  throw new Error('Acceptance condition timed out');
}
function passed(name, details) {
  evidence.push({ name, passed: true, utc: new Date().toISOString(), details });
  console.log(name);
}
try {
  const bootstrap = await driver.native('bootstrap');
  assert.equal(
    bootstrap.settings.provider,
    'none',
    'No cloud requests authorized',
  );
  assert.equal(bootstrap.settings.speechProvider, 'local');
  assert.equal((await driver.native('local_model_status')).installed, true);
  const course = bootstrap.courses.find(
    (c) => c.name === '[ACCEPTANCE 2026-09-30] Classroom',
  );
  assert(course);
  assert(course.description.includes('中文 日本語 한국어'));
  passed('Installed model and course context persisted', {
    courseId: course.id,
  });
  await driver.clickText('Courses');
  await driver.course(course.name);
  await waitFor(
    () => driver.native('live_status'),
    (v) => !v.active,
    45,
  );
  await waitFor(
    () =>
      driver.read(
        'return [...document.querySelectorAll("button")].some(e=>e.innerText.trim()==="Start Lecture" && !e.disabled);',
      ),
    Boolean,
  );
  assert(
    (await driver.native('course_detail', { id: course.id })).glossary.some(
      (t) => t.source === 'mitochondria',
    ),
  );
  await driver.clickText('Start Lecture');
  await driver.click('.modal select option[value="system"]');
  await waitFor(
    () =>
      driver.read(
        'return document.querySelectorAll(".modal select")[1]?.innerText;',
      ),
    (v) => v?.includes('Default'),
  );
  const classTitle = `[ACCEPTANCE] installed student flow ${Date.now()}`;
  await driver.fill('.modal input', classTitle);
  await driver.clickText('Start Recording');
  const recording = await waitFor(
    () => driver.native('recording_status'),
    (v) => !!v,
  );
  const id = recording.lectureId;
  const started = Date.now();
  const player = spawn(
    process.env.LECTURERELAY_TEST_PYTHON ||
      'C:/ProgramData/miniconda3/python.exe',
    [
      'tests/e2e/play-audio.py',
      '--audio',
      'target/installed-acceptance/short.wav',
      '--seconds',
      '1',
      '--log',
      'target/installed-acceptance/final-short-playback.jsonl',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  const playerFinished = new Promise((resolve, reject) => {
    player.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Player exit ${code}`)),
    );
    player.on('error', reject);
  });
  await waitFor(
    () =>
      driver.read(
        'return document.querySelector(".caption-scroll")?.innerText;',
      ),
    (v) => v?.includes('Today we will examine'),
  );
  passed('Real WASAPI audio to visible English caption', {
    lectureId: id,
    firstCaptionFromPlaybackMs: Date.now() - started,
  });
  await waitFor(
    () =>
      driver.read(
        'const e=document.querySelector(".caption-scroll");return e?e.scrollHeight-e.clientHeight:0;',
      ),
    (v) => v > 150,
  );
  await driver.scroll('.caption-scroll', -900);
  await waitFor(
    () => driver.read('return !!document.querySelector(".jump-live");'),
    Boolean,
  );
  await driver.clickText('Jump to Live');
  assert(
    await driver.read(
      'const e=document.querySelector(".caption-scroll"); return e.scrollHeight-e.clientHeight-e.scrollTop<5;',
    ),
  );
  passed('Scroll history and Jump to Live');
  await driver.clickText('Pause');
  await sleep(500);
  const paused = await driver.native('recording_status');
  await sleep(4000);
  assert.equal(
    (await driver.native('recording_status')).durationSeconds,
    paused.durationSeconds,
  );
  await driver.clickText('Resume');
  passed('Pause excludes audio time and resume works', { pauseSeconds: 4 });
  await playerFinished;
  await driver.clickText('Stop & save');
  const processingBanner = await driver.read(
    'return [...document.querySelectorAll("[role=status]")].map(e=>e.innerText).find(t=>t.includes("Recording saved"));',
  );
  await driver.screenshot('final-short-stopped');
  await waitFor(
    () => driver.native('live_status'),
    (v) => !v.active,
    45,
  );
  const detail = await driver.native('lecture_detail', { id });
  assert.equal(detail.lecture.status, 'completed');
  assert(detail.segments.length > 3);
  passed('Stop saved audio independently of AI finalization', {
    duration: detail.lecture.durationSeconds,
    segments: detail.segments.length,
    processingBanner: processingBanner || null,
  });
  await driver.click('.transcript-segment:nth-child(2) .timestamp');
  await sleep(700);
  const audio = await driver.read(
    'const a=document.querySelector("audio"); return {duration:a.duration,position:a.currentTime,paused:a.paused,error:a.error?.code};',
  );
  assert(!audio.paused && !audio.error);
  assert(audio.position >= detail.segments[1].startSeconds);
  await driver.read('document.querySelector("audio").pause(); return true;');
  passed('Timestamp starts actual installed audio playback', audio);
  await driver.click('.segment-edit');
  await driver.fill(
    '.modal textarea',
    '[ACCEPTANCE EDIT] Installed application correction.',
  );
  await driver.fill(
    '.modal label:last-of-type textarea',
    '中文 日本語 한국어 — 已人工校正',
  );
  await driver.clickText('Save Transcript');
  await waitFor(
    () => driver.read('return !!document.querySelector(".modal");'),
    (v) => !v,
  );
  await driver.clickText('JSON');
  await driver.clickText('Markdown');
  const exportNames = (await fs.readdir(bootstrap.storage.exports)).filter(
    (n) => n.includes(id),
  );
  assert(exportNames.length >= 2);
  passed('Edit and JSON/Markdown export', { exportNames });
  await driver.clickText(course.name);
  await driver.click('.course-delete');
  await driver.click('.modal .danger');
  await driver.clickText('Settings');
  await driver.clickText('Data');
  await driver.clickText('Restore');
  passed('Trash and restore keep course data');
  await driver.command('DELETE', '');
  driver = await WebDriver.start(application);
  await waitFor(
    () => driver.read('return !!document.querySelector(".course-card");'),
    Boolean,
  );
  await driver.course(course.name);
  await driver.lecture(classTitle);
  const reopened = await driver.native('lecture_detail', { id });
  assert.equal(
    reopened.segments[0].sourceText,
    '[ACCEPTANCE EDIT] Installed application correction.',
  );
  assert.equal(
    reopened.segments[0].translatedText,
    '中文 日本語 한국어 — 已人工校正',
  );
  assert.equal(
    reopened.lecture.durationSeconds,
    detail.lecture.durationSeconds,
  );
  passed('Restart preserves recording, transcript correction and UTF-8');
  await driver.screenshot('final-short-restarted');
  await fs.writeFile(
    path.join(output, 'student-flow.json'),
    JSON.stringify({ passed: true, evidence }, null, 2),
  );
} catch (error) {
  await fs.writeFile(
    path.join(output, 'student-flow.json'),
    JSON.stringify({ passed: false, error: String(error), evidence }, null, 2),
  );
  throw error;
}
