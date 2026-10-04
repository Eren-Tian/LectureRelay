// Actual installed WebView. Permanent deletion targets only the course created by this run.
// Free-all confirmation is cancelled; full destructive cleanup was tested in the isolated library.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebDriver } from './webdriver.mjs';
const d = await WebDriver.current(),
  root = 'target/acceptance-v0.3.1';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (read, accept = Boolean) => {
  for (let i = 0; i < 200; i++) {
    const v = await read();
    if (accept(v)) return v;
    await pause(100);
  }
  throw Error('Installed UI wait timed out');
};
const original = await d.native('bootstrap');
assert.equal(original.storage.version, '0.3.1');
assert.equal(await d.native('recording_status'), null);
const modelsBefore = await d.native('local_text_models');
assert.ok(modelsBefore.every((m) => m.installed));
assert.ok((await d.native('local_model_status')).installed);
const stage = JSON.parse(await fs.readFile(`${root}/stage-short.json`, 'utf8'));
await d.clickText('Courses');
await d.course('[ACCEPTANCE 2026-10-03] Local AI classroom');
await d.lecture(stage.title);
const exports = original.storage.exports;
const before = new Set(await fs.readdir(exports));
await d.click(
  'select[aria-label="Export format"] option[value="transcript-json"]',
);
await d.clickText('Export');
const names = await wait(
  () => fs.readdir(exports),
  (v) =>
    v.some(
      (n) => !before.has(n) && n.includes(stage.id) && n.endsWith('.json'),
    ),
);
const file = names.find(
  (n) => !before.has(n) && n.includes(stage.id) && n.endsWith('.json'),
);
const exported = JSON.parse(
  await fs.readFile(path.join(exports, file), 'utf8'),
);
const rows = Array.isArray(exported) ? exported : exported.segments;
assert.ok(
  rows.length &&
    rows.every((s) => s.origin === 'local' && s.provider === 'local'),
);
await d.clickText('Settings');
await d.clickText('AI Providers');
await d.click(
  'select:has(option[value="groq"]):has(option[value="local"]) option[value="none"]',
);
await d.clickText('Save changes');
await wait(
  () => d.native('bootstrap'),
  (v) => v.settings.speechProvider === 'none',
);
await d.clickText('Courses');
await d.clickText('New Course');
const name = `[ACCEPTANCE 2026-10-03] Disposable v0.3.1 UI ${Date.now()}`;
await d.fill('.modal input[maxlength="150"]', name);
await d.fill(
  '.modal textarea',
  'Non-sensitive disposable UI fixture created only for confirmed deletion acceptance.',
);
await d.clickText('Save Course');
const course = (
  await wait(
    () => d.native('bootstrap'),
    (v) => v.courses.some((c) => c.name === name),
  )
).courses.find((c) => c.name === name);
await d.clickText('Start Lecture');
await d.click('.modal select option[value="system"]');
await d.fill('.modal input', '[ACCEPTANCE] Fractional and deletion fixture');
await d.clickText('Start Recording');
const rec = await wait(() => d.native('recording_status'));
const controls = await d.read(
  `const e=[...document.querySelectorAll('button')].find(e=>e.innerText.trim()==='Stop & save');const r=e.getBoundingClientRect();return {width:innerWidth,height:innerHeight,toasts:document.querySelectorAll('.toast').length,stopVisible:r.top>=0&&r.bottom<=innerHeight,stopClickable:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};`,
);
assert.ok(
  controls.width > controls.height &&
    controls.toasts > 0 &&
    controls.stopVisible &&
    controls.stopClickable,
  JSON.stringify(controls),
);
await d.screenshot('v031-landscape-toast-controls');
await pause(4300);
await d.clickText('Stop & save');
await wait(
  () => d.native('recording_status'),
  (v) => v === null,
);
const detail = await d.native('lecture_detail', { id: rec.lectureId });
await d.clickText('+ Segment');
const times = await d.read(
  "return [...document.querySelectorAll('.modal input[type=number]')].map(e=>({value:e.value,valid:e.checkValidity()}));",
);
assert.equal(Number(times[1].value), detail.lecture.durationSeconds);
assert.ok(times.every((t) => t.valid));
await d.fill('.modal textarea[rows="4"]', 'There were 120 students, not 12.');
await d.clickText('Save Transcript');
await wait(
  () => d.native('lecture_detail', { id: rec.lectureId }),
  (v) => v.segments.length === 1,
);
await d.click('.segment-edit');
const inputs = await d.read(
  "return [...document.querySelectorAll('.modal input[type=number]')];",
);
for (const [i, value] of [
  '0.001234',
  String(detail.lecture.durationSeconds - 0.000123),
].entries()) {
  const id = inputs[i]['element-6066-11e4-a52e-4f735466cecf'];
  await d.command('POST', `/element/${id}/clear`, {});
  await d.command('POST', `/element/${id}/value`, {
    text: value,
    value: [...value],
  });
}
await d.clickText('Save Transcript');
const edited = await wait(
  () => d.native('lecture_detail', { id: rec.lectureId }),
  (v) => v.segments[0].startSeconds === 0.001234,
);
assert.equal(
  edited.segments[0].endSeconds,
  detail.lecture.durationSeconds - 0.000123,
);
await d.clickText('Courses');
await d.course(name);
await d.clickText('Move to Trash');
await d.click('.modal button.danger');
await d.clickText('Settings');
await d.clickText('Data');
async function trashButton(label) {
  const e = await d.read(
    "return [...document.querySelectorAll('.credential-row')].find(e=>e.querySelector('span')?.textContent===arguments[0])?.querySelector(arguments[1]);",
    [name, label === 'Restore' ? 'button.secondary' : 'button.danger'],
  );
  assert.ok(e);
  await d.command(
    'POST',
    `/element/${e['element-6066-11e4-a52e-4f735466cecf']}/click`,
    {},
  );
}
await trashButton('Restore');
await wait(
  () => d.native('bootstrap'),
  (v) => v.courses.some((c) => c.id === course.id),
);
assert.equal(
  (await d.native('lecture_detail', { id: rec.lectureId })).segments[0]
    .sourceText,
  edited.segments[0].sourceText,
);
await d.clickText('Courses');
await d.course(name);
await d.clickText('Move to Trash');
await d.click('.modal button.danger');
await d.clickText('Settings');
await d.clickText('Data');
await trashButton('Delete');
assert.ok(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
);
await d.fill('.modal input', 'delete');
assert.ok(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
);
await d.clickText('Cancel');
assert.ok((await d.native('trash_courses')).some((c) => c.id === course.id));
await trashButton('Delete');
await d.fill('.modal input', 'DELETE');
assert.ok(
  (await d.native('trash_courses')).find((c) => c.id === course.id)?.name ===
    name,
);
await d.click('.modal button.danger');
await wait(
  () => d.native('trash_courses'),
  (v) => !v.some((c) => c.id === course.id),
);
await assert.rejects(
  fs.access(path.join(original.storage.library, 'Courses', course.id)),
);
assert.deepEqual(
  (await d.native('bootstrap')).courses.map((c) => c.id).sort(),
  original.courses.map((c) => c.id).sort(),
);
await d.clickText('Free all storage…');
await d.fill('.modal input', 'DELETE');
assert.ok(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
);
await d.fill('.modal input', 'DELETE ALL');
assert.equal(
  await d.read(
    "return document.querySelector('.modal button.danger').disabled;",
  ),
  false,
);
await d.clickText('Cancel');
assert.equal(
  (await d.native('lecture_detail', { id: stage.id })).segments.length,
  stage.detail.segments.length,
);
assert.ok((await d.native('local_model_status')).installed);
assert.deepEqual(
  (await d.native('local_text_models')).map((m) => [m.id, m.installed]),
  modelsBefore.map((m) => [m.id, m.installed]),
);
await d.clickText('AI Providers');
await d.click(
  'select:has(option[value="groq"]):has(option[value="local"]) option[value="local"]',
);
await d.clickText('Save changes');
await wait(
  () => d.native('bootstrap'),
  (v) => v.settings.speechProvider === 'local',
);
await fs.writeFile(
  `${root}/installed-ui.json`,
  JSON.stringify(
    {
      passed: true,
      controls,
      defaultDuration: detail.lecture.durationSeconds,
      preciseTimes: [
        edited.segments[0].startSeconds,
        edited.segments[0].endSeconds,
      ],
      exportedSegments: rows.length,
      exportName: file,
      createdAndDeletedCourse: course.id,
      restorePreservedEdits: true,
      wrongConfirmationAndCancelPreservedData: true,
      freeAllConfirmedButtonThenCancelled: true,
      productionModelsRetained: true,
    },
    null,
    2,
  ),
);
console.log('Installed UI regressions passed');
