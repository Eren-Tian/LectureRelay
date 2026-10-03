// Real installed Qwen: start/cancel, restart externally, then resume the exact v0.3 transcript.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const root = 'target/acceptance-v0.3.1';
const id = '453ce015-e9bb-4ee2-adcf-34975ce4d600';
const courseName = '[ACCEPTANCE 2026-10-03] Local AI classroom';
const stage = process.argv[2] || 'cancel';
const d = await WebDriver.current();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, accept = Boolean, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await pause(500);
  }
  throw Error('Acceptance wait timed out');
}
let b = await d.native('bootstrap');
assert.equal(b.storage.version, '0.3.1');
assert.equal(b.settings.studyMode, 'local');
assert.equal(b.settings.provider, 'none');
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
if (!b.courses.some((c) => c.name === courseName)) {
  await d.clickText('Settings');
  await d.clickText('Data');
  const e = await d.read(
    "return [...document.querySelectorAll('.credential-row')].find(e=>e.querySelector('span')?.textContent===arguments[0])?.querySelector('button');",
    [courseName],
  );
  assert.ok(e, 'Exact saved acceptance course must exist in Trash');
  await d.command(
    'POST',
    `/element/${e['element-6066-11e4-a52e-4f735466cecf']}/click`,
    {},
  );
  await wait(
    () => d.native('bootstrap'),
    (v) => v.courses.some((c) => c.name === courseName),
  );
}
if (b.settings.quietMode) {
  await d.clickText('Settings');
  await d.clickText('General');
  await d.click('input[aria-label="Quiet Mode"]');
  await wait(
    () => d.native('bootstrap'),
    (v) => !v.settings.quietMode,
  );
}
const detail = await d.native('lecture_detail', { id });
assert.equal(detail.segments.length, 460);
assert.ok(detail.lecture.durationSeconds >= 5400);
const before = await d.native('study_state', { id });
if (stage === 'cancel')
  await fs.writeFile(
    `${root}/review-before.json`,
    JSON.stringify({ detail, study: before }, null, 2),
  );
await d.clickText('Courses');
await d.course(courseName);
await d.lecture(detail.lecture.title);
await d.clickText('Notes');
const disclosure = await d.read(
  "return [...document.querySelectorAll('summary')].find(e=>e.textContent.trim()==='Review the whole class');",
);
await d.command(
  'POST',
  `/element/${disclosure['element-6066-11e4-a52e-4f735466cecf']}/click`,
  {},
);
if (stage === 'cancel') {
  await d.fill(
    'textarea[placeholder^="Explain the key concepts"]',
    'Review every transcript section in this recorded class. Deduplicate repeated passages. Explain the main concepts, distinguish evidence from interpretation, preserve numbers and negation, cite recording timestamps, and include three practice questions. Use only the actual transcript as evidence; course background is not evidence.',
  );
  await d.clickText('Generate review');
} else {
  const cancelled = JSON.parse(
    await fs.readFile(`${root}/review-cancel.json`, 'utf8'),
  );
  const saved = before.reviews.find((r) => r.id === cancelled.review.id);
  assert.ok(saved);
  assert.deepEqual(saved.parts, cancelled.review.parts);
  await d.clickText('Resume review');
}
const start = Date.now();
await wait(() => d.native('job_status'));
const progress = [];
let cancelSent = false,
  lastMinute = -1;
while (Date.now() - start < 45 * 60000) {
  const job = await d.native('job_status');
  const study = await d.native('study_state', { id });
  const review = study.reviews[0];
  const event = {
    seconds: (Date.now() - start) / 1000,
    job,
    sections: review?.parts.filter((p) => p.body !== null).length,
    total: review?.parts.length,
    levels: review?.levels.map((v) => v.length),
    recoveries: review?.recoveries,
    state: review?.state,
    message: review?.message,
  };
  progress.push(event);
  await fs.writeFile(
    `${root}/review-${stage}-progress.json`,
    JSON.stringify(event, null, 2),
  );
  if (Math.floor(event.seconds / 60) !== lastMinute) {
    console.log(JSON.stringify(event));
    lastMinute = Math.floor(event.seconds / 60);
  }
  if (stage === 'cancel' && !cancelSent && event.sections >= 1 && job) {
    await d.clickText('Cancel');
    cancelSent = true;
  }
  if (!job) {
    const latest = await d.native('lecture_detail', { id });
    assert.deepEqual(latest.segments, detail.segments);
    assert.deepEqual(latest.note, detail.note);
    for (const v of before.versions)
      assert.deepEqual(
        study.versions.find((s) => s.id === v.id),
        v,
      );
    if (stage === 'cancel') {
      assert.ok(cancelSent);
      assert.equal(review.state, 'paused');
      assert.equal(review.publishedVersion, null);
      assert.ok(event.sections > 0);
    } else {
      assert.ok(review.publishedVersion, review.message);
      assert.equal(review.state, 'completed');
      assert.ok(review.parts.every((p) => p.body));
      assert.equal(review.levels.at(-1).length, 1);
    }
    await fs.writeFile(
      `${root}/review-${stage}.json`,
      JSON.stringify(
        {
          passed: true,
          seconds: event.seconds,
          id,
          review,
          progress,
          versions: study.versions,
        },
        null,
        2,
      ),
    );
    await d.screenshot(`v031-review-${stage}`);
    console.log(
      JSON.stringify({
        passed: true,
        stage,
        seconds: event.seconds,
        sections: event.sections,
        total: event.total,
        recoveries: review.recoveries,
      }),
    );
    process.exit(0);
  }
  await pause(3000);
}
throw Error('Real review did not finish within 45 minutes');
