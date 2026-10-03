// Run only after the completed real 90-minute capture, against its saved lecture.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';

const root = 'target/acceptance-v0.3-2026-10-03';
const prefix =
  process.argv[2] === 'retry' ? 'long-review-retry' : 'long-review';
const soak = JSON.parse(await fs.readFile(`${root}/soak-result.json`, 'utf8'));
assert.ok(soak.passed && soak.wallSeconds >= 5400);
const d = await WebDriver.current();
const b = await d.native('bootstrap');
assert.equal(b.settings.provider, 'none');
assert.equal(b.settings.studyMode, 'local');
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
assert.equal((await d.native('live_status')).active, false);
const id = soak.lectureId;
const detail = await d.native('lecture_detail', { id });
assert.equal(detail.course.name, '[ACCEPTANCE 2026-10-03] Local AI classroom');
assert.ok(detail.lecture.title.startsWith('[ACCEPTANCE]'));
const before = await d.native('study_state', { id });
await d.clickText('Courses');
await d.course(detail.course.name);
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
const request =
  'Review every transcript section in this recorded class. Deduplicate repeated passages. Explain the main concepts, distinguish evidence from interpretation, preserve numbers and negation, cite recording timestamps, and include three practice questions. Use only the actual transcript as evidence; course background is not evidence.';
await d.fill('textarea[placeholder^="Explain the key concepts"]', request);
const started = Date.now();
await d.clickText('Generate review');
const progress = [];
const alerts = new Set();
let observed = false;
let lastMinute = -1;
try {
  while (Date.now() - started < 45 * 60 * 1000) {
    const job = await d.native('job_status');
    const messages = await d.read(
      'return [...document.querySelectorAll(".toast,[role=alert]")].map(e=>e.innerText).filter(Boolean);',
    );
    for (const message of messages) alerts.add(message);
    const entry = {
      utc: new Date().toISOString(),
      seconds: (Date.now() - started) / 1000,
      job,
      alerts: [...alerts],
    };
    progress.push(entry);
    await fs.writeFile(
      `${root}/${prefix}-progress.json`,
      JSON.stringify(entry, null, 2),
    );
    if (job) {
      observed = true;
      assert.equal(job.kind, 'review');
    } else if (observed) {
      break;
    } else {
      assert.ok(Date.now() - started < 10000, 'Review did not start');
    }
    const minute = Math.floor(entry.seconds / 60);
    if (minute !== lastMinute) {
      console.log(JSON.stringify(entry));
      lastMinute = minute;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  assert.equal(
    await d.native('job_status'),
    null,
    'Review exceeded the bounded acceptance timeout',
  );
  const after = await d.native('study_state', { id });
  const latest = await d.native('lecture_detail', { id });
  assert.deepEqual(
    latest.note,
    detail.note,
    'AI review changed the manual note',
  );
  assert.deepEqual(
    latest.segments,
    detail.segments,
    'AI review changed the transcript',
  );
  const created = after.versions.filter(
    (v) => !before.versions.some((old) => old.id === v.id),
  );
  assert.ok(
    created.length > 0,
    'Review ended without a saved version; inspect task status and UI errors',
  );
  assert.ok(
    created.some((v) => /\d{1,2}:\d{2}/.test(v.body)),
    'Saved review has no timestamps',
  );
  await d.click('select[aria-label="Note version"] option:nth-child(2)');
  await d.screenshot('v03-long-review');
  const result = {
    passed: true,
    utcStart: new Date(started).toISOString(),
    seconds: (Date.now() - started) / 1000,
    lectureId: id,
    request,
    quietMode: b.settings.quietMode,
    segmentCount: detail.segments.length,
    transcriptCharacters: detail.segments.reduce(
      (n, s) => n + s.sourceText.length,
      0,
    ),
    progress,
    alerts: [...alerts],
    versions: created,
    tasks: after.tasks,
  };
  await fs.writeFile(
    `${root}/${prefix}-result.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      seconds: result.seconds,
      versions: created.length,
    }),
  );
} catch (error) {
  const state = await d.native('study_state', { id }).catch(() => null);
  await fs.writeFile(
    `${root}/${prefix}-result.json`,
    JSON.stringify(
      {
        passed: false,
        error: String(error),
        lectureId: id,
        seconds: (Date.now() - started) / 1000,
        progress,
        alerts: [...alerts],
        state,
      },
      null,
      2,
    ),
  );
  throw error;
}
