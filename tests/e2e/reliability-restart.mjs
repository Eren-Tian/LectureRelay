// After the controlled crash, verify only known labelled lectures and persisted snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const root = 'target/acceptance-v0.3.1',
  d = await WebDriver.current();
const pending = JSON.parse(
  await fs.readFile(`${root}/crash-pending.json`, 'utf8'),
);
const faults = JSON.parse(await fs.readFile(`${root}/faults.json`, 'utf8'));
assert.equal((await d.native('bootstrap')).storage.version, '0.3.1');
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
const recovered = await d.native('lecture_detail', { id: pending.lectureId });
assert.ok(recovered.lecture.title.startsWith('[ACCEPTANCE] v0.3.1 fault'));
assert.equal(recovered.lecture.status, 'interrupted');
assert.ok(
  recovered.lecture.durationSeconds >=
    pending.beforeCrash.durationSeconds - 1.5,
);
await d.clickText('Courses');
await d.course(recovered.course.name);
await d.lecture(recovered.lecture.title);
for (let i = 0; i < 50; i++) {
  if (await d.read('return document.querySelector("audio")?.readyState>=1;'))
    break;
  await new Promise((r) => setTimeout(r, 200));
}
const rect = await d.read(
  'const r=document.querySelector("audio").getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};',
);
await d.clickAt(rect.x + 20, rect.y + rect.height / 2);
await new Promise((r) => setTimeout(r, 900));
const playback = await d.read(
  'const a=document.querySelector("audio");return {seconds:a.currentTime,paused:a.paused,error:a.error?.code};',
);
assert.ok(playback.seconds > 0 && !playback.paused && !playback.error);
await d.clickAt(rect.x + 20, rect.y + rect.height / 2);
const short = JSON.parse(await fs.readFile(`${root}/study-final.json`, 'utf8'));
const after = await d.native('lecture_detail', { id: short.detail.lecture.id });
for (const k of ['lecture', 'segments', 'note', 'answers'])
  assert.deepEqual(after[k], short.detail[k]);
const study = await d.native('study_state', { id: short.detail.lecture.id });
for (const k of ['versions', 'marks', 'draft'])
  assert.deepEqual(study[k], short.study[k]);
const soak = JSON.parse(
  await fs.readFile(`${root}/independent-detail.json`, 'utf8'),
);
const afterSoak = await d.native('lecture_detail', { id: soak.lecture.id });
for (const k of ['lecture', 'segments'])
  assert.deepEqual(afterSoak[k], soak[k]);
const long = JSON.parse(
  await fs.readFile(`${root}/review-resume.json`, 'utf8'),
);
const oldStudy = await d.native('study_state', { id: long.id });
for (const version of long.versions)
  assert.deepEqual(
    oldStudy.versions.find((v) => v.id === version.id),
    version,
  );
await fs.writeFile(
  `${root}/${pending.lectureId}-fault-detail.json`,
  JSON.stringify({ detail: recovered, playback }, null, 2),
);
const result = {
  passed: true,
  faults: [
    ...faults.slice(0, 3),
    {
      name: 'Unexpected exit recovers checkpointed audio and plays',
      lectureId: pending.lectureId,
      beforeSeconds: pending.beforeCrash.durationSeconds,
      recoveredSeconds: recovered.lecture.durationSeconds,
      playback,
    },
  ],
  persistence: {
    manualNotes: true,
    shortAI: true,
    new90MinuteTranscript: true,
    previousLongReview: true,
  },
};
await fs.writeFile(
  `${root}/faults-completed.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
