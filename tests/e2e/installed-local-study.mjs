// Run after installed-local-live short. UI mutations only; native reads verify persistence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const root =
  process.env.LECTURERELAY_ACCEPTANCE_ROOT ||
  'target/acceptance-v0.3-2026-10-03';
const recorded = JSON.parse(
  await fs.readFile(`${root}/short-result.json`, 'utf8'),
);
assert.equal(recorded.passed, true);
const id = recorded.lectureId;
const d = await WebDriver.current();
const configuration = (await d.native('bootstrap')).settings;
assert.equal(configuration.provider, 'none');
assert.equal(configuration.translationMode, 'local');
assert.equal(configuration.studyMode, 'local');
const checks = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, accept = Boolean, timeout = 300000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await sleep(500);
  }
  throw Error('Installed study acceptance timed out');
}
async function pass(name, details) {
  checks.push({ name, details, utc: new Date().toISOString() });
  await fs.writeFile(
    `${root}/study-checks.json`,
    JSON.stringify(checks, null, 2),
  );
  console.log(name);
}
async function jobDone() {
  await wait(
    () => d.native('job_status'),
    (v) => v !== null,
    10000,
  );
  await wait(
    () => d.native('job_status'),
    (v) => v === null,
  );
  await sleep(700);
}
const original = await d.native('lecture_detail', { id });
assert.ok(original.lecture.title.startsWith('[ACCEPTANCE]'));
await d.clickText('Courses');
await d.course(original.course.name);
await d.lecture(original.lecture.title);
await d.click('.segment-edit');
await d.fill(
  '.modal textarea[rows="4"]',
  original.segments[0].sourceText + ' [ACCEPTANCE correction]',
);
await d.fill('.modal textarea[rows="3"]', ' ');
await d.clickText('Save Transcript');
await wait(
  () => d.native('lecture_detail', { id }),
  (v) => !v.segments[0].translatedText,
);
await d.clickText('Translate missing');
await jobDone();
const translated = await d.native('lecture_detail', { id });
assert.ok(translated.segments[0].translatedText);
assert.ok(
  translated.segments[0].sourceText.endsWith('[ACCEPTANCE correction]'),
);
await pass(
  'Edit transcript and regenerate missing translation with real Hy-MT2',
  translated.segments[0],
);
await d.fill('input[aria-label="Search transcript"]', 'ACCEPTANCE correction');
await wait(
  () =>
    d.read('return document.querySelectorAll(".transcript-segment").length;'),
  (n) => n === 1,
);
await d.fill('input[aria-label="Search transcript"]', ' ');
await d.clickText('Write notes');
const manual =
  '# Manual acceptance notes\n\nDo not replace this text during AI processing. 中文 日本語 한국어.';
await d.fill('textarea[aria-label="Lecture notes"]', manual);
await wait(
  () => d.native('study_state', { id }),
  (v) => v.draft === manual,
);
await d.clickText('Save notes');
await wait(
  () => d.native('lecture_detail', { id }),
  (v) => v.note?.body === manual,
);
await d.clickText('Index');
await d.fill('input[aria-label="Bookmark label"]', 'Acceptance bookmark');
await d.clickText('Add');
await wait(
  () => d.native('study_state', { id }),
  (v) => v.marks.some((m) => m.label === 'Acceptance bookmark'),
);
await d.click('select[aria-label="Index type"] option[value="chapter"]');
await d.fill('input[aria-label="Bookmark label"]', 'Acceptance chapter');
await d.clickText('Add');
await wait(
  () => d.native('study_state', { id }),
  (v) => v.marks.some((m) => m.kind === 'chapter'),
);
await pass('Search, manual note draft/save, bookmark and chapter persist');
await d.clickText('Notes');
const before = await d.native('study_state', { id });
const summaryStart = Date.now();
await d.clickText('Generate AI draft');
await jobDone();
const summary = await d.native('study_state', { id });
assert.ok(summary.versions.length > before.versions.length);
assert.equal((await d.native('lecture_detail', { id })).note.body, manual);
await pass('Actual Qwen summary saved separately from manual notes', {
  milliseconds: Date.now() - summaryStart,
  versions: summary.versions,
});
const disclosure = await d.read(
  "return [...document.querySelectorAll('summary')].find(e=>e.textContent.trim()==='Review the whole class');",
);
await d.command(
  'POST',
  `/element/${disclosure['element-6066-11e4-a52e-4f735466cecf']}/click`,
  {},
);
await d.fill(
  'textarea[placeholder^="Explain the key concepts"]',
  'Explain the key concepts using only this transcript. Preserve negation and numbers. Cite timestamps and include two practice questions.',
);
await d.clickText('Generate review');
await wait(
  () => d.native('job_status'),
  (v) => v?.kind === 'review',
  10000,
);
const cancelStart = Date.now();
await d.clickText('Cancel');
await wait(
  () => d.native('job_status'),
  (v) => v === null,
  10000,
);
await sleep(700);
assert.equal((await d.native('lecture_detail', { id })).note.body, manual);
await pass('Cancel review returns control without losing notes', {
  milliseconds: Date.now() - cancelStart,
});
await d.clickText('Generate review');
await jobDone();
const review = await d.native('study_state', { id });
assert.ok(review.versions.length > summary.versions.length);
assert.equal((await d.native('lecture_detail', { id })).note.body, manual);
await d.click('select[aria-label="Note version"] option:nth-child(2)');
await d.screenshot(`v${(await d.native('bootstrap')).storage.version}-review`);
await pass(
  'User-directed Qwen full-class review creates a saved version',
  review.versions[0],
);
await d.clickText('Q&A');
await d.fill(
  '#lecture-question',
  'Does a statistical association establish causation? Explain from the lecture and cite sources.',
);
await d.click('.question-form button.primary');
await jobDone();
const answer = await d.native('lecture_detail', { id });
assert.ok(answer.answers[0].sources.length > 0);
assert.match(answer.answers[0].answer, /S[1-9]/);
await d.click('.answer-card summary');
await d.click('.source-chips button');
await sleep(500);
assert.equal(
  await d.read('return document.querySelector("audio").paused;'),
  false,
);
const audioRect = await d.read(
  'const r=document.querySelector("audio").getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};',
);
await d.clickAt(audioRect.x + 20, audioRect.y + audioRect.height / 2);
await pass(
  'Qwen Q&A produces source snapshots and playable citations',
  answer.answers[0],
);
await fs.writeFile(
  `${root}/study-final.json`,
  JSON.stringify(
    {
      configuration: {
        quietMode: configuration.quietMode,
        translationModel: configuration.translationModel,
        studyMode: configuration.studyMode,
      },
      detail: await d.native('lecture_detail', { id }),
      study: await d.native('study_state', { id }),
    },
    null,
    2,
  ),
);
console.log('Installed study flow passed');
