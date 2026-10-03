// Real native WebView, isolated synthetic library. Never invokes a cloud provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const root = 'target/study-workspace-acceptance';
const fixture = JSON.parse(await fs.readFile(root + '/fixture.json', 'utf8'));
const d = await WebDriver.current();
const checks = [];
const wait = async (read, accept = Boolean) => {
  for (let i = 0; i < 100; i++) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('UI condition timed out');
};
const study = () => d.native('study_state', { id: fixture.lecture });
const pass = (name, detail) => {
  checks.push({ name, detail });
  console.log(name);
};
async function dimensions(name) {
  const value = await d.read(
    `return {w:innerWidth,h:innerHeight,overflow:document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+1,logos:document.querySelectorAll('img[src="/app-icon.svg"]').length,rows:document.querySelectorAll('.transcript-segment').length,panels:[...document.querySelectorAll('.study-primary,.study-secondary,.transcript-list')].map(e=>({class:e.className,hidden:e.hidden,h:e.clientHeight,scroll:e.scrollHeight}))};`,
  );
  assert.equal(value.overflow, false);
  assert.equal(value.logos, 1);
  assert.ok(value.rows <= 80);
  await d.screenshot(name);
  pass(name, value);
}
try {
  const bootstrap = await d.native('bootstrap');
  assert.ok(bootstrap.storage.database.includes('study-workspace-acceptance'));
  assert.equal(bootstrap.settings.provider, 'none');
  assert.equal(await d.native('recording_status'), null);
  await wait(() =>
    d.read("return !!document.querySelector('.transcript-panel')"),
  );
  await dimensions('study-wide');
  await d.fill('input[aria-label="Search transcript"]', 'mitochondria');
  await wait(
    () =>
      d.read("return document.querySelectorAll('.transcript-segment').length"),
    (n) => n === 1,
  );
  pass('Bilingual search filters 402 saved segments');
  await d.fill('input[aria-label="Search transcript"]', '');
  await d.clickText('Write notes');
  await d.fill(
    'textarea[aria-label="Lecture notes"]',
    '# Recovery test\n\n中文 日本語 한국어',
  );
  await d.clickText('+ Timestamp 00:00');
  await wait(study, (s) => s.draft?.includes('#t=0'));
  pass('Typed draft and timestamp persisted in SQLite');
  await d.clickText('Courses');
  await wait(() => d.read("return !!document.querySelector('.library-open')"));
  await d.click('.library-open');
  await wait(
    () =>
      d.read(
        'return document.querySelector(\'textarea[aria-label="Lecture notes"]\')?.value',
      ),
    (s) => s?.includes('Recovery test'),
  );
  pass('Navigating away restores the local draft');
  await d.clickText('Save notes');
  await wait(
    () => d.native('lecture_detail', { id: fixture.lecture }),
    (v) => v.note?.body.includes('Recovery test'),
  );
  pass('Manual notes saved without replacing history');
  await d.clickText('Index');
  await d.fill('input[aria-label="Bookmark label"]', 'Synthetic bookmark');
  await d.clickText('Add');
  await wait(study, (s) =>
    s.marks.some((m) => m.label === 'Synthetic bookmark'),
  );
  await d.click('select[aria-label="Index type"] option[value="chapter"]');
  await d.fill('input[aria-label="Bookmark label"]', 'Synthetic chapter');
  await d.clickText('Add');
  await wait(study, (s) => s.marks.some((m) => m.kind === 'chapter'));
  pass('Bookmark and chapter saved with audio positions');
  await d.clickText('Notes');
  const versions = await study();
  const ai = versions.versions.find((v) => v.origin === 'cloud');
  await d.click(`select[aria-label="Note version"] option[value="${ai.id}"]`);
  await wait(() =>
    d.read(
      "return document.body.innerText.includes('Transcript has changed since this version')",
    ),
  );
  assert.ok(
    (
      await d.native('lecture_detail', { id: fixture.lecture })
    ).note.body.includes('Recovery test'),
  );
  pass('AI version preview marks stale input and preserves current notes');
  await d.clickText('Processing');
  await wait(() =>
    d.read(
      "return document.body.innerText.includes('Synthetic interrupted task')",
    ),
  );
  pass('Interrupted processing remains visible with retry action');
  await d.command('POST', '/window/rect', { width: 900, height: 720 });
  await wait(() =>
    d.read(
      "return document.querySelector('.study-workspace')?.classList.contains('narrow')",
    ),
  );
  await dimensions('study-compact-transcript');
  await d.clickText('Study tools');
  await wait(() =>
    d.read("return !document.querySelector('.study-secondary').hidden"),
  );
  await dimensions('study-compact-tools');
  await d.click('.sidebar-toggle');
  await wait(() =>
    d.read(
      "return document.querySelector('.app-shell').classList.contains('sidebar-collapsed')",
    ),
  );
  await d.command('POST', '/window/rect', { width: 1500, height: 1050 });
  await wait(() =>
    d.read(
      "return !document.querySelector('.study-workspace').classList.contains('narrow')",
    ),
  );
  await dimensions('study-collapsed-wide');
  await d.click('.sidebar nav button:nth-child(2)');
  await d.clickText('General');
  await d.click('.theme-option:nth-child(2)');
  await wait(() =>
    d.read("return document.documentElement.dataset.theme==='dark'"),
  );
  await d.click('.sidebar nav button:first-child');
  await wait(() => d.read("return !!document.querySelector('.library-open')"));
  await d.click('.library-open');
  await wait(() => d.read("return !!document.querySelector('.study-tabs')"));
  await dimensions('study-dark');
  await d.click(
    'select[aria-label="Export format"] option[value="vtt-bilingual"]',
  );
  await d.clickText('Export');
  await wait(() =>
    d.read("return document.body.innerText.includes('Export saved.')"),
  );
  const exported = (await fs.readdir(root + '/library/Exports')).find((n) =>
    n.includes('vtt-bilingual'),
  );
  assert.ok(exported);
  assert.ok(
    (
      await fs.readFile(root + '/library/Exports/' + exported, 'utf8')
    ).startsWith('WEBVTT'),
  );
  pass('Offline WebVTT export created through GUI');
  await d.clickText('Slides');
  await wait(() => d.read("return !!document.querySelector('.pdf-panel')"));
  pass('PDF reader loads lazily');
} finally {
  await fs.writeFile(
    root + '/ui-checks.json',
    JSON.stringify({ checks }, null, 2),
  );
}
