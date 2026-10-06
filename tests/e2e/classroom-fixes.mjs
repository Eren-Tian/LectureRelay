// Real native WebView2 regression. Refuses any library outside this task's isolated root.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebDriver } from './webdriver.mjs';
const d = await WebDriver.current();
const root = path.resolve('target/classroom-fixes/ui-1');
const evidence =
  process.env.LECTURERELAY_CLASSROOM_EVIDENCE || 'target/classroom-fixes';
await fs.mkdir(evidence, { recursive: true });
const boot = await d.native('bootstrap');
assert.equal(
  path.resolve(boot.storage.database),
  path.join(root, 'app-data/app.db'),
);
assert.equal(boot.settings.provider, 'none');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, predicate = Boolean, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (predicate(v)) return v;
    await pause(200);
  }
  throw Error('Native UI condition timed out');
}
const stage = process.argv[2];
if (stage === 'setup') {
  await d.clickText('设置');
  if (
    await d.read(
      'return !![...document.querySelectorAll(".settings-nav button")].find(b=>b.textContent.trim()==="首次设置");',
    )
  )
    await d.clickText('首次设置');
  await d.clickText('启用本地双语字幕');
  await until(
    () => d.native('bootstrap'),
    (b) => b.settings.speechProvider === 'local' && b.settings.liveTranslation,
  );
  await d.clickText('通用');
  if (!(await d.native('bootstrap')).settings.quietMode)
    await d.click('input[aria-label="安静模式"]');
  await until(
    () => d.native('bootstrap'),
    (b) => b.settings.quietMode,
  );
  await d.click(
    'aside button[aria-label="[TEST] Biology — synthetic fixture"]',
  );
  await d.clickText('开始录音');
  await d.fill(
    '.modal input[maxlength="150"]',
    '[ACCEPTANCE] Classroom fixes microphone',
  );
  await d.read(
    "const e=document.querySelector('.modal select'); e.value='microphone'; e.dispatchEvent(new Event('change',{bubbles:true}));",
  );
  await d.clickText('开始录音');
  const recording = await until(() => d.native('recording_status'));
  assert.equal(recording.source, 'microphone');
  await fs.writeFile(
    `${evidence}/microphone-id.json`,
    JSON.stringify({ id: recording.lectureId, course: boot.courses[0].id }),
  );
  console.log(
    JSON.stringify({
      stage,
      id: recording.lectureId,
      source: recording.source,
      quiet: true,
    }),
  );
} else if (stage === 'captions') {
  const main = await d.command('GET', '/window');
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await d.clickText('独立字幕窗');
    const handles = await until(
      () => d.command('GET', '/window/handles'),
      (v) => v.length === 2,
    );
    await d.command('POST', '/window', {
      handle: handles.find((h) => h !== main),
    });
    await until(() =>
      d.read(
        "return !![...document.querySelectorAll('button')].find(b=>b.textContent==='关闭字幕窗');",
      ),
    );
    await d.clickText('关闭字幕窗');
    await until(
      () => d.command('GET', '/window/handles'),
      (v) => v.length === 1,
    );
    await d.command('POST', '/window', { handle: main });
    assert.equal(
      await d.read(
        "return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='结束并保存').disabled;",
      ),
      false,
    );
    assert.ok(
      Date.now() - start < 10000,
      'Opening and closing must not freeze the event loop',
    );
  }
  console.log(
    JSON.stringify({ stage, repeatedOpenClose: 3, stopRemainsEnabled: true }),
  );
} else if (stage === 'controls') {
  const before = await d.native('recording_status');
  await until(() =>
    d.read(
      "return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='暂停翻译');",
    ),
  );
  await d.clickText('暂停翻译');
  await until(
    () => d.native('live_status'),
    (l) => l.translationPaused,
  );
  await pause(1500);
  const after = await d.native('recording_status');
  assert.equal(after.lectureId, before.lectureId);
  assert.ok(after.durationSeconds > before.durationSeconds);
  await d.clickText('恢复翻译');
  await until(
    () => d.native('live_status'),
    (l) => !l.translationPaused,
  );
  const result = {
    stage,
    translationPauseResume: true,
    recordingContinues: true,
  };
  await fs.writeFile(`${evidence}/controls.json`, JSON.stringify(result));
  console.log(JSON.stringify(result));
} else if (stage === 'observe') {
  const samples = [];
  const started = Date.now();
  while (Date.now() - started < 300000) {
    const recording = await d.native('recording_status');
    assert.ok(recording, 'Recording ended unexpectedly');
    const live = await d.native('live_status');
    const dom = await d.read(
      "return {english:document.querySelectorAll('.caption-english').length,translated:document.querySelectorAll('.caption-translation').length,stopDisabled:[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='结束并保存')?.disabled};",
    );
    samples.push({
      elapsed: (Date.now() - started) / 1000,
      duration: recording.durationSeconds,
      level: recording.level,
      source: recording.source,
      backlog: live.backlogSeconds,
      translationQueue: live.translationQueue,
      deferred: live.translation.deferredIds.length,
      latestEnglishEnd: live.segments.at(-1)?.endSeconds ?? 0,
      latestTranslatedEnd:
        live.segments.filter((s) => s.translatedText).at(-1)?.endSeconds ?? 0,
      ...dom,
    });
    await fs.writeFile(
      `${evidence}/microphone-observation.json`,
      JSON.stringify(
        {
          scope:
            'Five-minute actual microphone, native WebView2, synthetic audio played externally; driver instrumentation',
          samples,
        },
        null,
        2,
      ),
    );
    await pause(2000);
  }
  console.log(
    JSON.stringify({
      samples: samples.length,
      maxBacklog: Math.max(...samples.map((s) => s.backlog)),
      final: samples.at(-1),
    }),
  );
} else if (stage === 'stop') {
  await d.clickText('结束并保存');
  await until(
    () => d.native('recording_status'),
    (r) => r === null,
  );
  await until(
    () => d.native('live_status'),
    (l) => !l.active,
    60000,
  );
  const ids = JSON.parse(
    await fs.readFile(`${evidence}/microphone-id.json`, 'utf8'),
  );
  const detail = await d.native('lecture_detail', { id: ids.id });
  await fs.writeFile(
    `${evidence}/microphone-result.json`,
    JSON.stringify(
      {
        lecture: detail.lecture,
        segments: detail.segments.length,
        translations: detail.segments.filter((s) => s.translatedText).length,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      stage,
      duration: detail.lecture.durationSeconds,
      english: detail.segments.length,
      translated: detail.segments.filter((s) => s.translatedText).length,
    }),
  );
} else if (stage === 'delete') {
  await d.click(
    'aside button[aria-label="[TEST] Biology — synthetic fixture"]',
  );
  const detail = await d.native('course_detail', { id: boot.courses[0].id });
  const selected = detail.lectures.find(
    (l) => l.title === '[TEST] Audio playback and bilingual timeline',
  );
  assert.ok(selected);
  await d.click(`button[aria-label="删除课堂记录：${selected.title}"]`);
  assert.equal(
    await d.read(
      "return document.querySelector('.modal .button.danger').disabled;",
    ),
    true,
  );
  await d.clickText('取消');
  assert.ok(
    (await d.native('course_detail', { id: detail.course.id })).lectures.some(
      (l) => l.id === selected.id,
    ),
  );
  await d.click(`button[aria-label="删除课堂记录：${selected.title}"]`);
  await d.fill('.modal input', '删除');
  await d.click('.modal .button.danger');
  const next = await until(
    () => d.native('course_detail', { id: detail.course.id }),
    (v) => v.lectures.length === detail.lectures.length - 1,
  );
  assert.ok(next.lectures.every((l) => l.id !== selected.id));
  assert.equal(next.glossary.length, detail.glossary.length);
  assert.equal(next.course.name, detail.course.name);
  console.log(
    JSON.stringify({
      stage,
      已取消Preserves: true,
      confirmationRequired: true,
      remaining: next.lectures.length,
      coursePreserved: true,
    }),
  );
} else throw Error('Choose setup, captions, controls, observe, stop or delete');
