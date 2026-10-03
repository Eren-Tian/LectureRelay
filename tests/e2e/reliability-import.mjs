// Begin opens the real native picker; choose the known local fixture with native UI.
// Verify checks actual failure metadata, visible wording and original-file preservation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { WebDriver } from './webdriver.mjs';
const root = 'target/acceptance-v0.3.1';
const d = await WebDriver.current();
const b = await d.native('bootstrap');
assert.equal(b.storage.version, '0.3.1');
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
const course = b.courses.find(
  (c) => c.name === '[ACCEPTANCE 2026-10-03] Local AI classroom',
);
assert.ok(course);
const fixture = path.resolve(root, 'invalid-media.wav');
const hash = async () =>
  createHash('sha256')
    .update(await fs.readFile(fixture))
    .digest('hex');
if (process.argv[2] === 'begin') {
  const title = `[ACCEPTANCE] v0.3.1 invalid media ${Date.now()}`;
  const before = await d.native('course_detail', { id: course.id });
  await fs.writeFile(
    `${root}/import-pending.json`,
    JSON.stringify(
      {
        title,
        fixture,
        sha256: await hash(),
        existingLectureIds: before.lectures.map((l) => l.id),
      },
      null,
      2,
    ),
  );
  await d.clickText('Courses');
  await d.course(course.name);
  await d.clickText('Import media');
  await d.fill('.modal input', title);
  await d.clickText('Choose file');
  console.log(JSON.stringify({ chooseInNativePicker: fixture, title }));
} else if (process.argv[2] === 'verify') {
  const pending = JSON.parse(
    await fs.readFile(`${root}/import-pending.json`, 'utf8'),
  );
  let detail;
  for (let i = 0; i < 100; i++) {
    detail = await d.native('course_detail', { id: course.id });
    if (
      detail.lectures.some(
        (l) => l.title === pending.title && l.status === 'failed',
      )
    )
      break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const imported = detail.lectures.find((l) => l.title === pending.title);
  assert.ok(imported);
  assert.equal(imported.status, 'failed');
  assert.equal(imported.audioSource, 'import');
  assert.equal(await hash(), pending.sha256);
  assert.ok(
    pending.existingLectureIds.every((id) =>
      detail.lectures.some((l) => l.id === id),
    ),
  );
  const message = await d.read(
    'return document.querySelector(".toast")?.innerText || null;',
  );
  if (message) assert.doesNotMatch(message, /Recording did not start/);
  if (await d.read('return !!document.querySelector(".modal");'))
    await d.clickText('Cancel');
  await d.clickText('Courses');
  await d.course(course.name);
  const rowText = await d.read(
    'return [...document.querySelectorAll(".lecture-row")].find(e=>e.querySelector("h3")?.textContent===arguments[0])?.textContent;',
    [pending.title],
  );
  assert.match(rowText, /Import failed/);
  await d.lecture(pending.title);
  const lectureText = await d.read('return document.body.innerText;');
  assert.match(lectureText, /Import failed/);
  assert.doesNotMatch(lectureText, /Recording did not start/);
  await d.screenshot('v031-import-failed');
  await fs.writeFile(
    `${root}/import-result.json`,
    JSON.stringify(
      {
        passed: true,
        lectureId: imported.id,
        title: pending.title,
        status: imported.status,
        audioSource: imported.audioSource,
        originalFileUnchanged: true,
        existingLecturesRetained: true,
        courseRowText: rowText,
        failedLectureWording: 'Import failed',
        errorMessage: message,
      },
      null,
      2,
    ),
  );
  console.log(
    'Installed invalid-import wording and original-file preservation passed',
  );
} else throw Error('Use begin or verify');
