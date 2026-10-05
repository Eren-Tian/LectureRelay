import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { WebDriver } from './webdriver.mjs';
const evidence = JSON.parse(
  await fs.readFile(
    new URL('../../target/classroom-summary/native.json', import.meta.url),
    'utf8',
  ),
);
let d = await WebDriver.start(evidence.application);
const pause = () => new Promise((r) => setTimeout(r, 200));
async function until(check) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await check()) return;
    await pause();
  }
  throw Error('Restart check timed out');
}
try {
  await until(() =>
    d.read(
      'return !!document.querySelector("input[aria-label=搜索全部课堂记录]");',
    ),
  );
  const study = await d.native('study_state', { id: evidence.lectureId });
  const review = study.reviews.find((r) => r.id === evidence.reviewId);
  assert.deepEqual(
    review.parts.map((p) => p.body),
    evidence.summary,
  );
  assert.equal(study.sourceVersion, evidence.sourceVersion);
  const detail = await d.native('lecture_detail', { id: evidence.lectureId });
  await d.fill('input[aria-label=搜索全部课堂记录]', detail.lecture.title);
  await until(() =>
    d.read('return document.querySelectorAll(".library-open").length===1;'),
  );
  await d.click('.library-open');
  await until(() =>
    d.read('return !!document.querySelector(".summary-card .markdown");'),
  );
  if (
    await d.read('return !!document.querySelector(".study-workspace.narrow");')
  )
    await d.clickText('学习工具');
  assert.equal(
    (
      await d.read(
        'return document.querySelector(".study-tabs [aria-selected=true]").textContent;',
      )
    ).trim(),
    '课堂要点',
  );
  assert.equal(await d.native('job_status'), null);
  // Exercise an explicit append, wait for this exact body (not an old draft),
  // then reopen SQLite after closing the app.
  await d.read(
    'document.querySelector(".summary-card > .text-button:last-child").click();',
  );
  await until(() =>
    d.read('return !!document.querySelector("textarea[aria-label=课堂笔记]");'),
  );
  const draft = await d.read(
    'return document.querySelector("textarea").value;',
  );
  assert.ok(draft.includes(evidence.summary[0]));
  await until(
    async () =>
      (await d.native('study_state', { id: evidence.lectureId })).draft ===
      draft,
  );
  await d.clickText('课堂要点');
  await d.screenshot('classroom-summary-restarted');
  await d.command('DELETE', '');
  d = await WebDriver.start(evidence.application);
  await until(() =>
    d.read(
      'return !!document.querySelector("input[aria-label=搜索全部课堂记录]");',
    ),
  );
  const reopened = await d.native('study_state', { id: evidence.lectureId });
  assert.equal(reopened.draft, draft);
  assert.deepEqual(
    reopened.reviews
      .find((r) => r.id === evidence.reviewId)
      .parts.map((p) => p.body),
    evidence.summary,
  );
  const report = {
    passed: true,
    nativeRestartShowsSummary: true,
    draftPreserved: true,
    sourceVersionPreserved: true,
    noAutomaticGeneration: true,
    reviewId: review.id,
    applicationSha256: crypto
      .createHash('sha256')
      .update(await fs.readFile(evidence.application))
      .digest('hex'),
  };
  await fs.writeFile(
    new URL(
      '../../target/classroom-summary/native-restart.json',
      import.meta.url,
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await d.command('DELETE', '');
}
