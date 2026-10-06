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
    'local-finish',
    'cloud-retry',
    'persist',
    'verify-restart',
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

if (action === 'verify-restart') {
  const workflow = JSON.parse(
    await fs.readFile('target/live-summaries/installed-workflow.json', 'utf8'),
  );
  assert.equal(workflow.id, id);
  const detail = await d.native('lecture_detail', { id });
  assert.ok(detail.note?.body?.startsWith('[ACCEPTANCE] 我的手写笔记：'));
  assert.equal(await d.native('recording_status'), null);
  await d.command('DELETE', '');
  const application = process.env.LECTURERELAY_LATENCY_EXE;
  assert.ok(application, 'Set the exact installed EXE');
  const reopened = await WebDriver.start(application);
  await until(
    () => reopened.native('bootstrap'),
    (b) => b.storage.version === '0.3.9',
  );
  const after = await reopened.native('live_summary_state', { id });
  const saved = await reopened.native('lecture_detail', { id });
  assert.deepEqual(
    after.cards.map((c) => [c.id, c.state]),
    before.cards.map((c) => [c.id, c.state]),
  );
  assert.equal(saved.note.body, detail.note.body);
  assert.deepEqual(
    saved.segments.map((s) => [s.id, s.sourceText]),
    detail.segments.map((s) => [s.id, s.sourceText]),
  );
  assert.equal(
    (await reopened.native('bootstrap')).settings.liveSummaries.enabled,
    false,
  );
  await fs.writeFile(
    'target/live-summaries/installed-workflow.json',
    JSON.stringify({ ...workflow, restartPassed: true }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      action,
      cards: after.cards.length,
      notePreserved: true,
    }),
  );
  process.exit(0);
}

if (action === 'cloud-retry') {
  assert.equal(before.cards.length, 2);
  assert.equal(before.cards[1].sources.length, 4);
  const source = before.cards[1].sources[0];
  const time = `${String(Math.floor(source.startSeconds / 60)).padStart(2, '0')}:${String(Math.floor(source.startSeconds % 60)).padStart(2, '0')}`;
  for (const text of [
    source.text + ' [ACCEPTANCE temporary source edit]',
    source.text,
  ]) {
    await d.click(`button[aria-label="编辑字幕，时间：${time}"]`);
    await d.fill('.modal textarea[required]', text);
    await d.click('.modal form button.primary');
    await until(
      () => d.native('lecture_detail', { id }),
      (detail) =>
        detail.segments.find((s) => s.id === source.id)?.sourceText === text,
    );
    await until(
      () => d.read("return !document.querySelector('.modal');"),
      Boolean,
    );
  }
  await d.clickText('设置总结');
  await d.read(
    "const e=document.querySelector('.live-summary-setup select');e.value='groq';e.dispatchEvent(new Event('change',{bubbles:true}));",
  );
  await d.click('.live-summary-setup input[type=checkbox]');
  await d.clickText('保存设置，暂不启用');
  await d.clickText('启用实时总结');
  await d.click('.modal-heading button[aria-label="关闭"]');
  await until(
    () => d.native('live_summary_state', { id }),
    (s) => s.cards[1].state === 'stale',
  );
  const started = Date.now();
  await d.click('.summary-card:nth-of-type(2) .button.secondary');
  await until(
    () => d.native('live_summary_state', { id }),
    (s) =>
      s.cards[1].sources[0].revision !== before.cards[1].sources[0].revision,
  );
  const after = await until(
    () => d.native('live_summary_state', { id }),
    (s) => s.cards[1].state !== 'running' && !s.busy,
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
  assert.equal(after.cards[1].provider, 'groq');
  assert.equal(after.cards[1].sources[0].text, source.text);
  console.log(
    JSON.stringify({
      passed: true,
      action,
      elapsedMs,
      cards: after.cards.length,
      remaining: after.remaining,
    }),
  );
  process.exit(0);
}

if (
  action.startsWith('configure-') ||
  ['local-tail', 'local-finish'].includes(action)
) {
  await d.clickText('设置总结');
  if (action !== 'configure-off') {
    await d.read(
      "const e=document.querySelector('.live-summary-setup select');e.value=arguments[0];e.dispatchEvent(new Event('change',{bubbles:true}));",
      [action === 'configure-groq-off' ? 'groq' : 'local'],
    );
  }
  if (process.env.LECTURERELAY_LIVE_SUMMARY_INTERVAL) {
    const interval = Number(process.env.LECTURERELAY_LIVE_SUMMARY_INTERVAL);
    assert.ok([2, 4, 5].includes(interval));
    await d.read(
      "const e=document.querySelectorAll('.live-summary-setup select')[1];e.value=arguments[0];e.dispatchEvent(new Event('change',{bubbles:true}));",
      [String(interval)],
    );
  }
  await d.click(
    `.live-summary-setup > .button-row:last-of-type button.${['configure-local', 'local-tail', 'local-finish'].includes(action) ? 'primary' : 'secondary'}`,
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

if (action === 'local-finish') {
  assert.equal(before.cards.length, 1);
  assert.equal(before.cards[0].provider, 'local');
  assert.ok(['deferred', 'completed'].includes(before.cards[0].state));
  assert.equal(
    (await d.native('bootstrap')).settings.liveSummaries.provider,
    'local',
  );
  const runs = [];
  for (let index = 0; index < 2; index++) {
    const previous = await d.native('live_summary_state', { id });
    if (index === 0 && previous.cards[0].state === 'completed') {
      runs.push({ elapsedMs: null, state: previous, existing: true });
      continue;
    }
    const started = Date.now();
    if (index === 0) {
      await d.click('.live-summary-panel .summary-card .button.secondary');
    } else {
      assert.ok(previous.remaining > 0);
      await d.clickText('整理剩余片段');
    }
    await until(
      () => d.native('live_summary_state', { id }),
      (s) => s.cards[index]?.state === 'running',
    );
    const state = await until(
      () => d.native('live_summary_state', { id }),
      (s) => s.cards[index]?.state !== 'running' && !s.busy,
      100000,
    );
    runs.push({ elapsedMs: Date.now() - started, state });
    await fs.writeFile(
      'target/live-summaries/local-postclass.json',
      JSON.stringify({ id, before, runs }, null, 2),
    );
    assert.equal(
      state.cards[index].state,
      'completed',
      state.cards[index].message,
    );
    console.log(
      JSON.stringify({
        action,
        cycle: index + 1,
        elapsedMs: runs[index].elapsedMs,
        state: state.cards[index].state,
      }),
    );
  }
  await d.clickText('关闭自动总结');
  console.log(
    JSON.stringify({
      passed: true,
      action,
      cycles: runs.length,
      generatedInThisAction: runs.filter((r) => !r.existing).length,
    }),
  );
  process.exit(0);
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
  assert.ok(before.cards.length > 0);
  assert.equal(before.cards[0].state, 'completed');
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
  await until(
    () =>
      d.read(
        "return [...document.querySelectorAll('.summary-stale button')].find(b=>b.innerText.trim()==='加入我的笔记')?.disabled;",
      ),
    (disabled) => disabled === true,
  );
  // Restore the test transcript content. Its revision still correctly requires
  // explicit regeneration; do not spend a cloud request to refresh this fixture.
  await d.click('button[aria-label="编辑字幕，时间：00:20"]');
  await d.fill('.modal textarea[required]', edited.sourceText);
  await d.click('.modal form button.primary');
  await until(
    () => d.native('lecture_detail', { id }),
    (s) => s.segments[0].sourceText === edited.sourceText,
  );
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
      cardsSaved: true,
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
