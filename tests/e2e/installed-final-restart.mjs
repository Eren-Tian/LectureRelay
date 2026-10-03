// Run after manually restarting the installed app and moving its outer frame.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const root = 'target/acceptance-v0.3-2026-10-03';
const d = await WebDriver.current();
const pending = JSON.parse(
  await fs.readFile(`${root}/crash-pending.json`, 'utf8'),
);
const rawFaults = JSON.parse(await fs.readFile(`${root}/faults.json`, 'utf8'));
assert.equal(rawFaults.length, 4);
const b = await d.native('bootstrap');
assert.equal(b.settings.provider, 'none');
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
assert.equal((await d.native('live_status')).active, false);
const detail = await d.native('lecture_detail', { id: pending.lectureId });
assert.equal(detail.course.name, '[ACCEPTANCE 2026-10-03] Local AI classroom');
assert.equal(detail.lecture.status, 'interrupted');
assert.ok(
  detail.lecture.durationSeconds >= pending.beforeCrash.durationSeconds - 1.5,
);
await d.clickText('Courses');
await d.course(detail.course.name);
await d.lecture(detail.lecture.title);
const deadline = Date.now() + 10000;
while (
  !(await d.read('return document.querySelector("audio")?.readyState>=1;'))
) {
  assert.ok(Date.now() < deadline);
  await new Promise((r) => setTimeout(r, 200));
}
const rect = await d.read(
  'const r=document.querySelector("audio").getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};',
);
await d.clickAt(rect.x + 20, rect.y + rect.height / 2);
await new Promise((r) => setTimeout(r, 800));
const playback = await d.read(
  'const a=document.querySelector("audio");return {paused:a.paused,seconds:a.currentTime,duration:a.duration,error:a.error?.code};',
);
assert.ok(!playback.paused && playback.seconds > 0 && !playback.error);
await d.read('document.querySelector("audio").pause();return true;');
await d.screenshot('v03-crash-recovered');
await fs.writeFile(
  `${root}/${pending.lectureId}-fault-detail.json`,
  JSON.stringify({ detail, playback }, null, 2),
);
const short = JSON.parse(await fs.readFile(`${root}/study-final.json`, 'utf8'));
const shortNow = await d.native('lecture_detail', {
  id: short.detail.lecture.id,
});
const shortStudy = await d.native('study_state', {
  id: short.detail.lecture.id,
});
for (const key of ['lecture', 'segments', 'note', 'answers'])
  assert.deepEqual(
    shortNow[key],
    short.detail[key],
    `Short lecture ${key} changed across crash/restart`,
  );
for (const key of ['versions', 'marks', 'draft'])
  assert.deepEqual(
    shortStudy[key],
    short.study[key],
    `Short study ${key} changed across crash/restart`,
  );
const soak = JSON.parse(await fs.readFile(`${root}/soak-detail.json`, 'utf8'));
const soakNow = await d.native('lecture_detail', { id: soak.lecture.id });
for (const key of ['lecture', 'segments'])
  assert.deepEqual(
    soakNow[key],
    soak[key],
    `90-minute ${key} changed across crash/restart`,
  );
const review = JSON.parse(
  await fs.readFile(`${root}/long-review-result.json`, 'utf8'),
);
const soakStudy = await d.native('study_state', { id: soak.lecture.id });
if (review.passed)
  for (const version of review.versions)
    assert.deepEqual(
      soakStudy.versions.find((v) => v.id === version.id),
      version,
    );
const result = {
  passed: true,
  utc: new Date().toISOString(),
  faults: [
    ...rawFaults.slice(0, 3),
    {
      name: 'Unexpected app exit recovers readable and playable audio',
      details: {
        lectureId: pending.lectureId,
        beforeSeconds: pending.beforeCrash.durationSeconds,
        recoveredSeconds: detail.lecture.durationSeconds,
        playback,
      },
    },
  ],
  persistence: { short: true, soak: true, longReview: review.passed },
};
await fs.writeFile(
  `${root}/faults-completed.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
