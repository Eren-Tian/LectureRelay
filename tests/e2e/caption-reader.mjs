// Requires the local Vite server and msedgedriver --port=4446.
// Deterministic UI fixtures, not an authenticated translation acceptance test.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const output = new URL('../../target/product-iteration/', import.meta.url);
const port = process.env.LECTURERELAY_COMPONENT_DRIVER_PORT || '4446';
const base = process.env.LECTURERELAY_COMPONENT_URL || 'http://127.0.0.1:5173';
await fs.mkdir(output, { recursive: true });
let session;
async function request(method, path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
  return value;
}
const command = (method, path, body) =>
  request(method, `/session/${session}${path}`, body);
const read = (script, args = []) =>
  command('POST', '/execute/sync', { script, args });
const pause = () => new Promise((r) => setTimeout(r, 160));
async function element(selector) {
  return (
    await command('POST', '/element', {
      using: 'css selector',
      value: selector,
    })
  )['element-6066-11e4-a52e-4f735466cecf'];
}
async function click(selector) {
  await command('POST', `/element/${await element(selector)}/click`, {});
  await pause();
}
const anchor = () =>
  read(
    "const a=document.querySelector('.caption-scroll'),top=a.getBoundingClientRect().top; const e=[...a.querySelectorAll('article')].find(e=>e.getBoundingClientRect().bottom>top+1); return {id:e.dataset.captionId,offset:e.getBoundingClientRect().top-top};",
  );
const bottom = () =>
  read(
    "const e=document.querySelector('.caption-scroll');return e.scrollHeight-e.scrollTop-e.clientHeight;",
  );
