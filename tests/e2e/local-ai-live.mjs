// Short real WASAPI capture with local STT + translation. Uses only the isolated fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const d = await WebDriver.current();
const out = path.resolve('target/local-ai-evaluation');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { samples: [] };
let player, metrics;
async function wait(read, accept = Boolean, timeout = 90000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const v = await read();
    if (accept(v)) return v;
    await pause(200);
  }
  throw Error('Local live acceptance timed out');
}
try {
  const b = await d.native('bootstrap');
  assert.ok(b.storage.database.includes('target\\local-ai-gui\\'));
  assert.equal(b.settings.provider, 'none');
  assert.equal(await d.native('recording_status'), null);
  await d.clickText('Courses');
  await d.click('.library-open');
  await d.clickText('Generate AI draft');
  await wait(
    () => d.native('job_status'),
    (v) => v?.message.startsWith('Generating'),
  );
  const cancelAt = Date.now();
  await d.clickText('Cancel');
  await wait(
    () => d.native('job_status'),
    (v) => v === null,
    10000,
  );
  report.inferenceCancelMs = Date.now() - cancelAt;
  console.log('Cancelled an already-generating Qwen request');
  await d.clickText('Settings');
  await d.clickText('General');
  if (!(await d.native('bootstrap')).settings.quietMode)
    await d.click('input[aria-label="Quiet Mode"]');
  await d.clickText('AI Providers');
  if ((await d.native('bootstrap')).settings.speechProvider !== 'local') {
    await d.click(
      'select:has(option[value="groq"]):has(option[value="local"]) option[value="local"]',
    );
    await d.clickText('Save changes');
  }
  await wait(
    () => d.native('bootstrap'),
    (v) => v.settings.speechProvider === 'local',
  );
  await d.clickText('Courses');
  await d.click('.course-card');
  await d.clickText('Start Lecture');
  await d.click('.modal select:first-of-type option[value="system"]');
  await wait(() =>
    d.read(
      "return document.querySelectorAll('.modal select')[1]?.options.length>0 && !document.querySelectorAll('.modal select')[1]?.disabled;",
    ),
  );
  await d.fill('.modal input', '[ACCEPTANCE] Local captions and translation');
  await d.clickText('Start Recording');
  const rec = await wait(() => d.native('recording_status'));
  report.id = rec.lectureId;
  metrics = spawn(
    'C:/ProgramData/miniconda3/python.exe',
    [
      'tests/e2e/process-metrics.py',
      '--exe',
      path.resolve(
        'target/x86_64-pc-windows-msvc/debug/lecturerelay-desktop.exe',
      ),
      '--output',
      path.join(out, 'live-processes.jsonl'),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  player = spawn(
    'C:/ProgramData/miniconda3/python.exe',
    [
      'tests/e2e/play-audio.py',
      '--audio',
      'target/installed-acceptance/short.wav',
      '--seconds',
      '1',
      '--log',
      path.join(out, 'live-playback.jsonl'),
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  const began = Date.now();
  while (Date.now() - began < 50000) {
    const live = await d.native('live_status');
    const recording = await d.native('recording_status');
    const visible = await d.read(
      "return [...document.querySelectorAll('.caption-translation')].map(e=>e.innerText);",
    );
    report.samples.push({
      elapsedMs: Date.now() - began,
      seconds: recording?.durationSeconds,
      backlog: live.backlogSeconds,
      queue: live.translationQueue,
      english: live.segments.length,
      translated: live.segments.filter((s) => s.translatedText).length,
      visible,
    });
    assert.ok(
      recording,
      'Recording ended before the test requested Stop & save',
    );
    if (
      !report.firstTranslationMs &&
      live.segments.some((s) => s.translatedText)
    )
      report.firstTranslationMs = Date.now() - began;
    await pause(900);
  }
  assert.ok(
    report.samples.some(
      (s) => s.seconds > 0 && s.translated > 0 && s.visible.length > 0,
    ),
    'Real local translations must be visible while recording continues',
  );
  await d.screenshot('local-ai-live');
  await d.clickText('Pause');
  await pause(600);
  assert.equal((await d.native('recording_status')).paused, true);
  await d.clickText('Resume');
  const stopAt = Date.now();
  await d.clickText('Stop & save');
  await wait(
    () => d.native('recording_status'),
    (v) => v === null,
    5000,
  );
  report.audioSavedAfterStopMs = Date.now() - stopAt;
  player.kill();
  await wait(
    () => d.native('live_status'),
    (v) => !v.active,
  );
  report.processingFinishedAfterStopMs = Date.now() - stopAt;
  report.detail = await d.native('lecture_detail', { id: report.id });
  assert.ok(report.detail.lecture.durationSeconds >= 45);
  assert.ok(report.detail.segments.some((s) => s.translatedText));
  await wait(() =>
    d.read("return document.querySelector('audio')?.readyState>=1;"),
  );
  report.playback = await d.read(
    "const a=document.querySelector('audio'); return {duration:a.duration,error:a.error?.code};",
  );
  assert.ok(report.playback.duration >= 45 && !report.playback.error);
  console.log(
    'Quiet Mode: actual system audio → Nemotron → Hy-MT2 → visible captions; pause/resume/stop/playback passed',
  );
} finally {
  player?.kill();
  metrics?.kill();
  if (await d.native('recording_status')) await d.clickText('Stop & save');
  await fs.writeFile(
    path.join(out, 'live-results.json'),
    JSON.stringify(report, null, 2),
  );
}
