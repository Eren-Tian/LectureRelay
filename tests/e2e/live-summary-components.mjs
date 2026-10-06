import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const port = process.env.LECTURERELAY_COMPONENT_DRIVER_PORT || '4446';
const base = process.env.LECTURERELAY_COMPONENT_URL || 'http://127.0.0.1:5173';
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
const read = (script, args = []) =>
  command('POST', '/execute/sync', { script, args });
const pause = () => new Promise((r) => setTimeout(r, 100));
async function until(script) {
  for (let i = 0; i < 100; i++) {
    if (await read(script)) return;
    await pause();
  }
  throw Error(`Timeout: ${script}`);
}
async function click(text) {
  await read(
    "const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]);if(!b)throw Error('Missing '+arguments[0]);b.click();",
    [text],
  );
  await pause();
}
const disabled = (text) =>
  read(
    "return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]).disabled;",
    [text],
  );
try {
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
  await command('POST', '/url', {
    url: base + '/tests/fixtures/live-summary.html',
  });
  await until(
    'return !!window.liveSummaryFixture && !!document.querySelector(".live-summary-panel");',
  );
  assert.equal(await disabled('启用实时总结'), true);
  assert.deepEqual(
    await read(
      'return [...document.querySelector(".live-summary-setup select").options].map(o=>o.value);',
    ),
    ['groq', 'openai', 'none'],
  );
  await click('获取 Groq API Key');
  assert.deepEqual(await read('return window.liveSummaryFixture.calls;'), [
    'open:groq:keys',
  ]);
  const element = await command('POST', '/element', {
    using: 'css selector',
    value: 'input[type=password]',
  });
  await command(
    'POST',
    `/element/${element['element-6066-11e4-a52e-4f735466cecf']}/value`,
    { text: 'fixture-only-not-a-real-key' },
  );
  await click('保存 Key');
  assert.equal(
    await read('return document.querySelector("input[type=password]").value;'),
    '',
  );
  assert.equal(await disabled('启用实时总结'), true);
  await click('测试总结连接');
  assert.equal(await disabled('启用实时总结'), true);
  await read(
    'document.querySelector(".live-summary-setup input[type=checkbox]").click();',
  );
  await pause();
  assert.equal(await disabled('启用实时总结'), false);
  await click('启用实时总结');
  assert.equal(
    await read(
      'return document.querySelector(".live-summary-setup select").value;',
    ),
    'groq',
  );
  assert.equal(
    await read(
      'return document.querySelectorAll(".live-summary-setup select")[1].value;',
    ),
    '4',
  );
  assert.equal(
    await read('return window.liveSummaryFixture.notes;'),
    '我自己的课堂笔记',
  );
  // Two same-turn clicks must dispatch one job before React rerenders.
  await read(
    "const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='立即总结');b.click();b.click();",
  );
  await until(
    'return window.liveSummaryFixture.calls.includes("generate:new");',
  );
  assert.equal(
    (await read('return window.liveSummaryFixture.calls;')).filter(
      (c) => c === 'generate:new',
    ).length,
    1,
  );
  await read('window.liveSummaryFixture.settle();');
  await until(
    'return document.querySelectorAll(".summary-points li").length===3;',
  );
  assert.equal(
    await read('return window.liveSummaryFixture.notes;'),
    '我自己的课堂笔记',
  );
  await read('document.querySelector(".summary-references button").click();');
  assert.equal(await read('return window.liveSummaryFixture.seek;'), 12.5);
  await click('加入我的笔记');
  assert.match(
    await read('return window.liveSummaryFixture.notes;'),
    /^我自己的课堂笔记[\s\S]*相关关系不能证明因果关系[\s\S]*#t=12.5/,
  );
  await read('window.liveSummaryFixture.stale();');
  await until('return !!document.querySelector(".summary-stale");');
  assert.equal(await disabled('加入我的笔记'), true);
  await click('关闭自动总结');
  await until(
    'return document.querySelector(".live-summary-heading").innerText.includes("尚未启用");',
  );
  assert.equal(
    await read('return document.querySelectorAll(".summary-card").length;'),
    1,
  );
  assert.deepEqual(
    await read(
      'return [window.liveSummaryFixture.calls.filter(c=>c==="test").length,document.querySelectorAll("input[type=password]").length];',
    ),
    [1, 1],
  );
  const previousCalls = await read(
    'return window.liveSummaryFixture.calls.length;',
  );
  await read('window.liveSummaryFixture.legacy();');
  await until(
    'return document.querySelector(".live-summary-setup select").value==="none";',
  );
  assert.equal(await disabled('启用实时总结'), true);
  assert.equal(
    await read(
      'return document.querySelectorAll("input[type=password]").length;',
    ),
    0,
  );
  assert.match(
    await read(
      'return document.querySelector(".live-summary-heading").innerText;',
    ),
    /尚未启用/,
  );
  assert.equal(
    await read('return document.querySelectorAll(".summary-card").length;'),
    1,
  );
  assert.equal(
    await read('return window.liveSummaryFixture.calls.length;'),
    previousCalls,
  );
  await click('保存设置，暂不启用');
  assert.deepEqual(
    await read('return window.liveSummaryFixture.preferences();'),
    {
      enabled: false,
      provider: 'none',
      model: 'openai/gpt-oss-120b',
      intervalMinutes: 2,
      uploadConsent: false,
    },
  );
  const out = new URL('../../target/live-summaries/', import.meta.url);
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(
    new URL('components.png', out),
    Buffer.from(await command('GET', '/screenshot'), 'base64'),
  );
  await fs.writeFile(
    new URL('components.json', out),
    JSON.stringify(
      {
        passed: true,
        scope:
          'Headless Edge real React components, isolated native API fixtures; no actual cloud credentials, audio or model inference',
        setupOptIn: true,
        duplicateSuppressed: true,
        sourceReplay: true,
        manualNotesPreserved: true,
        staleBlocked: true,
        disablePreservesCards: true,
        localOptionRemoved: true,
        legacyLocalDisabledWithoutRequests: true,
      },
      null,
      2,
    ),
  );
  console.log('Live-summary component acceptance passed');
} finally {
  if (session) await command('DELETE', '');
}
