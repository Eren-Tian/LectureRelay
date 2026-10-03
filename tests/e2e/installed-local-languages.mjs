// Translation-only smoke checks. Manually entered text is not speech-quality evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const root = 'target/acceptance-v0.3-2026-10-03';
const d = await WebDriver.current();
const original = (await d.native('bootstrap')).settings;
assert.equal(original.provider, 'none');
assert.equal(original.translationMode, 'local');
assert.equal(await d.native('recording_status'), null);
assert.equal(await d.native('job_status'), null);
assert.equal((await d.native('live_status')).active, false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(read, accept = Boolean, ms = 180000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await read();
    if (accept(v)) return v;
    await sleep(300);
  }
  throw Error('Language fixture timed out');
}
async function choose(label, value) {
  const option = await d.read(
    "return [...document.querySelectorAll('.settings-detail label')].find(e=>e.textContent.trim().startsWith(arguments[0]))?.querySelector('select option[value=\"'+arguments[1]+'\"]');",
    [label, value],
  );
  assert.ok(option, label);
  await d.command(
    'POST',
    `/element/${option['element-6066-11e4-a52e-4f735466cecf']}/click`,
    {},
  );
}
async function settings(speech, model) {
  await d.clickText('Settings');
  await d.clickText('AI Providers');
  await choose('Speech recognition', speech);
  await choose('Local translation model', model);
  if (
    await d.read(
      "return [...document.querySelectorAll('button')].some(e=>e.innerText.trim()==='Save changes'&&!e.disabled);",
    )
  )
    await d.clickText('Save changes');
  await wait(
    () => d.native('bootstrap'),
    (b) =>
      b.settings.speechProvider === speech &&
      b.settings.translationModel === model,
  );
}
async function enterSource(source) {
  // Work around the separately recorded product defect: the default end time
  // may have two decimals although the input requires step=0.1.
  const end = await d.read(
    'return document.querySelectorAll(".modal input[type=number]")[1]',
  );
  const id = end['element-6066-11e4-a52e-4f735466cecf'];
  await d.command('POST', `/element/${id}/clear`, {});
  await d.command('POST', `/element/${id}/value`, { text: '1', value: ['1'] });
  await d.fill('.modal textarea[rows="4"]', source);
  await d.clickText('Save Transcript');
}
const source =
  'A statistical association does not establish causation. The trial included 120 students, not 12. The error rate fell from 5 percent to 2 percent. A race condition occurs when concurrent operations depend on their timing. CRISPR-Cas9 can modify a targeted DNA sequence.';
