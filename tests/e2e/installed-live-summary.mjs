// Explicit acceptance only. Uses actual installed UI; never reads an API key.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';

const [action, course, title] = process.argv.slice(2);
assert.ok(course?.startsWith('[ACCEPTANCE '));
assert.ok(title?.startsWith('[ACCEPTANCE]'));
assert.ok(
  [
    'tail',
    'local-tail',
    'persist',
    'inspect',
    'configure-off',
    'configure-local',
    'configure-groq-off',
  ].includes(action),
);
const d = await WebDriver.current();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(read, check, timeout = 30000) {
  const end = Date.now() + timeout;
  do {
    const result = await read();
    if (check(result)) return result;
    await pause(250);
  } while (Date.now() < end);
  throw Error('Installed summary acceptance timed out');
}
await until(
  () => d.native('bootstrap'),
  (b) => b.storage.version === '0.3.9',
);
assert.equal(await d.native('recording_status'), null);
await d.click(`aside button[aria-label="${course}"]`);
await d.lecture(title);
await until(
  () => d.read("return !!document.querySelector('.live-summary-panel');"),
  Boolean,
);
if (
  !(await d.read(
    "return !!document.querySelector('.live-summary-panel')?.getClientRects().length;",
  ))
)
  await d.clickText(
    (await d.read(
      "return document.querySelector('.study-workspace')?.classList.contains('narrow');",
    ))
      ? '学习工具'
      : '显示学习工具',
  );
const boot = await d.native('bootstrap');
const found = await d.native('library_search', { query: title });
const lecture = found.find((entry) => entry.lecture.title === title)?.lecture;
assert.ok(lecture, 'Exact labelled lecture required');
const id = lecture.id;
const before = await d.native('live_summary_state', { id });
await fs.mkdir('target/live-summaries', { recursive: true });

if (action.startsWith('configure-') || action === 'local-tail') {
  await d.clickText('设置总结');
  if (action !== 'configure-off') {
    await d.read(
      "const e=document.querySelector('.live-summary-setup select');e.value=arguments[0];e.dispatchEvent(new Event('change',{bubbles:true}));",
      [action === 'configure-groq-off' ? 'groq' : 'local'],
    );
  }
  await d.clickText(
    ['configure-local', 'local-tail'].includes(action)
      ? '启用实时总结'
      : '保存设置，暂不启用',
  );
  await d.click('.modal-heading button[aria-label="关闭"]');
  if (action.startsWith('configure-')) {
    console.log(
      JSON.stringify({
        action,
        preferences: (await d.native('bootstrap')).settings.liveSummaries,
      }),
    );
    process.exit(0);
  }
}

if (action === 'local-tail') {
  assert.equal(before.cards.length, 2);
  assert.ok(['failed', 'deferred'].includes(before.cards[1].state));
  const started = Date.now();
  await d.clickText('重试这一段');
  const after = await until(
    () => d.native('live_summary_state', { id }),
    (s) => s.cards[1].state !== 'running' && !s.busy,
    100000,
  );
  await fs.writeFile(
    'target/live-summaries/local-tail.json',
    JSON.stringify(
      { id, elapsedMs: Date.now() - started, before, after },
      null,
      2,
    ),
  );
  await d.clickText('关闭自动总结');
  assert.equal(after.cards[1].state, 'completed', after.cards[1].message);
  console.log(
    JSON.stringify({
      passed: true,
      action,
      elapsedMs: Date.now() - started,
    }),
  );
  process.exit(0);
}