const results = [];
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
  await command('POST', '/url', {
    url: base + '/tests/fixtures/captions.html',
  });
  await new Promise((r) => setTimeout(r, 1200));
  assert.deepEqual(
    JSON.parse(
      await read("return document.querySelector('#ordering').textContent;"),
    ),
    { oldPoll: true, oldClass: true, newClass: true },
  );
  const control = async (id) => {
    await read('document.getElementById(arguments[0]).click();', [id]);
    await pause();
  };
  await click('#partial');
  await control('preview');
  assert.match(
    await read(
      "return document.querySelector('[data-translation-kind=draft]').textContent;",
    ),
    /临时译文/,
  );
  await control('wrong-language');
  assert.equal(
    await read("return !!document.querySelector('[data-translation-kind]');"),
    false,
  );
  await control('preview');
  await control('revise');
  assert.equal(
    await read("return !!document.querySelector('[data-translation-kind]');"),
    false,
    'Revised English invalidates the old provisional translation',
  );
  await click('#partial');
  await control('preview');
  await control('hide-english');
  assert.equal(
    await read("return !!document.querySelector('.caption-english');"),
    false,
  );
  assert.equal(
    await read(
      "return !!document.querySelector('[data-translation-kind=draft]');",
    ),
    true,
    'Translation-only mode must show draft translations',
  );
  // Reload to restore the ordinary bilingual reader for the existing scenarios.
  await command('POST', '/url', {
    url: base + '/tests/fixtures/captions.html',
  });
  await new Promise((r) => setTimeout(r, 1000));
  for (const lang of ['zh', 'ja', 'ko']) {
    await click(`select option[value="${lang}"]`);
    await click('#partial');
    await read(
      "window.fixtureCaption=document.querySelector('.caption-draft'); return !!window.fixtureCaption;",
    );
    assert.match(
      await read(
        "return document.querySelector('.caption-draft').textContent;",
      ),
      /Learning becomes/,
    );
    await click('#final');
    await control('preview-finals');
    assert.match(
      await read(
        "return document.querySelector('[data-translation-kind=final]').textContent;",
      ),
      /翻译中/,
    );
    assert.equal(
      await read(
        "return window.fixtureCaption===document.querySelector('article');",
      ),
      true,
      'Partial→final must preserve the article node',
    );
    await click('#translate');
    assert.equal(
      await read("return !!document.querySelector('[data-translation-kind]');"),
      false,
      'Saved final text must replace provisional output',
    );
    assert.equal(
      await read("return document.querySelector('.caption-translation').lang;"),
      lang,
    );
    const pair = await read(
      "const e=document.querySelector('.caption-english'),t=document.querySelector('.caption-translation');return {english:e.textContent,translation:t.textContent,below:t.getBoundingClientRect().top>=e.getBoundingClientRect().bottom};",
    );
    assert.ok(pair.below && pair.translation.length > 10);
    results.push({ language: lang, ...pair, sameNode: true });
    await fs.writeFile(
      new URL(`captions-${lang}.png`, output),
      Buffer.from(await command('GET', '/screenshot'), 'base64'),
    );
  }
  await click('#seed');
  assert.ok((await bottom()) <= 2, 'Newest captions should be visible');
  await command('POST', '/actions', {
    actions: [
      {
        type: 'wheel',
        id: 'reader',
        actions: [
          {
            type: 'scroll',
            origin: {
              'element-6066-11e4-a52e-4f735466cecf':
                await element('.caption-scroll'),
            },
            x: 0,
            y: 0,
            deltaX: 0,
            deltaY: -1400,
            duration: 200,
          },
        ],
      },
    ],
  });
  await pause();
  const before = await anchor();
  await control('preview-finals');
  const streaming = await anchor();
  assert.equal(streaming.id, before.id);
  assert.ok(
    Math.abs(streaming.offset - before.offset) < 2,
    'Streamed translations must retain the reading anchor',
  );
  await click('#translate');
  const after = await anchor();
  assert.equal(after.id, before.id);
  assert.ok(
    Math.abs(after.offset - before.offset) < 2,
    'Delayed translations must retain the reading anchor',
  );
  await click('#trim');
  const trimmed = await anchor();
  assert.equal(trimmed.id, before.id);
  assert.ok(
    Math.abs(trimmed.offset - before.offset) < 2,
    'Removing old history must retain the reading anchor',
  );
  await click('.jump-live');
  assert.ok((await bottom()) <= 2);
  await click('#failure');
  assert.match(
    await read(
      "return document.querySelector('.live-caption:last-child').textContent;",
    ),
    /课后可以重新翻译/,
  );
  results.push({
    manualAnchor: before,
    translatedAnchor: after,
    streamingAnchor: streaming,
    trimmedAnchor: trimmed,
    jumpToLive: true,
    failureState: true,
  });
  await command('POST', '/window/rect', { width: 880, height: 620 });
  await pause();
  const bounds = await read(
    "return {height:innerHeight,width:innerWidth,stop:document.querySelector('.classroom-controls').getBoundingClientRect().bottom,caption:document.querySelector('.caption-scroll').getBoundingClientRect().bottom};",
  );
  assert.ok(bounds.stop <= bounds.height && bounds.caption < bounds.stop);
  assert.ok((await bottom()) <= 2);
  results.push({ compactViewport: bounds });
  await click('#manual');
  await click('.jump-live');
  const manualBefore = await anchor();
  await click('#final');
  const manualAfter = await anchor();
  assert.equal(manualAfter.id, manualBefore.id);
  assert.ok(Math.abs(manualAfter.offset - manualBefore.offset) < 2);
  assert.ok(
    (await bottom()) > 50,
    'Auto-scroll off must leave new content below the current reading position',
  );
  results.push({ autoScrollDisabled: true, manualBefore, manualAfter });
  await fs.writeFile(
    new URL('captions-compact.png', output),
    Buffer.from(await command('GET', '/screenshot'), 'base64'),
  );
  await fs.writeFile(
    new URL('caption-reader-results.json', output),
    JSON.stringify({ fixture: true, paidRequests: 0, results }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  if (session) await command('DELETE', '');
}
