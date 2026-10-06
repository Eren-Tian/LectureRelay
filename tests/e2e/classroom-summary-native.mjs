// Native WebView2 + real local Qwen, using an existing MIT OCW recording.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { WebDriver } from './webdriver.mjs';
const application = process.env.LECTURERELAY_SUMMARY_EXE;
assert.ok(application, 'Set LECTURERELAY_SUMMARY_EXE');
const reference = JSON.parse(
  await fs.readFile(
    new URL(
      '../../target/local-latency/mit-final/observation.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const output = new URL('../../target/classroom-summary/', import.meta.url);
const pause = () => new Promise((r) => setTimeout(r, 250));
async function until(check, seconds = 20) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await check()) return;
    await pause();
  }
  throw Error('Native summary check timed out');
}
const d = await WebDriver.start(application);
try {
  await until(() =>
    d.read(
      'return !!document.querySelector("input[aria-label=搜索全部课堂记录]");',
    ),
  );
  const before = await d.native('lecture_detail', { id: reference.lectureId });
  const recordingHash = async () =>
    crypto
      .createHash('sha256')
      .update(await fs.readFile(before.lecture.recordingPath))
      .digest('hex');
  const audioBefore = await recordingHash();
  const sourceBefore = JSON.stringify(before.segments);
  const bootstrap = await d.native('bootstrap');
  assert.equal(bootstrap.settings.studyMode, 'local');
  assert.ok(!bootstrap.job && !bootstrap.recording);
  await d.fill('input[aria-label=搜索全部课堂记录]', before.lecture.title);
  await until(() =>
    d.read('return document.querySelectorAll(".library-open").length===1;'),
  );
  await d.click('.library-open');
  await until(() => d.read('return !!document.querySelector(".study-tabs");'));
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
  const started = Date.now();
  const existingReviewIds = new Set(
    (await d.native('study_state', { id: reference.lectureId })).reviews.map(
      (r) => r.id,
    ),
  );
  const hasSummary = await d.read(
    'return document.querySelector(".summary-heading button").textContent.trim()==="重新整理";',
  );
  await d.clickText(hasSummary ? '重新整理' : '生成课堂要点');
  await until(
    async () =>
      (await d.native('study_state', { id: reference.lectureId })).reviews.some(
        (r) =>
          !existingReviewIds.has(r.id) &&
          !r.request &&
          r.state === 'completed' &&
          r.parts.every((p) => p.body),
      ),
    240,
  );
  const generationSeconds = (Date.now() - started) / 1000;
  await until(() =>
    d.read(
      'return [...document.querySelectorAll(".summary-card .summary-state")].some(e=>e.textContent==="AI 要点");',
    ),
  );
  const study = await d.native('study_state', { id: reference.lectureId });
  const review = study.reviews.find(
    (r) =>
      !existingReviewIds.has(r.id) && !r.request && r.state === 'completed',
  );
  assert.equal(review.origin, 'local');
  assert.equal(review.sourceVersion, study.sourceVersion);
  assert.equal(
    review.parts.map((p) => p.source).join(''),
    study.sections.map((s) => s.source).join(''),
  );
  assert.ok(review.parts.every((p) => /[\u4e00-\u9fff]/.test(p.body)));
  await d.click('.summary-time');
  await until(() =>
    d.read(
      'return !!document.querySelector("audio") && !document.querySelector("audio").paused;',
    ),
  );
  await d.read('document.querySelector("audio").pause();');
  await d.screenshot('classroom-summary-mit-qwen');
  await d.read(
    'document.querySelector(".summary-card > .text-button:last-child").click();',
  );
  await until(() =>
    d.read('return !!document.querySelector("textarea[aria-label=课堂笔记]");'),
  );
  assert.match(
    await d.read('return document.querySelector("textarea").value;'),
    /补充：/,
  );
  await until(async () =>
    (
      await d.native('study_state', { id: reference.lectureId })
    ).draft?.includes(review.parts[0].body),
  );
  const after = await d.native('lecture_detail', { id: reference.lectureId });
  assert.equal(JSON.stringify(after.segments), sourceBefore);
  assert.deepEqual(after.note, before.note);
  assert.equal(await recordingHash(), audioBefore);
  const report = {
    passed: true,
    scope:
      'Native debug EXE, real WebView2, local Qwen3.5-4B, Quiet Mode; existing 90-second MIT OCW speech transcript, no cloud or new audio capture',
    application,
    applicationSha256: crypto
      .createHash('sha256')
      .update(await fs.readFile(application))
      .digest('hex'),
    lectureId: reference.lectureId,
    generationSeconds,
    parts: review.parts.length,
    summary: review.parts.map((p) => p.body),
    reviewId: review.id,
    sourceVersion: study.sourceVersion,
    timestampPlayback: true,
    manualNotePreserved: true,
    originalTranscriptPreserved: true,
    audioSha256: audioBefore,
    audioPreserved: true,
  };
  await fs.writeFile(
    new URL('native.json', output),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({ ...report, summary: '<saved to ignored local evidence>' }),
  );
} finally {
  await d.command('DELETE', '');
}
