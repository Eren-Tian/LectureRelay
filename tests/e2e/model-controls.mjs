// Browser component regression only; controlled native replies, no model/provider network.
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
async function until(script) {
  for (let i = 0; i < 40; i++) {
    if (await read(script)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error(`Fixture condition failed: ${script}`);
}
const click = (label) =>
  read(
    "const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]); if(!b)throw Error('Missing button: '+arguments[0]); b.click();",
    [label],
  );
const readyDownloads =
  "return [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='下载模型'&&!b.disabled).length";
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
  for (const mode of [
    'trash-failure',
    'model-retry',
    'connecting',
    'recording',
    'setup',
    'delete',
  ]) {
    try {
      await command('POST', '/url', {
        url: `${base}/tests/fixtures/models.html?mode=${mode}`,
      });
      await until(
        "return !!window.modelFixture && !!document.querySelector('button');",
      );
      if (mode === 'setup') {
        await until("return !!document.querySelector('.setup-guide');");
        await until(
          "return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='启用本地双语字幕'&&!b.disabled);",
        );
        await click('启用本地双语字幕');
        await until(
          "return window.modelFixture.saved?.speechProvider==='local';",
        );
        const saved = await read('return window.modelFixture.saved;');
        assert.equal(saved.translationMode, 'local');
        assert.equal(saved.translationModel, 'hy-mt2-1.8b');
        assert.equal(saved.liveTranslation, true);
        assert.equal(saved.provider, 'none');
        assert.equal(
          saved.studyMode,
          'none',
          'Optional study model is not required or switched on',
        );
        results.push({ mode, passed: true });
        continue;
      }
      if (mode === 'delete') {
        await click('删除课堂记录');
        await until("return !!document.querySelector('.modal');");
        assert.equal(
          await read(
            "return document.querySelector('.modal .button.danger').disabled;",
          ),
          true,
        );
        await click('取消');
        assert.deepEqual(await read('return window.modelFixture.calls;'), []);
        await until(
          "return !document.querySelector('.modal') && !document.querySelector('main button').disabled;",
        );
        await click('删除课堂记录');
        const input = await command('POST', '/element', {
          using: 'css selector',
          value: '.modal input',
        });
        const id = input['element-6066-11e4-a52e-4f735466cecf'];
        await command('POST', `/element/${id}/value`, {
          text: '删除',
          value: [...'删除'],
        });
        await until(
          "return !document.querySelector('.modal .button.danger').disabled;",
        );
        await read("document.querySelector('.modal .button.danger').click();");
        await until('return window.modelFixture.calls.length===1;');
        assert.deepEqual(await read('return window.modelFixture.calls;'), [
          'delete:fixture-lecture:DELETE',
        ]);
        results.push({ mode, passed: true });
        continue;
      }
      await click('本地 AI');
      if (mode === 'trash-failure') {
        await until(`${readyDownloads} === 3;`);
      } else if (mode === 'model-retry') {
        await until(`${readyDownloads} === 2;`);
        await click('重新加载');
        await until(`${readyDownloads} === 3;`);
      } else if (mode === 'connecting') {
        await until(`${readyDownloads} === 3;`);
        await click('下载模型');
        await until(
          "return document.body.innerText.includes('正在连接') && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='取消下载'&&!b.disabled);",
        );
        assert.equal(await read('return window.modelFixture.calls.length;'), 1);
        await click('取消下载');
        await until(`${readyDownloads} === 3;`);
        await until(
          "return [...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('已取消'));",
        );
        await click('下载模型');
        await read(
          "window.modelFixture.fail('Connection unavailable. Try again.');",
        );
        await until(`${readyDownloads} === 3;`);
        await until(
          "return [...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('连接暂时不可用'));",
        );
        await click('下载模型');
        await read('return window.modelFixture.complete();');
        await until(
          "return window.modelFixture.notifications.includes('暂时无法刷新模型状态。');",
        );
        await until(
          "return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='删除模型'&&!b.disabled);",
        );
      } else {
        await until(
          "return [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='下载模型').length===3;",
        );
        assert.equal(await read(`${readyDownloads};`), 0);
        await until(
          "return document.querySelector('.settings-detail').innerText.includes('请先结束并保存录音');",
        );
      }
      results.push({ mode, passed: true });
    } catch (error) {
      results.push({ mode, passed: false, error: error.message });
    }
  }
  await fs.mkdir('target/model-controls', { recursive: true });
  await fs.writeFile(
    'target/model-controls/components.json',
    JSON.stringify(
      {
        scope:
          'Real React Settings; controlled IPC; no native runtime/model requests',
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
  assert.ok(
    results.every((result) => result.passed),
    'Model controls regressions failed',
  );
} finally {
  if (session) await command('DELETE', '');
}
