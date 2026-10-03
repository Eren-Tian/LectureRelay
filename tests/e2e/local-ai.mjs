// Real native WebView and CPU inference; synthetic debug-only library, no cloud calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const executable = new URL(
  '../../target/x86_64-pc-windows-msvc/debug/lecturerelay-desktop.exe',
  import.meta.url,
).pathname.replace(/^\//, '');
let d = await WebDriver.current();
const checks = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, accept = Boolean, timeout = 180000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await pause(250);
  }
  throw Error('Local AI UI acceptance timed out');
}
function pass(name, data) {
  checks.push({ name, data });
  console.log(name);
}
async function portrait() {
  const rect = await d.command('POST', '/window/maximize', {});
  assert.ok(
    rect.x < 0 && rect.x + rect.width <= 2,
    'Test window must stay on the left portrait monitor',
  );
  return rect;
}
async function clickSummary(text) {
  const e = await d.read(
    "return [...document.querySelectorAll('summary')].find(e=>e.textContent.trim()===arguments[0]);",
    [text],
  );
  assert.ok(e);
  await d.command(
    'POST',
    `/element/${e['element-6066-11e4-a52e-4f735466cecf']}/click`,
    {},
  );
}
async function finishJob() {
  await wait(
    () => d.native('job_status'),
    (v) => v !== null,
    10000,
  );
  await wait(
    () => d.native('job_status'),
    (v) => v === null,
  );
  await pause(700);
}
try {
  const bootstrap = await d.native('bootstrap');
  assert.ok(bootstrap.storage.database.includes('target\\local-ai-gui\\'));
  assert.equal(bootstrap.storage.version, '0.3.0');
  assert.equal(bootstrap.settings.provider, 'none');
  assert.equal(bootstrap.settings.translationMode, 'local');
  assert.equal(bootstrap.settings.studyMode, 'local');
  assert.equal(await d.native('recording_status'), null);
  pass('Isolated native WebView on portrait display', await portrait());
  const course = await d.native('course_detail', {
    id: bootstrap.courses[0].id,
  });
  const id = course.lectures[0].id;
  const original = await d.native('lecture_detail', { id });
  await d.clickText('Settings');
  await d.clickText('Local AI');
  await wait(() =>
    d.read("return document.body.innerText.includes('Qwen3.5-4B');"),
  );
  assert.equal(
    (await d.native('local_text_models')).filter((m) => m.installed).length,
    2,
  );
  await d.screenshot('local-ai-models');
  pass('Three model roles visible, both local text downloads recognized');
  await d.clickText('AI Providers');
  await d.click(
    'select:has(option[value="hy-mt2-1.8b"]) option[value="qwen3.5-4b"]',
  );
  await d.clickText('Save changes');
  await wait(
    () => d.native('bootstrap'),
    (v) => v.settings.translationModel === 'qwen3.5-4b',
  );
  await d.click(
    'select:has(option[value="hy-mt2-1.8b"]) option[value="hy-mt2-1.8b"]',
  );
  await d.clickText('Save changes');
  await wait(
    () => d.native('bootstrap'),
    (v) => v.settings.translationModel === 'hy-mt2-1.8b',
  );
  await d.screenshot('local-ai-providers');
  pass('Local translation choices save independently from shared study model');
  await d.clickText('General');
  await d.click('input[aria-label="Quiet Mode"]');
  await wait(
    () => d.native('bootstrap'),
    (v) => v.settings.quietMode,
  );
  await d.click('input[aria-label="Quiet Mode"]');
  await wait(
    () => d.native('bootstrap'),
    (v) => !v.settings.quietMode,
  );
  pass('Global Quiet Mode persists through the UI');
  await d.clickText('Courses');
  await d.click('.library-open');
  await wait(() =>
    d.read("return !!document.querySelector('.transcript-panel');"),
  );
  await d.click('button[aria-label="Edit segment at 00:01"]');
  // WebDriver clear alone does not dispatch React's input event; whitespace is normalized on save.
  await d.fill('[role="dialog"] textarea[rows="3"]', ' ');
  await d.click('[role="dialog"] button.primary');
  await wait(
    () => d.native('lecture_detail', { id }),
    (v) => !v.segments[0].translatedText,
  );
  await d.clickText('Translate missing');
  await finishJob();
  const translated = await d.native('lecture_detail', { id });
  assert.ok(translated.segments[0].translatedText.includes('ATP'));
  assert.equal(
    translated.segments[0].sourceText,
    original.segments[0].sourceText,
  );
  pass(
    'UI translation invokes real Hy-MT2 and saves translated segment',
    translated.segments[0].translatedText,
  );
  await d.clickText('Generate AI draft');
  await finishJob();
  const study = await d.native('study_state', { id });
  assert.ok(
    study.versions.some((v) => v.origin === 'local' && v.body.includes('ATP')),
  );
  assert.equal(
    (await d.native('lecture_detail', { id })).note.body,
    original.note.body,
  );
  pass('Qwen summary saved separately; manual notes preserved');
  await clickSummary('Review the whole class');
  await d.fill(
    'textarea[placeholder^="Explain the key concepts"]',
    'Explain ATP, keep the timestamps, and include two practice questions.',
  );
  await d.clickText('Generate review');
  await wait(
    () => d.native('job_status'),
    (v) => v?.kind === 'review',
  );
  await wait(() =>
    d.read(
      "return !![...document.querySelectorAll('button')].find(e=>e.innerText.trim()==='Cancel');",
    ),
  );
  await d.clickText('Cancel');
  await wait(
    () => d.native('job_status'),
    (v) => v === null,
    10000,
  );
  await pause(700);
  pass('Review cancellation returns control and retains saved notes');
  await d.clickText('Generate review');
  await finishJob();
  const reviewed = await d.native('study_state', { id });
  assert.ok(reviewed.versions.length > study.versions.length);
  await d.click('select[aria-label="Note version"] option:nth-child(2)');
  await d.screenshot('local-ai-review');
  pass('User-directed whole-class review creates another timestamped version');
  await d.clickText('Q&A');
  await d.fill('#lecture-question', 'What produces ATP? Cite the source.');
  await d.click('.question-form button.primary');
  await finishJob();
  const answered = await d.native('lecture_detail', { id });
  assert.ok(answered.answers[0].sources.length > 0);
  assert.ok(answered.answers[0].answer.includes('S1'));
  await d.screenshot('local-ai-question');
  pass('Local Q&A stores answer and clickable source snapshots');
  assert.equal(
    await d.read(
      "return document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+1;",
    ),
    false,
  );
  await d.command('DELETE', '');
  d = await WebDriver.start(executable);
  await wait(() => d.native('bootstrap'));
  await portrait();
  const reopened = await d.native('lecture_detail', { id });
  assert.equal(reopened.answers.length, answered.answers.length);
  assert.equal(
    (await d.native('study_state', { id })).versions.length,
    reviewed.versions.length,
  );
  assert.equal(reopened.note.body, original.note.body);
  pass('Restart preserves AI versions, sources, translation and manual notes');
} finally {
  await fs.writeFile(
    'target/local-ai-evaluation/gui-results.json',
    JSON.stringify({ checks }, null, 2),
  );
}
