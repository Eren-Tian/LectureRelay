// Destructive actions are confined to this explicitly labelled, debug-only throwaway library.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebDriver } from './webdriver.mjs';
const root = path.resolve('target/reliability-ui-2026-10-03');
const out = 'target/acceptance-v0.3.1';
const ids = JSON.parse(
  await fs.readFile(path.join(root, 'fixture.json'), 'utf8'),
);
const d = await WebDriver.current();
const checks = [];
const wait = async (read, accept = Boolean) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('UI wait timed out');
};
const b = await d.native('bootstrap');
assert.equal(
  path.resolve(b.storage.database),
  path.join(root, 'app-data/app.db'),
);
assert.equal(b.storage.version, '0.3.1');
assert.equal(await d.native('job_status'), null);
await d.course(ids[1].name);
await d.lecture(ids[1].title);
await d.clickText('+ Segment');
const times = await d.read(
  "return [...document.querySelectorAll('.modal input[type=number]')].map(e=>({value:e.value,step:e.step,valid:e.checkValidity()}));",
);
assert.equal(times[1].value, '7.95');
assert.ok(times.every((v) => v.valid));
await d.fill('.modal textarea', 'The trial had 120 students, not 12.');
await d.clickText('Save Transcript');
let detail = await wait(
  () => d.native('lecture_detail', { id: ids[1].lectureId }),
  (v) => v.segments.length === 1,
);
assert.equal(detail.segments[0].endSeconds, 7.95);
await d.click('button[aria-label^="Edit segment at"]');
await d.fill('.modal input[type=number]:first-of-type', '0.001234');
// Label-based selection avoids both number fields being first children of their labels.
const endInput = await d.read(
  "return document.querySelectorAll('.modal input[type=number]')[1];",
);
await d.command(
  'POST',
  `/element/${endInput['element-6066-11e4-a52e-4f735466cecf']}/clear`,
  {},
);
await d.command(
  'POST',
  `/element/${endInput['element-6066-11e4-a52e-4f735466cecf']}/value`,
  { text: '7.94987', value: [...'7.94987'] },
);
await d.clickText('Save Transcript');
detail = await wait(
  () => d.native('lecture_detail', { id: ids[1].lectureId }),
  (v) => v.segments[0].startSeconds === 0.001234,
);
assert.equal(detail.segments[0].endSeconds, 7.94987);
checks.push(
  'Fractional defaults and precise edits save through the native WebView',
);
await d.click('button[aria-label^="Edit segment at"]');
const e = await d.read(
  "return document.querySelectorAll('.modal input[type=number]')[1];",
);
await d.command(
  'POST',
  `/element/${e['element-6066-11e4-a52e-4f735466cecf']}/clear`,
  {},
);
await d.command(
  'POST',
  `/element/${e['element-6066-11e4-a52e-4f735466cecf']}/value`,
  { text: '8', value: ['8'] },
);
assert.equal(
  await d.read("return document.querySelector('.modal form').checkValidity();"),
  false,
);
await d.clickText('Cancel');
checks.push('Beyond-duration input is rejected');
await d.clickText('Settings');
await d.clickText('Data');
await d.clickText('Delete permanently');
assert.equal(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
  true,
);
await d.fill('.modal input', 'delete');
assert.equal(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
  true,
);
await d.clickText('Cancel');
assert.equal((await d.native('trash_courses')).length, 1);
await d.clickText('Delete permanently');
await d.fill('.modal input', 'DELETE');
await d.click('.modal button.danger');
await wait(
  () => d.native('trash_courses'),
  (v) => v.length === 0,
);
await fs.access(path.join(root, 'library/Courses', ids[1].courseId));
await assert.rejects(
  fs.access(path.join(root, 'library/Courses', ids[0].courseId)),
);
assert.equal(
  (await d.native('lecture_detail', { id: ids[1].lectureId })).note.body,
  'Keep manual notes',
);
checks.push(
  'Permanent delete requires exact text; Cancel preserves course; confirmed delete preserves other course',
);
await d.clickText('Free all storage…');
assert.equal(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
  true,
);
await d.fill('.modal input', 'DELETE');
assert.equal(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
  true,
);
await d.clickText('Cancel');
assert.equal((await d.native('bootstrap')).courses.length, 1);
await d.clickText('Free all storage…');
await d.fill('.modal input', 'DELETE ALL');
await d.click('.modal button.danger');
await wait(
  () => d.native('bootstrap'),
  (v) => v.courses.length === 0,
);
await wait(() =>
  d.read("return document.body.innerText.includes('Storage freed.');"),
);
assert.equal((await fs.readdir(path.join(root, 'library/Courses'))).length, 0);
assert.equal((await fs.readdir(path.join(root, 'library/Exports'))).length, 0);
assert.equal((await fs.readdir(path.join(root, 'app-data/models'))).length, 0);
assert.equal((await d.native('bootstrap')).settings.theme, b.settings.theme);
checks.push(
  'Free all storage requires DELETE ALL; clears app library, exports and model files; preferences preserved',
);
await d.screenshot('v031-destructive-isolated');
await fs.writeFile(
  `${out}/destructive-ui.json`,
  JSON.stringify(
    {
      passed: true,
      scope: 'Isolated debug-only native WebView; no production data deletion',
      checks,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: true, checks }));
