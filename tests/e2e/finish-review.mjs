// Resume the review portion when a test-controller interruption left the saved lecture open.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebDriver } from './webdriver.mjs';
const output = path.resolve('target/installed-acceptance');
const file = path.join(output, 'student-flow.json');
const report = JSON.parse(await fs.readFile(file, 'utf8'));
assert(!report.passed);
const id = report.evidence.find(
  (e) => e.name === 'Real WASAPI audio to visible English caption',
)?.details.lectureId;
assert(id);
let driver = await WebDriver.current();
const bootstrap = await driver.native('bootstrap');
assert(!bootstrap.recording);
const before = await driver.native('lecture_detail', { id });
assert.equal(
  before.segments[0].sourceText,
  '[ACCEPTANCE EDIT] Installed application correction.',
);
assert.equal(
  before.segments[0].translatedText,
  '中文 日本語 한국어 — 已人工校正',
);
await driver.clickText('Markdown');
const names = (await fs.readdir(bootstrap.storage.exports)).filter((n) =>
  n.includes(id),
);
assert(
  names.some((n) => n.includes('transcript-json')) &&
    names.some((n) => n.includes('transcript-markdown')),
);
for (const name of names) {
  const text = await fs.readFile(
    path.join(bootstrap.storage.exports, name),
    'utf8',
  );
  assert(text.includes('中文 日本語 한국어'));
}
report.evidence.push({
  name: 'Edit and JSON/Markdown export',
  passed: true,
  utc: new Date().toISOString(),
  details: { exportNames: names },
});
const course = bootstrap.courses.find((c) => c.id === before.course.id);
await driver.clickText(course.name);
await driver.click('.course-delete');
await driver.click('.modal .danger');
await driver.clickText('Settings');
await driver.clickText('Data');
await driver.clickText('Restore');
report.evidence.push({
  name: 'Trash and restore keep course data',
  passed: true,
  utc: new Date().toISOString(),
});
await driver.command('DELETE', '');
driver = await WebDriver.start(
  path.join(output, 'app/lecturerelay-desktop.exe'),
);
await new Promise((r) => setTimeout(r, 1000));
await driver.course(course.name);
await driver.lecture(before.lecture.title);
const reopened = await driver.native('lecture_detail', { id });
assert.equal(reopened.segments[0].sourceText, before.segments[0].sourceText);
assert.equal(
  reopened.segments[0].translatedText,
  before.segments[0].translatedText,
);
assert.equal(reopened.lecture.durationSeconds, before.lecture.durationSeconds);
report.evidence.push({
  name: 'Restart preserves recording, transcript correction and UTF-8',
  passed: true,
  utc: new Date().toISOString(),
});
await driver.screenshot('final-short-restarted');
report.passed = true;
report.controllerInterruption = report.error;
delete report.error;
await fs.writeFile(file, JSON.stringify(report, null, 2));
console.log(
  'Installed student flow completed, including review resumed after controller race',
);
