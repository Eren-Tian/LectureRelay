// Run only after the independent observer and post-stop external samples finish.
// All mutations are ordinary UI actions; native inspection is read-only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';

const root = 'target/acceptance-v0.3.1';
const result = JSON.parse(
  await fs.readFile(`${root}/independent-result.json`, 'utf8'),
);
assert.ok(result.seconds >= 5400);
const d = await WebDriver.current();
assert.equal((await d.native('bootstrap')).storage.version, '0.3.1');
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
assert.equal((await d.native('live_status')).active, false);
const detail = await d.native('lecture_detail', { id: result.lectureId });
assert.ok(
  detail.lecture.title.startsWith('[ACCEPTANCE] v0.3.1 independent 90 minutes'),
);
assert.equal(detail.lecture.status, 'completed');
assert.ok(detail.lecture.durationSeconds >= 5400);
assert.ok(detail.segments.length >= result.finalSavedSegments);
assert.ok(
  detail.segments.every(
    (s) =>
      s.sourceText &&
      s.translatedText &&
      s.origin === 'local' &&
      s.provider === 'local',
  ),
);
await fs.writeFile(
  `${root}/independent-detail.json`,
  JSON.stringify(detail, null, 2),
);
await d.clickText('Courses');
await d.course(detail.course.name);
await d.lecture(detail.lecture.title);
for (let i = 0; i < 100; i++) {
  if (await d.read('return document.querySelector("audio")?.readyState >= 1;'))
    break;
  await new Promise((r) => setTimeout(r, 100));
}
const duration = await d.read(
  'return document.querySelector("audio").duration;',
);
assert.ok(Math.abs(duration - detail.lecture.durationSeconds) < 0.1);
const indexes = [
  ...new Set(
    [0, 0.25, 0.5, 0.75, 1].map((f) =>
      Math.floor(f * (detail.segments.length - 1)),
    ),
  ),
];
const checks = [];
let page = 0;
for (const index of indexes) {
  const expected = detail.segments[index];
  const target = Math.floor(index / 80);
  while (page < target) {
    await d.clickText('Next');
    page++;
  }
  const selector = `.transcript-segment:nth-child(${(index % 80) + 1})`;
  assert.equal(
    await d.read('return document.querySelector(arguments[0]).textContent;', [
      `${selector} .source-text`,
    ]),
    expected.sourceText,
  );
  await d.click(`${selector} .timestamp`);
  await new Promise((r) => setTimeout(r, 650));
  const playback = await d.read(
    'const a=document.querySelector("audio");return {seconds:a.currentTime,paused:a.paused,error:a.error?.code,readyState:a.readyState};',
  );
  assert.ok(!playback.paused && !playback.error && playback.readyState >= 2);
  assert.ok(
    playback.seconds >= expected.startSeconds &&
      playback.seconds < expected.startSeconds + 3,
    JSON.stringify({ expected: expected.startSeconds, playback }),
  );
  checks.push({
    segmentIndex: index,
    expectedSeconds: expected.startSeconds,
    playback,
  });
  const rect = await d.read(
    'const r=document.querySelector("audio").getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};',
  );
  await d.clickAt(rect.x + 20, rect.y + rect.height / 2);
  assert.equal(
    await d.read('return document.querySelector("audio").paused;'),
    true,
  );
}
await d.screenshot('v031-independent-90-replay');
await fs.writeFile(
  `${root}/independent-replay.json`,
  JSON.stringify(
    {
      passed: true,
      lectureId: result.lectureId,
      durationSeconds: duration,
      segments: detail.segments.length,
      allSavedRowsLocalAndTranslated: true,
      checks,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    passed: true,
    durationSeconds: duration,
    segments: detail.segments.length,
    checkedTimestamps: checks.map((c) => c.expectedSeconds),
  }),
);
