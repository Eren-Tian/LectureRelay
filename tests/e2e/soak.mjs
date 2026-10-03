import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { WebDriver } from './webdriver.mjs';

const output = path.resolve('target/installed-acceptance');
const application = path.join(output, 'app/lecturerelay-desktop.exe');
const python =
  process.env.LECTURERELAY_TEST_PYTHON ||
  'C:/ProgramData/miniconda3/python.exe';
const seconds = Number(process.argv[2] || 5400);
assert(seconds >= 5400, 'This acceptance requires at least 90 real minutes');
let driver = await WebDriver.current();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, predicate, max = 45) {
  const until = Date.now() + max * 1000;
  while (Date.now() < until) {
    const v = await read();
    if (predicate(v)) return v;
    await sleep(250);
  }
  throw new Error('Soak condition timed out');
}
const bootstrap = await driver.native('bootstrap');
assert.equal(
  bootstrap.settings.provider,
  'none',
  'Paid cloud tests are not authorized',
);
assert.equal(bootstrap.settings.speechProvider, 'local');
assert.equal((await driver.native('local_model_status')).installed, true);
const testCourse = bootstrap.courses.find(
  (c) => c.name === '[ACCEPTANCE 2026-09-30] Classroom',
);
assert(testCourse);
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
await driver.fill(
  '.modal input',
  '[ACCEPTANCE] installed app 90-minute real-time soak',
);
await driver.clickText('Start Recording');
const recording = await wait(() => driver.native('recording_status'), Boolean);
const id = recording.lectureId;
const start = performance.now();
const utcStart = new Date().toISOString();
const metrics = spawn(
  python,
  [
    'tests/e2e/process-metrics.py',
    '--exe',
    application,
    '--output',
    `${output}/soak-processes.jsonl`,
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const player = spawn(
  python,
  [
    'tests/e2e/play-audio.py',
    '--audio',
    `${output}/soak.wav`,
    '--seconds',
    '1',
    '--log',
    `${output}/soak-playback.jsonl`,
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let playerExited = false;
player.on('exit', () => {
  playerExited = true;
});
const events = [];
const seen = new Set();
const observed = new Set();
const warnings = new Set();
const sampleFile = await fs.open(path.join(output, 'soak-ui.jsonl'), 'w');
let lastMinute = -1;
let lastScreenshotMinute = -1;
let maxBacklog = 0;
let maxQueue = 0;
let dropped = 0;
let firstCaptionMs = null;
try {
  while ((performance.now() - start) / 1000 < seconds) {
    const [live, rec, dom] = await Promise.all([
      driver.native('live_status'),
      driver.native('recording_status'),
      driver.read(
        'const e=document.querySelector(".caption-scroll");return {captionText:e?.innerText||"",captionCount:document.querySelectorAll(".live-caption").length,clock:document.querySelector(".recording-clock")?.innerText,scrollHeight:e?.scrollHeight,viewHeight:e?.clientHeight};',
      ),
    ]);
    assert(
      rec && !rec.failed && !rec.paused,
      'Recording must remain healthy and active',
    );
    assert(
      live.active && live.state !== 'unavailable',
      'Speech worker must stay active',
    );
    assert(!playerExited, 'Continuous source playback exited early');
    const elapsed = (performance.now() - start) / 1000;
    maxBacklog = Math.max(maxBacklog, live.backlogSeconds);
    maxQueue = Math.max(maxQueue, live.translationQueue);
    dropped = Math.max(dropped, rec.droppedChunks);
    if (rec.warning) warnings.add(rec.warning);
    if (live.message) warnings.add(live.message);
    const candidates = [
      ...live.segments.map((s) => ({
        key: s.id,
        text: s.sourceText,
        end: s.endSeconds,
        kind: 'final',
      })),
      ...(live.draft?.partialText
        ? [
            {
              key: live.draft.id,
              text: live.draft.partialText,
              end: live.draft.endSeconds,
              kind: 'partial',
            },
          ]
        : []),
    ];
    for (const item of candidates) {
      const key = `${item.kind}:${item.key}:${createHash('sha256').update(item.text).digest('hex')}`;
      if (!seen.has(key) && dom.captionText.includes(item.text)) {
        seen.add(key);
        observed.add(item.key);
        if (firstCaptionMs === null) firstCaptionMs = elapsed * 1000;
        events.push({
          kind: item.kind,
          id: item.key,
          audioEndSeconds: item.end,
          visibleAtElapsedSeconds: elapsed,
          endOfChunkToDomSeconds: Math.max(0, rec.durationSeconds - item.end),
        });
      }
    }
    const sample = {
      utc: new Date().toISOString(),
      elapsedSeconds: elapsed,
      recordedSeconds: rec.durationSeconds,
      backlogSeconds: live.backlogSeconds,
      translationQueue: live.translationQueue,
      droppedChunks: rec.droppedChunks,
      captionDomCount: dom.captionCount,
      clock: dom.clock,
    };
    await sampleFile.write(JSON.stringify(sample) + '\n');
    await fs.writeFile(
      path.join(output, 'soak-progress.json'),
      JSON.stringify(
        {
          ...sample,
          maxBacklogSeconds: maxBacklog,
          firstCaptionMs,
          warnings: [...warnings],
        },
        null,
        2,
      ),
    );
    const minute = Math.floor(elapsed / 60);
    if (minute !== lastMinute) {
      lastMinute = minute;
      console.log(JSON.stringify({ ...sample, event: 'minute-progress' }));
    }
    if (
      minute > 0 &&
      minute % 15 === 0 &&
      minute !== lastScreenshotMinute &&
      dom.captionCount
    ) {
      await driver.screenshot(`soak-minute-${minute}`);
      lastScreenshotMinute = minute;
    }
    await sleep(1000);
  }
  const elapsed = (performance.now() - start) / 1000;
  await driver.screenshot('soak-90-minutes');
  await driver.clickText('Stop & save');
  player.kill();
  const processingBanner = await driver.read(
    'return [...document.querySelectorAll("[role=status]")].map(e=>e.innerText).find(t=>t.includes("Recording saved"));',
  );
  await wait(
    () => driver.native('live_status'),
    (v) => !v.active,
    45,
  );
  const detail = await driver.native('lecture_detail', { id });
  assert.equal(detail.lecture.status, 'completed');
  assert(
    detail.lecture.durationSeconds >= seconds - 3,
    'Recorded audio duration must cover the full wall time',
  );
  assert(detail.segments.length > 100 && firstCaptionMs !== null);
  const playback = [];
  for (const fraction of [0, 0.25, 0.5, 0.75, 0.99]) {
    const index = Math.min(
      detail.segments.length - 1,
      Math.floor(detail.segments.length * fraction),
    );
    await driver.click(
      `.transcript-segment:nth-child(${index + 1}) .timestamp`,
    );
    await sleep(500);
    const audio = await driver.read(
      'const a=document.querySelector("audio");return {duration:a.duration,currentTime:a.currentTime,paused:a.paused,error:a.error?.code,readyState:a.readyState};',
    );
    assert(!audio.paused && !audio.error && audio.readyState >= 2);
    playback.push({ segment: index, audio });
  }
  await driver.read('document.querySelector("audio").pause();return true;');
  await driver.screenshot('soak-saved');
  metrics.kill();
  await driver.command('DELETE', '');
  driver = await WebDriver.start(application);
  await wait(
    () => driver.read('return !!document.querySelector(".course-card");'),
    Boolean,
  );
  await driver.course(testCourse.name);
  await driver.lecture(detail.lecture.title);
  const reopened = await driver.native('lecture_detail', { id });
  assert.equal(
    reopened.lecture.durationSeconds,
    detail.lecture.durationSeconds,
  );
  assert.equal(reopened.segments.length, detail.segments.length);
  await driver.screenshot('soak-restarted');
  await fs.writeFile(
    path.join(output, 'soak-result.json'),
    JSON.stringify(
      {
        passed: true,
        application,
        utcStart,
        wallSeconds: elapsed,
        lectureId: id,
        recordedSeconds: detail.lecture.durationSeconds,
        segmentCount: detail.segments.length,
        firstCaptionMs,
        maxBacklogSeconds: maxBacklog,
        maxTranslationQueue: maxQueue,
        droppedChunks: dropped,
        warnings: [...warnings],
        processingBanner: processingBanner || null,
        playback,
        restartPreserved: true,
        translation: 'Not tested: paid cloud requests declined',
        latencyMethod:
          'Captured frame clock minus chunk end when corresponding text first appears in actual DOM; 1 second polling and ~0.2 second recorder-status quantization.',
        events,
      },
      null,
      2,
    ),
  );
  console.log('90-minute installed application soak completed');
} catch (error) {
  await fs.writeFile(
    path.join(output, 'soak-result.json'),
    JSON.stringify(
      {
        passed: false,
        error: String(error),
        utcStart,
        lectureId: id,
        wallSeconds: (performance.now() - start) / 1000,
        warnings: [...warnings],
        events,
      },
      null,
      2,
    ),
  );
  // Preserve the app/recording for diagnosis; do not kill it on an assertion failure.
  throw error;
} finally {
  await sampleFile.close();
  metrics.kill();
  player.kill();
}
