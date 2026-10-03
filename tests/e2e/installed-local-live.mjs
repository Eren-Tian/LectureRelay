// Actual installed WebView + WASAPI + Nemotron + Hy-MT2; no cloud calls.
// Position the native outer window on the portrait display before running.
// Never use WebDriver window/rect: EdgeDriver moves the embedded WebView.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';

const output = path.resolve(
  process.env.LECTURERELAY_ACCEPTANCE_ROOT ||
    'target/acceptance-v0.3-2026-10-03',
);
const mode = process.argv[2] || 'short';
assert.ok(['short', 'soak'].includes(mode));
const seconds = mode === 'soak' ? 5400 : 180;
const courseName = '[ACCEPTANCE 2026-10-03] Local AI classroom';
const application = path.join(output, 'app/lecturerelay-desktop.exe');
const python =
  process.env.LECTURERELAY_TEST_PYTHON ||
  'C:/ProgramData/miniconda3/python.exe';
const d = await WebDriver.current();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, accept = Boolean, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await sleep(300);
  }
  throw Error('Installed local AI acceptance timed out');
}
const b = await d.native('bootstrap');
assert.equal(b.settings.provider, 'none');
assert.equal(b.settings.speechProvider, 'local');
assert.equal(b.settings.translationMode, 'local');
assert.equal(b.settings.translationModel, 'hy-mt2-1.8b');
assert.equal(b.settings.liveTranslation, true);
assert.equal(b.settings.quietMode, true);
assert.ok((await d.native('local_text_models')).every((m) => m.installed));
const course = b.courses.find((c) => c.name === courseName);
assert.ok(course);
assert.equal(await d.native('recording_status'), null);
await wait(
  () => d.native('live_status'),
  (v) => !v.active,
);
await d.clickText('Courses');
await wait(() => d.read('return !!document.querySelector(".course-card");'));
await d.course(courseName);
await d.clickText('Start Lecture');
await d.click('.modal select option[value="system"]');
await d.fill(
  '.modal input',
  `[ACCEPTANCE] v0.3 local AI ${mode} ${Date.now()}`,
);
await d.clickText('Start Recording');
const rec = await wait(() => d.native('recording_status'));
const id = rec.lectureId;
const start = performance.now();
const utcStart = new Date().toISOString();
const metrics = spawn(
  python,
  [
    'tests/e2e/process-metrics.py',
    '--exe',
    application,
    '--output',
    `${output}/${mode}-processes.jsonl`,
  ],
  { windowsHide: true, stdio: 'ignore' },
);
// Long fixture also used for the short run so the source never loops mid-test.
const player = spawn(
  python,
  [
    'tests/e2e/play-audio.py',
    '--audio',
    'target/installed-acceptance/soak.wav',
    '--seconds',
    '1',
    '--log',
    `${output}/${mode}-playback.jsonl`,
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let playerExited = false;
player.on('exit', () => {
  playerExited = true;
});
const events = [],
  warnings = new Set(),
  seen = new Set();
const samples = await fs.open(`${output}/${mode}-ui.jsonl`, 'w');
let firstEnglishMs = null,
  firstTranslationMs = null,
  maxQueue = 0,
  maxBacklog = 0;
let scrollPassed = false,
  pausePassed = false,
  lastMinute = -1;
try {
  while ((performance.now() - start) / 1000 < seconds) {
    // Return scalar data and the most recent sentences, never DOM handles.
    const [live, recording, dom] = await Promise.all([
      d.native('live_status'),
      d.native('recording_status'),
      d.read(
        `const e=document.querySelector('.caption-scroll');return {captions:[...document.querySelectorAll('.live-caption')].slice(-12).map(e=>({id:e.dataset.captionId,en:e.querySelector('.caption-english')?.textContent||'',translation:e.querySelector('.caption-translation')?.textContent||''})),count:document.querySelectorAll('.live-caption').length,overflow:e?e.scrollHeight-e.clientHeight:0,clock:document.querySelector('[aria-label="Recording duration"]')?.textContent};`,
      ),
    ]);
    assert.ok(
      recording && !recording.failed && !recording.paused,
      'Recording stopped unexpectedly',
    );
    assert.ok(
      live.active && live.state !== 'unavailable',
      'Speech worker unavailable',
    );
    assert.equal(playerExited, false, 'Audio source exited early');
    const elapsed = (performance.now() - start) / 1000;
    maxQueue = Math.max(maxQueue, live.translationQueue);
    maxBacklog = Math.max(maxBacklog, live.backlogSeconds);
    if (recording.warning) warnings.add(recording.warning);
    if (live.message) warnings.add(live.message);
    if (live.translation.message) warnings.add(live.translation.message);
    for (const row of dom.captions) {
      const segment = live.segments.find((s) => s.id === row.id);
      const end = segment?.endSeconds ?? live.draft?.endSeconds;
      for (const [kind, text] of [
        ['english', row.en],
        ['translation', row.translation],
      ]) {
        const key = `${kind}:${row.id}:${text}`;
        if (!text || seen.has(key)) continue;
        seen.add(key);
        if (kind === 'english' && firstEnglishMs === null)
          firstEnglishMs = elapsed * 1000;
        if (kind === 'translation' && firstTranslationMs === null)
          firstTranslationMs = elapsed * 1000;
        events.push({
          kind,
          id: row.id,
          audioEndSeconds: end,
          elapsedSeconds: elapsed,
          captureEndToDomSeconds:
            end === undefined
              ? null
              : Math.max(0, recording.durationSeconds - end),
          text,
        });
      }
    }
    const sample = {
      utc: new Date().toISOString(),
      elapsedSeconds: elapsed,
      recordedSeconds: recording.durationSeconds,
      backlogSeconds: live.backlogSeconds,
      translationQueue: live.translationQueue,
      translatedRecent: live.segments.filter((s) => s.translatedText).length,
      deferred: live.translation.deferredIds.length,
      droppedChunks: recording.droppedChunks,
      captionDomCount: dom.count,
      firstEnglishMs,
      firstTranslationMs,
      maxQueue,
      maxBacklog,
      warnings: [...warnings],
    };
    await samples.write(JSON.stringify(sample) + '\n');
    await fs.writeFile(
      `${output}/${mode}-progress.json`,
      JSON.stringify(sample, null, 2),
    );
    const minute = Math.floor(elapsed / 60);
    if (minute !== lastMinute) {
      lastMinute = minute;
      console.log(JSON.stringify(sample));
      if (minute > 0 && minute % 15 === 0)
        await d.screenshot(`v03-${mode}-${minute}min`);
    }
    if (!scrollPassed && dom.overflow > 200) {
      await d.scroll('.caption-scroll', -1000);
      await wait(() =>
        d.read('return !!document.querySelector(".jump-live");'),
      );
      await d.clickText('Jump to Live');
      assert.ok(
        await d.read(
          'const e=document.querySelector(".caption-scroll");return e.scrollHeight-e.clientHeight-e.scrollTop<8;',
        ),
      );
      scrollPassed = true;
      console.log('History scrolling and Jump to Live passed');
    }
    if (mode === 'short' && elapsed > 60 && !pausePassed) {
      await d.clickText('Pause');
      await sleep(700);
      const p = await d.native('recording_status');
      await sleep(3000);
      assert.equal(
        (await d.native('recording_status')).durationSeconds,
        p.durationSeconds,
      );
      await d.clickText('Resume');
      pausePassed = true;
      console.log('Pause and resume passed');
    }
    await sleep(mode === 'soak' ? 5000 : 2000);
  }
  const wallSeconds = (performance.now() - start) / 1000;
  await d.screenshot(`v03-${mode}-before-stop`);
  const stoppedAt = performance.now();
  await d.clickText('Stop & save');
  player.kill();
  await wait(
    () => d.native('recording_status'),
    (v) => v === null,
    15000,
  );
  const stopMs = performance.now() - stoppedAt;
  await wait(
    () => d.read('return !!document.querySelector(".replay-page");'),
    Boolean,
    15000,
  );
  const stopUiMs = performance.now() - stoppedAt;
  const processingText = await d.read(
    'return document.querySelector("main").innerText.slice(0,1800);',
  );
  await wait(
    () => d.native('live_status'),
    (v) => !v.active,
    180000,
  );
  const drainMs = performance.now() - stoppedAt;
  const detail = await d.native('lecture_detail', { id });
  const translated = detail.segments.filter((s) => s.translatedText).length;
  assert.equal(detail.lecture.status, 'completed');
  assert.ok(
    detail.lecture.durationSeconds >= seconds - (mode === 'short' ? 8 : 3),
  );
  assert.ok(firstEnglishMs && firstTranslationMs && translated > 3);
  const playback = [];
  let page = 0;
  for (const fraction of [0, 0.25, 0.5, 0.75, 0.99]) {
    const index = Math.min(
      detail.segments.length - 1,
      Math.floor(detail.segments.length * fraction),
    );
    while (page < Math.floor(index / 80)) {
      await d.clickText('Next');
      page += 1;
      await sleep(100);
    }
    await d.click(
      `.transcript-segment:nth-child(${(index % 80) + 1}) .timestamp`,
    );
    await sleep(600);
    const audio = await d.read(
      'const a=document.querySelector("audio");return {duration:a.duration,currentTime:a.currentTime,paused:a.paused,error:a.error?.code,readyState:a.readyState};',
    );
    assert.ok(!audio.paused && !audio.error && audio.readyState >= 2);
    playback.push({
      index,
      expected: detail.segments[index].startSeconds,
      audio,
    });
  }
  await d.read('document.querySelector("audio").pause();return true;');
  await fs.writeFile(
    `${output}/${mode}-detail.json`,
    JSON.stringify(detail, null, 2),
  );
  await fs.writeFile(
    `${output}/${mode}-result.json`,
    JSON.stringify(
      {
        passed: true,
        application,
        utcStart,
        lectureId: id,
        wallSeconds,
        recordedSeconds: detail.lecture.durationSeconds,
        segmentCount: detail.segments.length,
        translated,
        firstEnglishMs,
        firstTranslationMs,
        maxQueue,
        maxBacklog,
        scrollPassed,
        pausePassed,
        stopMs,
        stopUiMs,
        drainMs,
        processingText,
        playback,
        warnings: [...warnings],
        latencyMethod: `DOM observed every ${mode === 'soak' ? 5 : 2}s; capture clock minus source chunk end, includes sentence finalization and polling. Cold first result measured from source playback launch.`,
        events,
      },
      null,
      2,
    ),
  );
  console.log(`${mode} installed local AI recording and replay passed`);
} catch (error) {
  await fs.writeFile(
    `${output}/${mode}-result.json`,
    JSON.stringify(
      {
        passed: false,
        error: String(error),
        utcStart,
        lectureId: id,
        wallSeconds: (performance.now() - start) / 1000,
        events,
        warnings: [...warnings],
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await samples.close();
  metrics.kill();
  player.kill();
}
