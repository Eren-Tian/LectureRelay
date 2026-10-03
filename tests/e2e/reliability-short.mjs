// Installed app short latency trace. This controller is NEVER used for the memory soak.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { WebDriver } from './webdriver.mjs';
const d = await WebDriver.current();
const root = 'target/acceptance-v0.3.1';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (read, accept = Boolean, ms = 180000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await pause(150);
  }
  throw Error('Short native regression timed out');
};
const b = await d.native('bootstrap');
assert.equal(b.storage.version, '0.3.1');
assert.equal(b.settings.provider, 'none');
assert.equal(b.settings.speechProvider, 'local');
assert.equal(b.settings.translationMode, 'local');
assert.ok(b.settings.liveTranslation && b.settings.quietMode);
await d.clickText('Courses');
await d.course('[ACCEPTANCE 2026-10-03] Local AI classroom');
await d.clickText('Start Lecture');
await d.click('.modal select option[value="system"]');
const title = `[ACCEPTANCE] v0.3.1 stage latency ${Date.now()}`;
await d.fill('.modal input', title);
await d.clickText('Start Recording');
const rec = await wait(() => d.native('recording_status'));
const id = rec.lectureId;
const captureStartMs = Date.now() - rec.durationSeconds * 1000;
const controls = await d.read(
  `const e=[...document.querySelectorAll('button')].find(e=>e.innerText.trim()==='Stop & save');const r=e.getBoundingClientRect();return {width:innerWidth,height:innerHeight,toasts:document.querySelectorAll('.toast').length,stopVisible:r.top>=0&&r.bottom<=innerHeight,stopClickable:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),rect:r.toJSON()};`,
);
assert.ok(
  controls.toasts > 0 && controls.stopVisible && controls.stopClickable,
  JSON.stringify(controls),
);
await d.screenshot('v031-portrait-toast-controls');
const player = spawn(
  'python',
  [
    '-X',
    'utf8',
    'tests/e2e/play-audio.py',
    '--audio',
    'target/installed-acceptance/soak.wav',
    '--seconds',
    '1',
    '--log',
    `${root}/stage-playback.jsonl`,
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const first = new Map();
const seen = [];
let scrollPassed = false;
const start = Date.now();
try {
  while (Date.now() - start < 180000) {
    const data = await d.read(
      `const e=document.querySelector('.caption-scroll');return {utcMs:Date.now(),overflow:e?e.scrollHeight-e.clientHeight:0,rows:[...document.querySelectorAll('.live-caption')].slice(-12).map(e=>({id:e.dataset.captionId,en:e.querySelector('.caption-english')?.textContent||'',zh:e.querySelector('.caption-translation')?.textContent||''}))};`,
    );
    for (const row of data.rows)
      for (const kind of ['en', 'zh'])
        if (row[kind] && !first.has(`${kind}:${row.id}`)) {
          first.set(`${kind}:${row.id}`, data.utcMs);
          seen.push({ id: row.id, kind, utcMs: data.utcMs, text: row[kind] });
        }
    if (data.overflow > 100 && !scrollPassed) {
      await d.scroll('.caption-scroll', -900);
      await wait(() =>
        d.read('return !!document.querySelector(".jump-live");'),
      );
      await d.clickText('Jump to Live');
      scrollPassed = true;
    }
    await pause(100);
  }
  const beforePause = await d.native('recording_status');
  await d.clickText('Pause');
  await pause(500);
  const paused = await d.native('recording_status');
  await pause(1000);
  assert.equal(
    (await d.native('recording_status')).durationSeconds,
    paused.durationSeconds,
  );
  await d.clickText('Resume');
  await pause(500);
  const stoppedAt = Date.now();
  await d.clickText('Stop & save');
  await wait(
    () => d.native('recording_status'),
    (v) => v === null,
    15000,
  );
  const stopMs = Date.now() - stoppedAt;
  await wait(
    () => d.native('live_status'),
    (v) => !v.active,
  );
  const detail = await d.native('lecture_detail', { id });
  assert.equal(detail.lecture.status, 'completed');
  assert.ok(
    detail.segments.length > 8 &&
      detail.segments.every(
        (s) =>
          s.origin === 'local' && s.provider === 'local' && s.translatedText,
      ),
  );
  await d.click('.transcript-segment .timestamp');
  await pause(1000);
  assert.ok(
    await d.read(
      'const a=document.querySelector("audio");return a.currentTime>0&&!a.paused&&!a.error;',
    ),
  );
  await d.screenshot('v031-short-replay');
  await fs.writeFile(
    `${root}/stage-short.json`,
    JSON.stringify(
      {
        passed: true,
        id,
        title,
        captureStartMs,
        controls,
        scrollPassed,
        pausePassed: true,
        stopMs,
        seen,
        detail,
        beforePause,
      },
      null,
      2,
    ),
  );
  await d.clickText('Courses');
  console.log(
    JSON.stringify({
      passed: true,
      id,
      stopMs,
      segments: detail.segments.length,
      scrollPassed,
    }),
  );
} finally {
  player.kill();
}
