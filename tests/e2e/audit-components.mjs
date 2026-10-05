import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const port = process.env.LECTURERELAY_COMPONENT_DRIVER_PORT || '4446';
const base = process.env.LECTURERELAY_COMPONENT_URL || 'http://127.0.0.1:5173';
const output = new URL('../../target/engineering-audit/', import.meta.url);
await fs.mkdir(output, { recursive: true });
let session;
async function request(method, endpoint, body) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
  return value;
}
const command = (method, endpoint, body) =>
  request(method, `/session/${session}${endpoint}`, body);
const read = (script, args = []) =>
  command('POST', '/execute/sync', { script, args });
const delay = () => new Promise((r) => setTimeout(r, 100));
async function until(script) {
  for (let i = 0; i < 100; i++) {
    if (await read(script)) return;
    await delay();
  }
  throw new Error(`Fixture timeout: ${script}`);
}
async function click(text) {
  await read(
    "const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]); if(!b)throw Error('Button missing'); b.click();",
    [text],
  );
  await delay();
}
async function append(text) {
  const element = await command('POST', '/element', {
    using: 'css selector',
    value: 'textarea[aria-label="课堂笔记"]',
  });
  await command(
    'POST',
    `/element/${element['element-6066-11e4-a52e-4f735466cecf']}/value`,
    { text },
  );
}
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
            '--window-size=1180,780',
          ],
        },
      },
    },
  }));
  await command('POST', '/url', { url: base + '/tests/fixtures/audit.html' });
  await until(
    'return !!window.auditFixture && !!document.querySelector("#double-action");',
  );
  await click('Attempt two simultaneous actions');
  assert.equal(
    await read(
      'return window.auditFixture.calls.filter(x=>x==="action").length;',
    ),
    1,
  );
  await read('window.auditFixture.settle();');
  await until('return !document.querySelector("#double-action").disabled;');
  await click('编辑笔记');
  await append(' with revision');
  const draft = await read('return document.querySelector("textarea").value;');
  await click('保存笔记');
  assert.equal(
    await read('return document.querySelector("textarea").disabled;'),
    true,
  );
  assert.equal(
    await read(
      'return [...document.querySelectorAll("button")].find(b=>b.textContent.startsWith("+ 插入时间戳")).disabled;',
    ),
    true,
  );
  assert.equal(
    await read(
      'return window.auditFixture.calls.filter(x=>x==="saveNote").length;',
    ),
    1,
  );
  await read('window.auditFixture.settle();');
  await until('return !document.querySelector("textarea");');
  assert.equal(await read('return window.auditFixture.note;'), draft);
  assert.equal(
    await read(
      'return localStorage.getItem("lecturerelay-note-draft:audit-fixture");',
    ),
    null,
  );
  await click('编辑笔记');
  await append(' unsaved');
  const unsaved = await read(
    'return document.querySelector("textarea").value;',
  );
  await click('保存笔记');
  await read('window.auditFixture.settle(true);');
  await until('return !document.querySelector("textarea").disabled;');
  assert.equal(
    await read('return document.querySelector("textarea").value;'),
    unsaved,
  );
  assert.equal(
    await read(
      'return localStorage.getItem("lecturerelay-note-draft:audit-fixture");',
    ),
    unsaved,
  );
  await click('放弃草稿');
  await read('document.querySelector("[role=dialog] .button.danger").click();');
  await until('return document.querySelector("textarea").disabled;');
  await read('window.auditFixture.settle();');
  await until('return !document.querySelector("textarea");');
  assert.equal(await read('return window.auditFixture.note;'), draft);
  const report = {
    passed: true,
    scope:
      'Real React components in headless Edge; controlled persistence promises, no native runtime or model calls',
    duplicateActionSuppressed: true,
    editLockedDuringSave: true,
    failedSavePreservesDraft: true,
    discardPreservesSavedNote: true,
  };
  await fs.writeFile(
    new URL('components.json', output),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  if (session) await command('DELETE', '');
}
