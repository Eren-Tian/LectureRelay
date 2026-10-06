// Installed local-only Tauri/WebView2 comparison. Creates labelled test data only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const { WebDriver } = await import('./webdriver.mjs');
const application = process.env.LECTURERELAY_LATENCY_EXE;
assert.ok(application, 'Set the exact installed test EXE');
const applicationSha256 = createHash('sha256')
  .update(await fs.readFile(application))
  .digest('hex');
const checkFloating = process.env.LECTURERELAY_LATENCY_FLOATING === '1';
const audio = process.env.LECTURERELAY_LATENCY_AUDIO;
const source = process.env.LECTURERELAY_LATENCY_SOURCE || 'system';
const targetLanguage = process.env.LECTURERELAY_LATENCY_LANGUAGE || 'zh';
assert.ok(['system', 'microphone'].includes(source));
assert.ok(['zh', 'ja', 'ko'].includes(targetLanguage));
assert.ok(
  audio,
  'Provide a documented real lecturer audio fixture; no synthetic speech',
);
const label = process.argv[2];
assert.match(label ?? '', /^[a-z0-9-]+$/);
const out = `target/latency-study/${label}`;
const durationMs =
  Number(process.env.LECTURERELAY_LATENCY_SECONDS || 300) * 1000;
const pollMs = Number(process.env.LECTURERELAY_LATENCY_POLL_MS || 200);
assert.ok(Number.isFinite(durationMs) && durationMs > 0);
assert.ok(Number.isFinite(pollMs) && pollMs >= 200);
await fs.mkdir(out, { recursive: true });
const d = await WebDriver.current();
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
let boot;
const samples = [];
try {
  boot = await d.native('bootstrap');
  mainHandle = await d.command('GET', '/window');
  assert.equal(boot.storage.version, process.env.LECTURERELAY_LATENCY_VERSION);
  assert.ok(boot.storage.database.endsWith('LectureRelay\\app.db'));
  assert.equal(boot.recording, null);
  const metrics = spawn(
    'python',
    [
      'tests/e2e/process-metrics.py',
      '--exe',
      application,
      '--output',
      `${out}/processes.jsonl`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  metrics.on('error', (e) => {
    throw e;
  });
  await fs.writeFile(
    `${out}/baseline-settings.json`,
    JSON.stringify(boot.settings),
  );
  await pause(30000);
  assert.equal(boot.job, null);
  assert.equal(boot.settings.provider, 'none');
  assert.equal(boot.settings.speechProvider, 'local');
  assert.equal(boot.settings.translationMode, 'local');
  assert.equal(boot.settings.quietMode, true);
  const courseName =
    process.env.LECTURERELAY_LATENCY_COURSE ||
    '[ACCEPTANCE 2026-10-05] Natural lecture latency';
  assert.ok(courseName.startsWith('[ACCEPTANCE '));
  let course = boot.courses.find((c) => c.name === courseName);
  if (!course) {
    await d.clickText('新建课程');
    await d.fill('.modal input[maxlength="150"]', courseName);
    await d.fill(
      '.modal input[maxlength="40"]',
      process.env.LECTURERELAY_LATENCY_SUBJECT || 'MIT 9.00',
    );
    await d.fill(
      '.modal textarea',
      process.env.LECTURERELAY_LATENCY_CONTEXT ||
        'MIT OpenCourseWare 9.00 Introduction to Psychology. Brain and cognitive sciences; reference context only.',
    );
    await d.read(
      "const e=document.querySelector('.modal select'); e.value=arguments[0]; e.dispatchEvent(new Event('change',{bubbles:true}));",
      [targetLanguage],
    );
    await d.click('.modal form button.primary');
    course = await until(
      () => d.native('bootstrap'),
      (b) => b.courses.some((c) => c.name === courseName),
    ).then((b) => b.courses.find((c) => c.name === courseName));
  }
  assert.ok(course);
  assert.equal(course.assistanceLanguage, targetLanguage);
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
  const liveAtStart = await d.native('live_status');
  lectureId = recording.lectureId;
  assert.equal(recording.source, source);
  const readySilenceSeconds = Number(
    process.env.LECTURERELAY_LATENCY_READY_SILENCE || 0,
  );
  if (readySilenceSeconds > 0) await pause(readySilenceSeconds * 1000);
  player = spawn(
    'python',
    [
      'tests/e2e/play-audio.py',
      '--audio',
      audio,
      '--seconds',
      String(durationMs / 1000),
      '--log',
      `${out}/playback.jsonl`,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  player.on('error', (error) => {
    playerError = error;
  });
  const started = Date.now();
  while (Date.now() - started < durationMs) {
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
    const rows = await d.read(
      "return [...document.querySelectorAll('[data-caption-id]')].map(e=>({id:e.dataset.captionId,english:e.querySelector('.caption-english')?.textContent??'',translated:e.querySelector('.caption-translation')?.textContent??'',kind:e.querySelector('[data-translation-kind]')?.dataset.translationKind??'saved'}));",
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
      rows,
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
      await d.clickText('独立字幕窗');
      const reopened = await until(
        () => d.command('GET', '/window/handles'),
        (h) => h.length > 1,
      );
      await d.command('POST', '/window', {
        handle: reopened.find((h) => h !== mainHandle),
      });
      await until(() =>
        d.read("return !!document.querySelector('.floating-captions');"),
      );
      await d.clickText('关闭字幕窗');
      await d.command('POST', '/window', { handle: mainHandle });
      assert.equal((await d.native('recording_status'))?.lectureId, lectureId);
      floating.reopenPreservesRecording = true;
    }
    if (samples.length % Math.max(1, Math.round(60000 / pollMs)) === 0) {
      await fs.writeFile(
        `${out}/checkpoint.json`,
        JSON.stringify({ lectureId, samples }),
      );
      console.log(
        JSON.stringify({
          label,
          elapsed: samples.at(-1).elapsed,
          backlog: live.backlogSeconds,
          queue: live.translationQueue,
        }),
      );
    }
    await pause(pollMs);
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
    scope: `Installed EXE and real WebView2, ${source}, fixed real lecturer audio, local Nemotron + Hy-MT2, Quiet Mode; instrumented ${durationMs >= 3600000 ? 'long' : 'short'} run`,
    audio: path.resolve(audio),
    application: path.resolve(application),
    applicationSha256,
    floating,
    settings: boot.settings,
    targetLanguage,
    startupNotice: liveAtStart,
    readySilenceSeconds,
    pollMs,
    playback: { ...playback, timestampPlayPassed: true },
    lectureId,
    detail,
    samples,
  };
  const trace = path.join(
    boot.storage.state,
    'logs',
    `${lectureId}-caption-stages.jsonl`,
  );
  await fs.copyFile(trace, `${out}/stages.jsonl`).catch(() => {});
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
} catch (error) {
  // Keep the last observed state and on-disk stages even if the recording ends
  // early. A failed run must not silently disappear from acceptance evidence.
  const detail = lectureId
    ? await d.native('lecture_detail', { id: lectureId }).catch(() => null)
    : null;
  await fs.writeFile(
    `${out}/failure.json`,
    JSON.stringify(
      { label, error: String(error), lectureId, detail, samples },
      null,
      2,
    ),
  );
  if (boot && lectureId) {
    await fs
      .copyFile(
        path.join(
          boot.storage.state,
          'logs',
          `${lectureId}-caption-stages.jsonl`,
        ),
        `${out}/stages.jsonl`,
      )
      .catch(() => {});
  }
  throw error;
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