const fixtures = [];
const checks = [];
try {
  await settings('none', 'hy-mt2-1.8b');
  for (const language of ['zh', 'ja', 'ko']) {
    const existing = (await d.native('bootstrap')).courses.find((c) =>
      c.name.startsWith(
        `[ACCEPTANCE 2026-10-03] Translation ${language.toUpperCase()} `,
      ),
    );
    const title = `[ACCEPTANCE] Manual translation fixture ${language.toUpperCase()}`;
    if (existing) {
      await d.clickText('Courses');
      await d.course(existing.name);
      await d.lecture(title);
      const detail = await d.read(
        "return document.querySelector('.replay-page') !== null",
      );
      assert.ok(detail);
      const course = await d.native('course_detail', { id: existing.id });
      const lecture = course.lectures.find((l) => l.title === title);
      assert.ok(lecture);
      const saved = await d.native('lecture_detail', { id: lecture.id });
      if (!saved.segments.length) {
        await wait(
          () => d.read("return document.querySelectorAll('.toast').length"),
          (n) => n === 0,
        );
        await d.clickText('+ Segment');
        await enterSource(source);
      }
      await wait(
        () => d.native('lecture_detail', { id: lecture.id }),
        (v) => v.segments.length === 1,
      );
      fixtures.push({
        language,
        courseName: existing.name,
        title,
        id: lecture.id,
      });
      continue;
    }
    const courseName = `[ACCEPTANCE 2026-10-03] Translation ${language.toUpperCase()} ${Date.now()}`;
    await d.clickText('Courses');
    await d.clickText('New Course');
    await d.fill('.modal input[maxlength="150"]', courseName);
    await d.click(`.modal select option[value="${language}"]`);
    await d.fill(
      '.modal textarea',
      'Synthetic fixed-text translation smoke check. Check negation, numbers and terminology. No accuracy certification.',
    );
    await d.clickText('Save Course');
    await wait(
      () => d.native('bootstrap'),
      (b) => b.courses.some((c) => c.name === courseName),
    );
    await d.clickText('Start Lecture');
    await d.click('.modal select option[value="system"]');
    await d.fill('.modal input', title);
    await d.clickText('Start Recording');
    const rec = await wait(() => d.native('recording_status'));
    await sleep(4200);
    await wait(
      () => d.read("return document.querySelectorAll('.toast').length"),
      (n) => n === 0,
    );
    await d.clickText('Stop & save');
    await wait(
      () => d.native('recording_status'),
      (v) => v === null,
    );
    await wait(
      () => d.native('live_status'),
      (v) => !v.active,
    );
    await wait(
      () => d.read("return document.querySelectorAll('.toast').length"),
      (n) => n === 0,
    );
    await d.clickText('+ Segment');
    await enterSource(source);
    await wait(
      () => d.native('lecture_detail', { id: rec.lectureId }),
      (v) => v.segments.length === 1,
    );
    fixtures.push({ language, courseName, title, id: rec.lectureId });
  }
  for (const model of ['hy-mt2-1.8b', 'qwen3.5-4b']) {
    await settings('none', model);
    for (const fixture of fixtures) {
      await d.clickText('Courses');
      await d.course(fixture.courseName);
      await d.lecture(fixture.title);
      if (model === 'qwen3.5-4b') {
        await d.click('.segment-edit');
        await d.fill('.modal textarea[rows="3"]', ' ');
        await d.clickText('Save Transcript');
        await wait(
          () => d.native('lecture_detail', { id: fixture.id }),
          (v) => !v.segments[0].translatedText,
        );
      }
      const started = Date.now();
      await d.clickText('Translate missing');
      await wait(
        () => d.native('job_status'),
        (v) => v !== null,
        10000,
      );
      await wait(
        () => d.native('job_status'),
        (v) => v === null,
        300000,
      );
      const detail = await d.native('lecture_detail', { id: fixture.id });
      assert.equal(detail.segments[0].sourceText, source);
      const translated = detail.segments[0].translatedText;
      assert.ok(translated.trim(), 'Model returned no stored translation');
      const script =
        fixture.language === 'ko'
          ? /[\uac00-\ud7af]/
          : fixture.language === 'ja'
            ? /[\u3040-\u30ff]/
            : /[\u4e00-\u9fff]/;
      assert.match(translated, script, 'Expected language script is absent');
      const check = {
        ...fixture,
        model,
        seconds: (Date.now() - started) / 1000,
        source,
        translated,
        contains120: /(?<!\d)120(?!\d)/.test(translated),
        contains12: /(?<!\d)12(?!\d)/.test(translated),
        functionalPassed: true,
      };
      checks.push(check);
      await fs.writeFile(
        `${root}/languages.json`,
        JSON.stringify(
          {
            scope:
              'Manually entered fixed-text functional smoke checks. Numbers and semantics require review; not classroom quality certification.',
            checks,
            fixtures,
          },
          null,
          2,
        ),
      );
      console.log(JSON.stringify(check));
      await d.screenshot(`v03-translation-${model}-${fixture.language}`);
    }
  }
} finally {
  if (
    (await d.native('recording_status')) === null &&
    (await d.native('job_status')) === null &&
    !(await d.native('live_status')).active
  )
    await settings(original.speechProvider, original.translationModel);
}
