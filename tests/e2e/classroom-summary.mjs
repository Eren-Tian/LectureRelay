import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const port = process.env.LECTURERELAY_COMPONENT_DRIVER_PORT || '4446';
let session;
async function request(method, endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw Error(JSON.stringify(value));
  return value;
}
const command = (method, endpoint, body) =>
  request(method, `/session/${session}${endpoint}`, body);
const d = {
  read: (script, args = []) =>
    command('POST', '/execute/sync', { script, args }),
  screenshot: () => command('GET', '/screenshot'),
  close: async () => {
    if (session) await command('DELETE', '');
  },
  startBrowser: async (url) => {
    ({ sessionId: session } = await request('POST', '/session', {
      capabilities: {
        alwaysMatch: {
          browserName: 'MicrosoftEdge',
          'ms:edgeOptions': {
            args: [
              '--headless=new',
              '--disable-gpu',
              '--no-first-run',
              '--window-size=920,1100',
            ],
          },
        },
      },
    }));
    await command('POST', '/url', { url });
  },
};
const base = process.env.LECTURERELAY_COMPONENT_URL || 'http://127.0.0.1:5173';
const output = new URL('../../target/classroom-summary/', import.meta.url);
const pause = () => new Promise((r) => setTimeout(r, 100));
async function until(script) {
  for (let n = 0; n < 100; n++) {
    if (await d.read(script)) return;
    await pause();
  }
  throw Error(`Timeout: ${script}`);
}
async function click(text) {
  await d.read(
    "const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]); if(!b)throw Error('Missing '+arguments[0]); b.click();",
    [text],
  );
  await pause();
}
await fs.mkdir(output, { recursive: true });
try {
  await d.startBrowser(base + '/tests/fixtures/summary.html');
  await until('return !!document.querySelector(".summary-archive");');
  await d.read('document.querySelector(".summary-archive").open = true;');
  await until('return !!document.querySelector(".summary-card");');
  assert.equal(
    await d.read(
      'return document.querySelector(".study-tabs [aria-selected=true]").textContent;',
    ),
    '课堂要点',
  );
  assert.equal(
    await d.read('return document.querySelectorAll(".summary-card").length;'),
    8,
  );
  await click('下一页');
  await click('下一页');
  assert.match(
    await d.read('return document.querySelector(".summary-card").innerText;'),
    /第 17 段/,
  );
  await d.read('document.querySelector(".summary-time").click();');
  assert.equal(await d.read('return window.summaryFixture.seek;'), 1920.125);
  await click('生成课堂要点');
  // The independent action guard prevents rapid duplicate model runs.
  await d.read('document.querySelector(".summary-heading button").click();');
  assert.equal((await d.read('return window.summaryFixture.calls;')).length, 1);
  await d.read('window.summaryFixture.settle();');
  await until(
    'return document.querySelector(".summary-card").innerText.includes("Saved key point 1");',
  );
  await click('继续整理');
  await until(
    'return [...document.querySelectorAll(".summary-card")].some(c=>c.innerText.includes("Saved key point 3"));',
  );
  await d.read(
    'document.querySelector(".summary-card:last-of-type > .text-button:last-child").click();',
  );
  await until(
    'return !!document.querySelector("textarea[aria-label=课堂笔记]");',
  );
  const draft = await d.read(
    'return document.querySelector("textarea").value;',
  );
  assert.match(draft, /^Original manual note/);
  assert.match(draft, /Saved key point 3/);
  await until(
    'return window.summaryFixture.draft.includes("Saved key point 3");',
  );
  // The format toolbar wraps or prefixes the selection with Markdown.
  const editor = 'document.querySelector("textarea[aria-label=课堂笔记]")';
  await d.read(`${editor}.focus(); ${editor}.setSelectionRange(0, 8);`);
  await d.read(
    `document.querySelector('[aria-label="加粗（Ctrl+B）"]').click();`,
  );
  await until(`return ${editor}.value.startsWith("**Original** manual");`);
  // The selection is restored on the next frame.
  await until(
    `return ${editor}.selectionStart === 2 && ${editor}.selectionEnd === 10;`,
  );
  await d.read(`${editor}.setSelectionRange(0, 0);`);
  await d.read(`document.querySelector('[aria-label="标题"]').click();`);
  await until(`return ${editor}.value.startsWith("## **Original** manual");`);
  await until(
    'return window.summaryFixture.draft.startsWith("## **Original** manual");',
  );
  // Task lists and tables (GFM) render in the draft preview.
  await d.read(
    `${editor}.setSelectionRange(${editor}.value.length, ${editor}.value.length);`,
  );
  await d.read(`document.querySelector('[aria-label="表格"]').click();`);
  await until(`return ${editor}.value.includes("| 概念 | 说明 |");`);
  // Wait for the toolbar to place the cursor after the table (next frame).
  await until(
    `return ${editor}.selectionStart === ${editor}.value.length && document.activeElement === ${editor};`,
  );
  await d.read(`${editor}.setSelectionRange(0, 0);`);
  await d.read(`document.querySelector('[aria-label="待办列表"]').click();`);
  await until(`return ${editor}.value.startsWith("- [ ] ## ");`);
  await click('预览草稿');
  await until(
    'return !!document.querySelector(".study-notes .markdown table th") && !!document.querySelector(".study-notes .task-list-item input[type=checkbox]");',
  );
  assert.match(
    await d.read(
      'return document.querySelector(".study-notes .notice").textContent;',
    ),
    /尚未保存/,
  );
  // The same draft as a mind map: headings and lists become nodes.
  await click('导图');
  await until('return !!document.querySelector(".mindmap .mindmap-node");');
  assert.ok(
    await d.read(
      'return [...document.querySelectorAll(".mindmap-node")].some(n=>/段/.test(n.textContent));',
    ),
  );
  await fs.writeFile(
    new URL('component-mindmap.png', output),
    Buffer.from(await d.screenshot(), 'base64'),
  );
  // Self-test: each heading with text is a card; its text stays hidden
  // until asked for, and a missed card can be practised again.
  await click('自测');
  await until('return !!document.querySelector(".self-test-card h3");');
  assert.match(
    await d.read(
      'return document.querySelector(".self-test-card h3").textContent;',
    ),
    /段/,
  );
  assert.equal(
    await d.read('return !!document.querySelector(".self-test-answer");'),
    false,
  );
  await click('显示内容');
  await until(
    'return /Saved key point/.test(document.querySelector(".self-test-answer")?.textContent || "");',
  );
  await fs.writeFile(
    new URL('component-self-test.png', output),
    Buffer.from(await d.screenshot(), 'base64'),
  );
  await click('再看看');
  for (let n = 0; n < 20; n++) {
    if (await d.read('return !!document.querySelector(".self-test-done");'))
      break;
    await click('显示内容');
    await click('记住了');
  }
  assert.match(
    await d.read(
      'return document.querySelector(".self-test-done").textContent;',
    ),
    /再看看 1 张/,
  );
  await click('重练没记住的 1 张');
  await until(
    'return /第 1 \\/ 1 张/.test(document.querySelector(".self-test-progress")?.textContent || "");',
  );
  await click('文档');
  await click('课堂要点');
  await d.read('window.summaryFixture.stale();');
  await until(
    'return document.querySelector(".classroom-summary").innerText.includes("上次保存的要点");',
  );
  assert.match(
    await d.read(
      'return document.querySelector(".summary-heading").innerText;',
    ),
    /生成课堂要点/,
  );
  await d.read('window.summaryFixture.live(true);');
  await until(
    'return !document.querySelector(".summary-archive") && !!document.querySelector(".live-summary-panel");',
  );
  assert.equal(
    await d.read('return !!document.querySelector(".summary-heading button");'),
    false,
  );
  assert.equal(
    await d.read(
      'return !!document.querySelector(".live-summary-panel .summary-empty button") && !document.querySelector(".summary-live-status");',
    ),
    true,
  );
  await d.read('document.documentElement.dataset.theme="dark";');
  await fs.writeFile(
    new URL('component-dark.png', output),
    Buffer.from(await d.screenshot(), 'base64'),
  );
  const report = {
    passed: true,
    scope:
      'Headless Edge, real React components, controlled text/state fixtures; no native WebView/audio/model claims',
    defaultSummary: true,
    fullSourcePagination: true,
    timestampReplay: true,
    duplicateGenerationSuppressed: true,
    resumeVisibleSections: true,
    appendPreservesManualDraft: true,
    staleSummaryLabel: true,
    noLiveModelScheduling: true,
  };
  await fs.writeFile(
    new URL('components.json', output),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await d.close();
}