if (action === 'tail') {
  // Recovering a previous acceptance may not silently consume more requests.
  assert.equal(before.cards.length, 1);
  assert.equal(before.cards[0].provider, 'groq');
  assert.equal(before.cards[0].state, 'completed');
  assert.ok(before.remaining > 0);
  const setup = await d.native('live_summary_setup');
  assert.equal(setup.connectionTested, true);
  assert.equal(setup.preferences.provider, 'groq');
  assert.equal(setup.preferences.model, 'openai/gpt-oss-120b');
  assert.equal(setup.preferences.uploadConsent, true);
  await d.clickText('设置总结');
  await d.clickText('启用实时总结');
  await d.click('.modal-heading button[aria-label="关闭"]');
  const started = Date.now();
  await d.clickText('整理剩余片段');
  const after = await until(
    () => d.native('live_summary_state', { id }),
    (state) =>
      state.cards.length === 2 &&
      state.cards.every((card) => card.state !== 'running'),
    100000,
  );
  const elapsedMs = Date.now() - started;
  await d.clickText('关闭自动总结');
  await fs.writeFile(
    'target/live-summaries/second-real-window.json',
    JSON.stringify(
      {
        id,
        elapsedMs,
        before,
        after,
        detail: await d.native('lecture_detail', { id }),
      },
      null,
      2,
    ),
  );
  assert.equal(after.cards[1].state, 'completed', after.cards[1].message);
  assert.equal(after.remaining, 0);
  for (const card of after.cards) {
    assert.ok(card.points.length >= 3 && card.points.length <= 5);
    for (const point of card.points)
      assert.ok(
        point.sourceIds.every((ref) =>
          card.sources.some((source) => source.id === ref),
        ),
      );
  }
  assert.equal(
    (await d.native('bootstrap')).settings.speechProvider,
    boot.settings.speechProvider,
  );
  assert.equal(
    (await d.native('bootstrap')).settings.translationMode,
    boot.settings.translationMode,
  );
  console.log(
    JSON.stringify({
      passed: true,
      action,
      id,
      elapsedMs,
      cards: after.cards.length,
      remaining: after.remaining,
    }),
  );
} else if (action === 'persist') {
  assert.equal(before.cards.length, 2);
  assert.ok(before.cards.every((card) => card.state === 'completed'));
  const detail = await d.native('lecture_detail', { id });
  const study = await d.native('study_state', { id });
  assert.ok(
    !detail.note?.body && !study.draft,
    'Do not overwrite an existing note',
  );
  await d.clickText('我的笔记');
  await d.clickText('编辑笔记');
  const marker = '[ACCEPTANCE] 我的手写笔记：保留讲师的假设与问题。';
  await d.fill('.study-note-editor', marker);
  await until(
    () => d.native('study_state', { id }),
    (s) => s.draft === marker,
  );
  await d.clickText('课堂要点');
  await d.clickText('加入我的笔记');
  await until(
    () => d.read("return document.querySelector('.study-note-editor')?.value;"),
    (body) => body?.startsWith(marker) && body.includes(before.cards[0].title),
  );
  await d.clickText('保存笔记');
  const saved = await until(
    () => d.native('lecture_detail', { id }),
    (s) =>
      s.note?.body?.startsWith(marker) &&
      s.note.body.includes(before.cards[0].title),
  );
  await d.clickText('课堂要点');
  await d.click('.summary-references button');
  const source = before.cards[0].sources.find(
    (s) => s.id === before.cards[0].points[0].sourceIds[0],
  );
  const replay = await until(
    () =>
      d.read(
        "const a=document.querySelector('audio');return {time:a.currentTime,playing:!a.paused,error:a.error?.code??null};",
      ),
    (a) =>
      a.playing &&
      a.time >= source.startSeconds &&
      a.time < source.startSeconds + 5 &&
      a.error === null,
  );
  await d.read("document.querySelector('audio').pause();");
  const edited = detail.segments[0];
  await d.click('button[aria-label="编辑字幕，时间：00:20"]');
  await d.fill(
    '.modal textarea[required]',
    edited.sourceText + ' [ACCEPTANCE source correction]',
  );
  await d.click('.modal form button.primary');
  const stale = await until(
    () => d.native('live_summary_state', { id }),
    (s) => s.cards[0].state === 'stale',
  );
  assert.equal(
    await d.read(
      "return document.querySelector('.summary-stale button:last-child')?.disabled;",
    ),
    true,
  );
  // Restore the test transcript content. Its revision still correctly requires
  // explicit regeneration; do not spend a cloud request to refresh this fixture.
  await d.click('button[aria-label="编辑字幕，时间：00:20"]');
  await d.fill('.modal textarea[required]', edited.sourceText);
  await d.click('.modal form button.primary');
  await fs.writeFile(
    'target/live-summaries/installed-workflow.json',
    JSON.stringify(
      {
        id,
        cards: before.cards,
        staleSourceEditDetected: stale.cards[0].state === 'stale',
        manualNote: saved.note,
        replay,
        enabled: (await d.native('bootstrap')).settings.liveSummaries.enabled,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      action,
      id,
      manualNotePreserved: true,
      replay: true,
      cardsPersistedAfterRestart: true,
    }),
  );
} else {
  console.log(
    JSON.stringify({
      id,
      cards: before.cards.map((c) => ({
        id: c.id,
        state: c.state,
        provider: c.provider,
        points: c.points.length,
      })),
      remaining: before.remaining,
      recording: await d.native('recording_status'),
    }),
  );
}
