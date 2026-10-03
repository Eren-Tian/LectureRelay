// Installed WebView + native worker acceptance; labelled fixtures and no cloud calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const root = path.resolve('target/preferences-iteration');
const executable = path.join(root, 'app/lecturerelay-desktop.exe');
const original = JSON.parse(
  await fs.readFile(path.join(root, 'original-settings.json'), 'utf8'),
);
const report = { checks: [] };
let driver = await WebDriver.current();
let player;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function wait(read, accept = Boolean, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await sleep(150);
  }
  throw Error('Preference acceptance timed out');
}
function pass(name, details) {
  report.checks.push({ name, details });
  console.log(name);
}
async function choose(selector, value) {
  await driver.click(`${selector} option[value="${value}"]`);
}
async function theme(value) {
  await driver.click(`.theme-option:nth-child(${value === 'light' ? 1 : 2})`);
  await wait(
    () => driver.read('return document.documentElement.dataset.theme;'),
    (v) => v === value,
  );
}
async function quiet(value) {
  if ((await driver.native('bootstrap')).settings.quietMode !== value)
    await driver.click('input[aria-label="Quiet Mode"]');
  await wait(
    () => driver.native('bootstrap'),
    (v) => v.settings.quietMode === value,
  );
}
function audio() {
  player = spawn(
    'C:/ProgramData/miniconda3/python.exe',
    [
      'tests/e2e/play-audio.py',
      '--audio',
      'target/installed-acceptance/short.wav',
      '--seconds',
      '1',
      '--log',
      path.join(root, 'audio-playback.jsonl'),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
}
function worker() {
  const command =
    "Get-Process -Name asr-worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*preferences-iteration*' } | ForEach-Object { [pscustomobject]@{pid=$_.Id; mask=$_.ProcessorAffinity.ToInt64().ToString('X'); threads=$_.Threads.Count} } | ConvertTo-Json -Compress";
  const output = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-Command', command],
    { windowsHide: true, encoding: 'utf8' },
  ).trim();
  return output ? JSON.parse(output) : null;
}
function bits(hex) {
  return BigInt(`0x${hex}`).toString(2).replaceAll('0', '').length;
}
async function layout(name) {
  const result = await driver.read(
    "return {width:innerWidth,height:innerHeight,overflow:document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+1,logos:document.querySelectorAll('img[src=\"/app-icon.svg\"]').length,theme:document.documentElement.dataset.theme};",
  );
  assert.equal(result.overflow, false, name);
  assert.equal(result.logos, 1, name);
  await driver.screenshot(`preferences-${name}`);
  return result;
}
async function settings() {
  await driver.clickText('Settings');
  await driver.clickText('General');
}
try {
  await wait(() => driver.read("return !!document.querySelector('.sidebar');"));
  assert.equal(
    await driver.native('recording_status'),
    null,
    'Do not interrupt an existing recording',
  );
  assert.equal((await driver.native('bootstrap')).settings.provider, 'none');
  await settings();
  await choose('.settings-detail select', 'ja');
  await theme('light');
  await theme('dark');
  await quiet(false);
  assert.equal(
    await driver.read(
      "return document.querySelector('.settings-detail select').value;",
    ),
    'ja',
  );
  assert.equal(
    (await driver.native('bootstrap')).settings.assistanceLanguage,
    original.assistanceLanguage,
  );
  await driver.clickText('Reset changes');
  pass(
    'Theme and performance save immediately without losing other unsaved edits',
  );
  for (const category of [
    'General',
    'Audio',
    'Live Captions',
    'AI Providers',
    'Local AI',
    'Data',
    'Security & Privacy',
    'About',
  ]) {
    await driver.clickText(category);
    await layout(`dark-${category.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`);
  }
  await driver.command('DELETE', '');
  await sleep(500);
  driver = await WebDriver.start(executable);
  await wait(
    () => driver.read('return document.documentElement.dataset.theme;'),
    (v) => v === 'dark',
  );
  assert.equal((await driver.native('bootstrap')).settings.quietMode, false);
  pass(
    'Dark theme and disabled Quiet Mode survive a real installed-app restart',
  );
  await settings();
  await quiet(true);
  await driver.clickText('Audio');
  await wait(() =>
    driver.read(
      "return !document.querySelectorAll('.settings-detail select')[1].disabled;",
    ),
  );
  await choose('.settings-detail select:nth-of-type(1)', 'system');
  // The first settings select is the source; device selections stay on Windows default.
  await driver.clickText('Save changes');
  await wait(
    () => driver.native('bootstrap'),
    (v) => v.settings.audioSource === 'system',
  );
  const beforeTest = (await driver.native('bootstrap')).courses.reduce(
    (n, c) => n + c.lectureCount,
    0,
  );
  audio();
  await driver.clickText('Test audio input');
  await wait(
    () =>
      driver.read(
        "return document.querySelector('.audio-input-test').innerText;",
      ),
    (v) => v.includes('Audio detected'),
  );
  const peak = await driver.read(
    "return document.querySelector('.audio-input-test meter').value;",
  );
  assert.ok(peak > 0.002);
  assert.equal(
    (await driver.native('bootstrap')).courses.reduce(
      (n, c) => n + c.lectureCount,
      0,
    ),
    beforeTest,
  );
  player.kill();
  player = null;
  pass(
    'Real system audio preview detects the fixture without creating a lecture',
    { peak },
  );
  await driver.clickText('Courses');
  await driver.course('[ACCEPTANCE 2026-09-30] Classroom');
  await driver.clickText('Start Lecture');
  await wait(() =>
    driver.read(
      "return !document.querySelectorAll('.modal select')[1].disabled;",
    ),
  );
  await layout('dark-start-dialog');
  await driver.fill('.modal input', '[ACCEPTANCE] preferences ' + Date.now());
  await driver.clickText('Start Recording');
  const recording = await wait(() => driver.native('recording_status'));
  report.lectureId = recording.lectureId;
  audio();
  const reduced = await wait(() => worker());
  assert.ok(bits(reduced.mask) <= 4);
  await wait(
    () => driver.native('live_status'),
    (v) => v.segments.length > 0,
  );
  await layout('dark-live');
  await settings();
  await quiet(false);
  await theme('light');
  const full = worker();
  assert.equal(full.pid, reduced.pid);
  assert.ok(bits(full.mask) >= bits(reduced.mask));
  const during = await driver.native('recording_status');
  assert.equal(during.lectureId, recording.lectureId);
  assert.ok(during.durationSeconds > recording.durationSeconds);
  await quiet(true);
  const restored = worker();
  assert.equal(restored.pid, reduced.pid);
  assert.equal(restored.mask, reduced.mask);
  await theme('dark');
  pass(
    'Live Quiet on/off/on updates the same native worker without interrupting recording',
    { reduced, full, restored },
  );
  await driver.click('.sidebar-recording');
  await driver.command('POST', '/window/rect', { width: 880, height: 620 });
  await layout('dark-live-compact');
  const controls = await driver.read(
    "return {bottom:document.querySelector('.classroom-controls').getBoundingClientRect().bottom,height:innerHeight};",
  );
  assert.ok(controls.bottom <= controls.height);
  await driver.clickText('Pause');
  await sleep(250);
  const paused = await driver.native('recording_status');
  await sleep(500);
  assert.equal(
    (await driver.native('recording_status')).durationSeconds,
    paused.durationSeconds,
  );
  await driver.clickText('Resume');
  await sleep(700);
  await driver.clickText('Stop & save');
  player.kill();
  player = null;
  await wait(
    () => driver.native('recording_status'),
    (v) => !v,
  );
  await wait(
    () => driver.native('live_status'),
    (v) => !v.active,
  );
  const detail = await driver.native('lecture_detail', {
    id: recording.lectureId,
  });
  assert.ok(detail.segments.length > 0);
  assert.ok(detail.lecture.durationSeconds > 5);
  report.recording = detail.lecture;
  await wait(() =>
    driver.read("return document.querySelector('audio')?.readyState>=1;"),
  );
  await choose('select[aria-label="Playback speed"]', '1.5');
  assert.equal(
    await driver.read("return document.querySelector('audio').playbackRate;"),
    1.5,
  );
  await driver.click('button[aria-label="Forward 10 seconds"]');
  assert.ok(
    (await driver.read("return document.querySelector('audio').currentTime;")) >
      0,
  );
  await driver.click('button[aria-label="Back 10 seconds"]');
  const word = detail.segments[0].sourceText.trim().split(/\s+/)[0];
  await driver.fill('input[aria-label="Search transcript"]', word);
  assert.ok(
    await driver.read(
      "return document.querySelectorAll('.transcript-segment mark').length;",
    ),
  );
  await driver.fill(
    'input[aria-label="Search transcript"]',
    '[no matching caption]',
  );
  assert.equal(
    await driver.read(
      "return document.querySelectorAll('.transcript-segment').length;",
    ),
    0,
  );
  await driver.clickText('Clear search');
  assert.equal(
    await driver.read(
      "return document.querySelectorAll('.transcript-segment').length;",
    ),
    detail.segments.length,
  );
  await driver.click('.timestamp');
  await wait(() =>
    driver.read("return !document.querySelector('audio').paused;"),
  );
  await driver.read("document.querySelector('audio').pause(); return true;");
  await layout('dark-replay-compact');
  await driver.command('POST', '/window/rect', { width: 1180, height: 780 });
  await layout('dark-replay');
  pass(
    'Pause/resume/save, searchable transcript, speed control and timestamp playback',
    {
      segments: detail.segments.length,
      duration: detail.lecture.durationSeconds,
    },
  );
  await settings();
  await theme('light');
  await layout('light-general');
  await driver.clickText('Courses');
  await layout('light-courses');
  pass(
    'Light and Dark layouts retain one title logo and fit normal and compact windows',
  );
  report.success = true;
} finally {
  player?.kill();
  const recording = await driver.native('recording_status').catch(() => null);
  if (recording && recording.lectureId === report.lectureId) {
    await driver.click('.sidebar-recording');
    await driver.clickText('Stop & save');
    await wait(
      () => driver.native('live_status'),
      (v) => !v.active,
    );
  }
  await settings();
  await theme(original.theme);
  await quiet(original.quietMode);
  await driver.clickText('Audio');
  await wait(() =>
    driver.read(
      "return !document.querySelectorAll('.settings-detail select')[1].disabled;",
    ),
  );
  await choose('.settings-detail select:nth-of-type(1)', original.audioSource);
  if (
    await driver.read(
      "return [...document.querySelectorAll('button')].some(e=>e.innerText.trim()==='Save changes'&&!e.disabled);",
    )
  )
    await driver.clickText('Save changes');
  const saved = await driver.native('bootstrap');
  assert.deepEqual(saved.settings, original);
  await fs.writeFile(
    path.join(root, 'installed-results.json'),
    JSON.stringify(report, null, 2),
  );
}
