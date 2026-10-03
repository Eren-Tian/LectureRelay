// Native installed-app acceptance. Only labelled test classes, no cloud calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const output = path.resolve('target/product-iteration');
const executable = path.join(output, 'app/lecturerelay-desktop.exe');
let driver = await WebDriver.current();
const evidence = [];
let player;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, predicate = Boolean, seconds = 40) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const value = await read();
    if (predicate(value)) return value;
    await sleep(200);
  }
  throw new Error('Product acceptance timed out');
}
function pass(name, details) {
  evidence.push({ name, details });
  console.log(name);
}
async function choose(label, value) {
  const option = await driver.read(
    "const label=[...document.querySelectorAll('.settings-detail label')].find(e=>e.firstChild?.textContent.trim()===arguments[0]);return [...label.querySelector('select').options].find(o=>o.value===arguments[1]);",
    [label, value],
  );
  assert.ok(option, label);
  await driver.command(
    'POST',
    `/element/${option['element-6066-11e4-a52e-4f735466cecf']}/click`,
    {},
  );
}
try {
  const original = await driver.native('bootstrap');
  const resuming = process.argv.includes('--resume');
  if (resuming)
    original.settings = JSON.parse(
      await fs.readFile(path.join(output, 'original-preferences.json'), 'utf8'),
    );
  assert.equal(
    original.settings.provider,
    'none',
    'Cloud testing is not authorized',
  );
  assert.equal(original.settings.speechProvider, 'local');
  assert.equal((await driver.native('local_model_status')).installed, true);
  if (!resuming)
    await fs.writeFile(
      path.join(output, 'original-preferences.json'),
      JSON.stringify(original.settings, null, 2),
    );
  if (await driver.read("return !!document.querySelector('.modal');"))
    await driver.clickText('Cancel');
  await driver.clickText('Settings');
  await choose('Default translation language', 'ja');
  await driver.clickText('Audio');
  await wait(() =>
    driver.read(
      "return !document.querySelectorAll('.settings-detail select')[1].disabled;",
    ),
  );
  await choose('Default audio source', 'system');
  const preferred = await driver.read(
    "return [...document.querySelectorAll('.settings-detail select')].slice(1).map(select=>[...select.options].find(option=>option.textContent.endsWith('(default)'))?.value || '');",
  );
  await choose('Microphone device', preferred[0]);
  await choose('System playback device', preferred[1]);
  await driver.screenshot('design-settings-audio');
  await driver.clickText('Live Captions');
  await driver.click('.toggle-row:nth-child(1) input');
  await driver.click('.toggle-row:nth-child(2) input');
  assert.deepEqual(
    await driver.read(
      "return [...document.querySelectorAll('.toggle-row input')].slice(0,2).map(e=>e.checked);",
    ),
    [true, false],
  );
  await driver.click('.toggle-row:nth-child(2) input');
  await driver.screenshot('design-settings-captions');
  await driver.clickText('AI Providers');
  const checked = await driver.read(
    "return document.querySelector('.toggle-row input').checked;",
  );
  if (!checked) await driver.click('.toggle-row input');
  await driver.screenshot('design-settings-providers');
  await driver.clickText('Local AI');
  assert.match(
    await driver.read(
      "return document.querySelector('.settings-detail').innerText;",
    ),
    /Ready/,
  );
  await driver.clickText('Data');
  await wait(
    () =>
      driver.read(
        "return document.querySelector('.storage-usage')?.innerText;",
      ),
    (v) => v?.includes('Local models'),
  );
  await driver.screenshot('design-settings-data');
  await driver.clickText('Security & Privacy');
  assert.equal(
    await driver.read("return document.querySelector('.key-form input').type;"),
    'password',
  );
  await driver.clickText('About');
  await driver.screenshot('design-settings-about');
  await driver.clickText('General');
  assert.equal(
    await driver.read(
      "return document.querySelector('.settings-detail select').value;",
    ),
    'ja',
  );
  await driver.clickText('Save changes');
  await wait(
    () => driver.native('bootstrap'),
    (v) => v.settings.assistanceLanguage === 'ja' && v.settings.liveTranslation,
  );
  pass(
    'Eight settings categories, shared draft, at least one caption language, real storage/model status',
  );
  await driver.command('DELETE', '');
  await sleep(800);
  driver = await WebDriver.start(executable);
  await wait(() => driver.read("return !!document.querySelector('.sidebar');"));
  const persisted = await driver.native('bootstrap');
  assert.equal(persisted.settings.assistanceLanguage, 'ja');
  assert.equal(persisted.settings.audioSource, 'system');
  assert.equal(persisted.settings.microphoneDeviceId, preferred[0]);
  assert.equal(persisted.settings.systemDeviceId, preferred[1]);
  assert.equal(persisted.settings.liveTranslation, true);
  pass('Preferences survive installed-app restart');
  const course = persisted.courses.find(
    (c) => c.name === '[ACCEPTANCE 2026-09-30] Classroom',
  );
  assert.ok(course);
  await driver.course(course.name);
  await driver.clickText('Start Lecture');
  await wait(
    () =>
      driver.read(
        "const e=document.querySelectorAll('.modal select')[1]; return e && !e.disabled && e.value !== 'Checking audio devices…' ? e.options.length : 0;",
      ),
    (n) => n > 0,
  );
  const title = `[ACCEPTANCE] product iteration ${Date.now()}`;
  assert.equal(
    await driver.read(
      "return document.querySelectorAll('.modal select')[1].value;",
    ),
    preferred[1],
  );
  await driver.fill('.modal input', title);
  await driver.clickText('Start Recording');
  const recording = await wait(() => driver.native('recording_status'));
  const id = recording.lectureId;
  player = spawn(
    'C:/ProgramData/miniconda3/python.exe',
    [
      'tests/e2e/play-audio.py',
      '--audio',
      'target/installed-acceptance/short.wav',
      '--seconds',
      '1',
      '--log',
      'target/product-iteration/playback.jsonl',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  player.on('error', (error) => console.error(error.message));
  await wait(
    () =>
      driver.read(
        "return document.querySelector('.caption-scroll')?.innerText;",
      ),
    (v) => v?.includes('Today we will examine'),
    50,
  );
  assert.match(
    await driver.read(
      "return document.querySelector('.translation-setup').innerText;",
    ),
    /Connect a text provider/,
  );
  pass(
    'Real system audio → local English → installed WebView2; missing translation provider explained',
    { id, title },
  );
  await wait(
    () =>
      driver.read(
        "const e=document.querySelector('.caption-scroll');return e.scrollHeight-e.clientHeight;",
      ),
    (v) => v > 150,
    60,
  );
  await driver.scroll('.caption-scroll', -800);
  await wait(() =>
    driver.read("return !!document.querySelector('.jump-live');"),
  );
  await driver.clickText('Jump to Live');
  await driver.screenshot('design-classroom');
  const normal = await driver.read(
    "const c=document.querySelector('.classroom-controls').getBoundingClientRect();const a=document.querySelector('.caption-scroll');return {width:innerWidth,height:innerHeight,controlsBottom:c.bottom,bottomGap:a.scrollHeight-a.scrollTop-a.clientHeight};",
  );
  assert.ok(normal.controlsBottom <= normal.height && normal.bottomGap < 3);
  await driver.command('POST', '/window/rect', { width: 880, height: 620 });
  await sleep(300);
  const compact = await driver.read(
    "const c=document.querySelector('.classroom-controls').getBoundingClientRect();const a=document.querySelector('.caption-scroll');return {width:innerWidth,height:innerHeight,controlsBottom:c.bottom,bottomGap:a.scrollHeight-a.scrollTop-a.clientHeight,readerHeight:a.clientHeight};",
  );
  assert.ok(
    compact.controlsBottom <= compact.height &&
      compact.readerHeight > 100 &&
      compact.bottomGap < 3,
  );
  await driver.screenshot('design-classroom-compact');
  pass('Live viewport, manual scroll and Jump to Live', { normal, compact });
  await driver.clickText('Pause');
  await sleep(400);
  const paused = await driver.native('recording_status');
  await sleep(1500);
  assert.equal(
    (await driver.native('recording_status')).durationSeconds,
    paused.durationSeconds,
  );
  await driver.clickText('Resume');
  await sleep(1000);
  await driver.clickText('Stop & save');
  player.kill();
  await wait(
    () => driver.native('recording_status'),
    (v) => !v,
  );
  await wait(
    () => driver.native('live_status'),
    (v) => !v.active,
    45,
  );
  const detail = await driver.native('lecture_detail', { id });
  assert.ok(detail.segments.length && detail.lecture.durationSeconds > 5);
  await wait(() =>
    driver.read(
      "const a=document.querySelector('audio');return a && a.readyState>=1 && Number.isFinite(a.duration);",
    ),
  );
  pass('Pause, resume, stop and saved audio metadata', {
    duration: detail.lecture.durationSeconds,
    segments: detail.segments.length,
    recordingPath: detail.lecture.recordingPath,
  });
  await driver.clickText('Settings');
  await choose(
    'Default translation language',
    original.settings.assistanceLanguage,
  );
  await driver.clickText('Audio');
  await wait(() =>
    driver.read(
      "return !document.querySelectorAll('.settings-detail select')[1].disabled;",
    ),
  );
  await choose('Default audio source', original.settings.audioSource);
  await choose('Microphone device', original.settings.microphoneDeviceId);
  await choose('System playback device', original.settings.systemDeviceId);
  await driver.clickText('AI Providers');
  if (
    (await driver.read(
      "return document.querySelector('.toggle-row input').checked;",
    )) !== original.settings.liveTranslation
  )
    await driver.click('.toggle-row input');
  await driver.clickText('Save changes');
  await wait(
    () => driver.native('bootstrap'),
    (v) => JSON.stringify(v.settings) === JSON.stringify(original.settings),
  );
  pass('Original preferences restored');
  await driver.command('DELETE', '');
  await sleep(800);
  driver = await WebDriver.start(executable);
  await wait(() => driver.read("return !!document.querySelector('.sidebar');"));
  await driver.course(course.name);
  await driver.lecture(title);
  const reopened = await driver.native('lecture_detail', { id });
  assert.equal(
    reopened.lecture.durationSeconds,
    detail.lecture.durationSeconds,
  );
  assert.equal(reopened.segments.length, detail.segments.length);
  await wait(() =>
    driver.read("return document.querySelector('audio')?.readyState >= 1;"),
  );
  await driver.click('.transcript-segment:nth-child(2) .timestamp');
  await sleep(700);
  const audio = await driver.read(
    "const a=document.querySelector('audio');return {position:a.currentTime,paused:a.paused,error:a.error?.code};",
  );
  assert.ok(
    !audio.paused &&
      !audio.error &&
      audio.position >= reopened.segments[1].startSeconds,
  );
  await driver.read("document.querySelector('audio').pause(); return true;");
  pass(
    'Saved lecture survives restart and timestamp starts actual playback',
    audio,
  );
  await driver.clickText('Settings');
  await driver.screenshot('design-settings-general');
  if (original.providers.every((provider) => !provider.hasKey)) {
    await driver.clickText('Security & Privacy');
    await driver.fill('.key-form input', 'test');
    await driver.click('.key-form button');
    await wait(
      () =>
        driver.read(
          "return document.querySelector('.toast.error')?.innerText;",
        ),
      (value) => value?.includes('Paste a valid API key'),
    );
    assert.equal(
      await driver.read(
        "return document.querySelector('.key-form input').value;",
      ),
      '',
    );
    assert.ok(
      (await driver.native('bootstrap')).providers.every(
        (provider) => !provider.hasKey,
      ),
    );
    pass(
      'Invalid key rejected locally and password field cleared; no credential or cloud request',
    );
  }
  await driver.command('DELETE', '');
  await fs.writeFile(
    path.join(output, 'installed-ui-results.json'),
    JSON.stringify({ passed: true, evidence }, null, 2),
  );
} catch (error) {
  await fs.writeFile(
    path.join(output, 'installed-ui-failure.json'),
    JSON.stringify({ error: String(error), evidence }, null, 2),
  );
  throw error;
} finally {
  player?.kill();
}
