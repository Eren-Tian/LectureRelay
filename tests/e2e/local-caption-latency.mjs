// Real local-only Tauri/WebView2 comparison. Refuses the user's classroom library.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const { WebDriver } = await import('./webdriver.mjs');
const application = process.env.LECTURERELAY_LATENCY_EXE;
assert.ok(application, 'Set the exact isolated test EXE');
const applicationSha256 = createHash('sha256')
  .update(await fs.readFile(application))
  .digest('hex');
const checkFloating = process.env.LECTURERELAY_LATENCY_FLOATING === '1';
const audio = process.env.LECTURERELAY_LATENCY_AUDIO;
const source = process.env.LECTURERELAY_LATENCY_SOURCE || 'system';
assert.ok(['system', 'microphone'].includes(source));
assert.ok(
  audio,
  'Provide a documented real lecturer audio fixture; no synthetic speech',
);
const label = process.argv[2];
assert.match(label ?? '', /^[a-z0-9-]+$/);
const out = `target/local-latency/${label}`;
await fs.mkdir(out, { recursive: true });
const d = await WebDriver.start(path.resolve(application));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, check = Boolean, limit = 30000) {
  const deadline = Date.now() + limit;
  while (Date.now() < deadline) {
    const v = await fn();
    if (check(v)) return v;
    await pause(100);
  }
  throw Error('Local caption condition timed out');
}
let player;
let playerError;
let lectureId;
let mainHandle;
let floating;
const samples = [];
try {
  const boot = await d.native('bootstrap');
  mainHandle = await d.command('GET', '/window');
  assert.equal(
    path.resolve(boot.storage.database),
    path.resolve('target/classroom-fixes/ui-1/app-data/app.db'),
  );
  assert.equal(boot.recording, null);
  assert.equal(boot.job, null);
  assert.equal(boot.settings.provider, 'none');
  assert.equal(boot.settings.speechProvider, 'local');
  assert.equal(boot.settings.translationMode, 'local');
  assert.equal(boot.settings.quietMode, true);
  const courseName = '[TEST] MIT Psychology — OCW';
  let course = boot.courses.find((c) => c.name === courseName);
  if (!course) {
    await d.clickText('新建课程');
    await d.fill('.modal input[maxlength="150"]', courseName);
    await d.fill('.modal input[maxlength="40"]', 'MIT 9.00');
    await d.fill(
      '.modal textarea',
      'MIT OpenCourseWare 9.00 Introduction to Psychology. Brain and cognitive sciences; reference context only.',
    );
    await d.click('.modal form button.primary');
    course = await until(
      () => d.native('bootstrap'),
      (b) => b.courses.some((c) => c.name === courseName),
    ).then((b) => b.courses.find((c) => c.name === courseName));
  }
  assert.ok(course);
  await d.click(`aside button[aria-label="${courseName}"]`);
  await d.clickText('开始录音');
  await d.fill(
    '.modal input[maxlength="150"]',
    `[ACCEPTANCE] Local latency ${label}`,
  );
  await d.read(
    "const e=document.querySelector('.modal select'); e.value=arguments[0]; e.dispatchEvent(new Event('change',{bubbles:true}));",
    [source],
  );
  await until(() =>
    d.read(
      "return document.querySelector('.modal select')?.value===arguments[0] && ![...document.querySelectorAll('.modal button')].find(b=>b.textContent.trim()==='开始录音')?.disabled;",
      [source],
    ),
  );
  await d.click('.modal form button.primary');
  const recording = await until(() => d.native('recording_status'));
  lectureId = recording.lectureId;
  assert.equal(recording.source, source);
  player = spawn(
    'python',
    [
      'tests/e2e/play-audio.py',
      '--audio',
      audio,
      '--seconds',
      '95',
      '--log',
      `${out}/playback.jsonl`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  player.on('error', (error) => {
    playerError = error;
  });
  const started = Date.now();
  while (Date.now() - started < 90000) {
    if (playerError) throw playerError;
    const live = await d.native('live_status');
    const recording = await d.native('recording_status');
    assert.ok(
      recording && recording.lectureId === lectureId,
      'Recording stopped unexpectedly',
    );
    const dom = await d.read(
      "return {english:[...document.querySelectorAll('.caption-english')].map(e=>e.textContent).filter(Boolean),chinese:[...document.querySelectorAll('.caption-translation')].map(e=>e.textContent).filter(Boolean),chineseKinds:[...document.querySelectorAll('.caption-translation')].map(e=>e.closest('[data-translation-kind]')?.dataset.translationKind??'saved'),stopEnabled:!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='结束并保存'&&!b.disabled)};",
    );
    assert.ok(dom.stopEnabled, 'Stop must remain usable');
    samples.push({
      utcMs: Date.now(),
      elapsed: (Date.now() - started) / 1000,
      duration: recording.durationSeconds,
      backlog: live.backlogSeconds,
      queue: live.translationQueue,
      deferred: live.translation.deferredIds.length,
      draft: live.draft,
      previews: live.translationPreviews ?? [],
      segments: live.segments,
      ...dom,
    });
    if (checkFloating && !floating && Date.now() - started > 20000) {
      await d.clickText('独立字幕窗');
      const handles = await until(
        () => d.command('GET', '/window/handles'),
        (h) => h.length > 1,
      );
      const handle = handles.find((h) => h !== mainHandle);
      await d.command('POST', '/window', { handle });
      await until(() =>
        d.read("return !!document.querySelector('.floating-captions');"),
      );
      const eventId = await d.read(
        "window.captionEventCount=0; const handler=window.__TAURI_INTERNALS__.transformCallback(()=>window.captionEventCount++); return window.__TAURI_INTERNALS__.invoke('plugin:event|listen',{event:'live-status',target:{kind:'Any'},handler});",
      );
      const count = await until(
        () => d.read('return window.captionEventCount;'),
        (n) => n > 0,
        8000,
      );
      const lines = await until(
        () =>
          d.read(
            "return document.querySelector('.floating-lines').textContent.length;",
          ),
        (n) => n > 10,
      );
      await d.read(
        "window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener('live-status',arguments[0]); return window.__TAURI_INTERNALS__.invoke('plugin:event|unlisten',{event:'live-status',eventId:arguments[0]});",
        [eventId],
      );
      await d.clickText('关闭字幕窗');
      await d.command('POST', '/window', { handle: mainHandle });
      assert.equal((await d.native('recording_status'))?.lectureId, lectureId);
      floating = {
        receivesNativeEvents: count > 0,
        displaysCaptions: lines > 10,
        closePreservesRecording: true,
      };
    }
    await pause(200);
  }
  player.kill();
  await d.clickText('结束并保存');
  await until(
    () => d.native('recording_status'),
    (r) => r === null,
  );
  await until(
    () => d.native('live_status'),
    (l) => !l.active,
    90000,
  );
  const detail = await d.native('lecture_detail', { id: lectureId });
  await until(() =>
    d.read("return document.querySelector('audio')?.readyState>=1;"),
  );
  const playback = await d.read(
    "const a=document.querySelector('audio'); return {duration:a.duration,error:a.error?.code??null};",
  );
  assert.ok(
    Math.abs(playback.duration - detail.lecture.durationSeconds) < 1 &&
      playback.error === null,
  );
  await d.read(
    "const b=[...document.querySelectorAll('.timestamp')].find(b=>b.textContent.trim()!=='00:00'); if(!b)throw Error('No timestamp'); b.click();",
  );
  await until(
    () =>
      d.read(
        "const a=document.querySelector('audio'); return {time:a.currentTime,playing:!a.paused,error:a.error?.code??null};",
      ),
    (a) => a.playing && a.time > 1 && a.error === null,
  );
  await d.read("document.querySelector('audio').pause();");
  const record = {
    label,
    scope: `Native debug EXE and real WebView2, ${source}, fixed real lecturer audio, local Nemotron + Hy-MT2, Quiet Mode; instrumented short run`,
    audio: path.resolve(audio),
    application: path.resolve(application),
    applicationSha256,
    floating,
    playback: { ...playback, timestampPlayPassed: true },
    lectureId,
    detail,
    samples,
  };
  await fs.writeFile(
    `${out}/observation.json`,
    JSON.stringify(record, null, 2),
  );
  await fs.writeFile(
    `${out}/final.png`,
    Buffer.from(await d.command('GET', '/screenshot'), 'base64'),
  );
  console.log(
    JSON.stringify({
      label,
      lectureId,
      samples: samples.length,
      maxBacklog: Math.max(...samples.map((s) => s.backlog)),
      maxQueue: Math.max(...samples.map((s) => s.queue)),
      segments: detail.segments.length,
    }),
  );
} finally {
  player?.kill();
  if (mainHandle)
    await d.command('POST', '/window', { handle: mainHandle }).catch(() => {});
  if (
    lectureId &&
    (await d.native('recording_status'))?.lectureId === lectureId
  ) {
    await d.clickText('结束并保存');
    await until(
      () => d.native('recording_status'),
      (r) => r === null,
    );
  }
  await d.command('DELETE', '');
}
