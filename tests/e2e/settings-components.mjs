// Real Settings UI with controlled IPC: no audio, credentials or provider requests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.LECTURERELAY_WEBDRIVER_PORT =
  process.env.LECTURERELAY_COMPONENT_DRIVER_PORT;
const { WebDriver } = await import('./webdriver.mjs');
const d = new WebDriver();
({ sessionId: d.session } = await d.request('POST', '/session', {
  capabilities: {
    alwaysMatch: {
      browserName: 'MicrosoftEdge',
      'ms:edgeOptions': {
        args: [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--window-size=1180,900',
        ],
      },
    },
  },
}));
async function until(script) {
  for (let i = 0; i < 100; i++) {
    if (await d.read(script)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw Error(`Settings condition failed: ${script}`);
}
async function change(selector, value) {
  await d.read(
    'const e=document.querySelector(arguments[0]); e.value=arguments[1]; e.dispatchEvent(new Event("change",{bubbles:true}));',
    [selector, value],
  );
}
async function capture(name) {
  await fs.mkdir('target/settings-review', { recursive: true });
  await fs.writeFile(
    `target/settings-review/${name}.png`,
    Buffer.from(await d.command('GET', '/screenshot'), 'base64'),
  );
  const bounds = await d.read(
    'const element=document.querySelector("main.main-content"); return {width:element.clientWidth,content:element.scrollWidth};',
  );
  assert.ok(bounds.content <= bounds.width + 1, `${name}: horizontal overflow`);
}
try {
  await d.command('POST', '/url', {
    url:
      process.env.LECTURERELAY_COMPONENT_URL +
      '/tests/fixtures/localization.html',
  });
  await until('return !!document.querySelector(".course-card");');
  await d.clickText('设置');
  await until('return !!document.querySelector(".settings-nav");');
  assert.equal(
    await d.read(
      'return document.querySelectorAll(".settings-nav-group button").length;',
    ),
    6,
  );
  assert.equal(
    await d.read('return !!document.querySelector(".settings-savebar");'),
    false,
  );
  await capture('general-light');
  await change('.settings-detail select', 'ja');
  await d.clickText('深色');
  await until('return document.documentElement.dataset.theme==="dark";');
  assert.equal(
    await d.read(
      'return document.querySelector(".settings-detail select").value;',
    ),
    'ja',
  );
  assert.equal(
    await d.read(
      'return window.localizationFixture.data.settings.assistanceLanguage;',
    ),
    'zh',
  );
  await capture('general-dark');
  await d.read(
    'window.localizationFixture.data.settings.liveSummaries.intervalMinutes=5;',
  );
  await d.clickText('浅色');
  await until('return document.documentElement.dataset.theme==="light";');
  await d.clickText('保存修改');
  await until('return !document.querySelector(".settings-savebar");');
  assert.deepEqual(
    await d.read(
      'return [window.localizationFixture.data.settings.assistanceLanguage,window.localizationFixture.data.settings.liveSummaries.intervalMinutes];',
    ),
    ['ja', 5],
  );

  await d.clickText('声音与字幕');
  await until(
    'return !document.querySelector("select[aria-label=声音设备]").disabled;',
  );
  assert.deepEqual(
    await d.read('return window.localizationFixture.audioSources;'),
    ['microphone'],
  );
  await d.read('window.localizationFixture.failSystemDevices=true;');
  await change('select[aria-label=默认声音来源]', 'system');
  await until('return !!document.querySelector(".audio-warning");');
  await change('select[aria-label=默认声音来源]', 'microphone');
  await until(
    'return !document.querySelector("select[aria-label=声音设备]").disabled && !document.querySelector(".audio-warning");',
  );
  await d.read(
    'window.localizationFixture.failSystemDevices=false; window.localizationFixture.holdSystemDevices=true;',
  );
  await change('select[aria-label=默认声音来源]', 'system');
  await until(
    'return window.localizationFixture.audioSources.at(-1)==="system";',
  );
  await change('select[aria-label=默认声音来源]', 'microphone');
  await until(
    'return !document.querySelector("select[aria-label=声音设备]").disabled;',
  );
  await d.read(
    'window.localizationFixture.finishSystemDevices([{id:"stale-system",name:"Stale system output",isDefault:true}]);',
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    await d.read(
      'return !!document.querySelector("option[value=stale-system]");',
    ),
    false,
  );
  await d.read(
    'const b=[...document.querySelectorAll(".audio-input-test button")][0]; b.click(); b.click();',
  );
  await until('return window.localizationFixture.previewRequests===1;');
  assert.equal(
    await d.read(
      'return document.querySelector("select[aria-label=默认声音来源]").disabled;',
    ),
    true,
  );
  await d.read('window.localizationFixture.finishPreview(0.05);');
  await until(
    'return document.querySelector(".audio-input-test").textContent.includes("已检测到声音");',
  );
  assert.equal(
    await d.read('return window.localizationFixture.previewRequests;'),
    1,
  );

  await d.clickText('AI 与模型');
  await until('return !!document.querySelector(".settings-key-panel");');
  assert.equal(
    await d.read('return document.querySelector(".settings-key-panel").open;'),
    false,
  );
  await capture('ai-services');
  await d.clickText('实时总结');
  await until('return !!document.querySelector(".live-summary-setup");');
  assert.equal(
    await d.read(
      'return document.querySelector(".live-summary-setup select").value;',
    ),
    'groq',
  );
  await capture('ai-summaries');
  await d.command('POST', '/window/rect', { width: 850, height: 780 });
  await capture('settings-compact');
  await d.command('POST', '/window/rect', { width: 1180, height: 900 });
  await d.clickText('关于');
  assert.equal(
    await d.read('return !!document.querySelector(".settings-savebar");'),
    false,
  );

  await d.clickText('数据与存储');
  await until('return document.querySelector(".storage-usage");');
  await d.read('window.localizationFixture.failCleanup=true;');
  await d.clickText('清空课堂数据与模型…');
  await d.fill('.modal input', '清空全部数据');
  await d.click('.modal .danger');
  await until('return document.body.innerText.includes("无法完成存储清理。");');
  assert.match(
    await d.read('return document.body.innerText;'),
    /部分状态未能刷新/,
  );
  assert.equal(
    await d.read(
      'return window.localizationFixture.calls.filter(call=>call==="free_all_storage").length;',
    ),
    1,
  );
  const report = {
    passed: true,
    scope:
      'Full React settings; synthetic IPC, devices and cleanup failures; no native audio, keys or model calls',
    groupedNavigation: true,
    runtimeSavePreservesDraft: true,
    summaryPreferencesPreserved: true,
    independentDeviceEnumeration: true,
    staleDeviceReplyIgnored: true,
    duplicatePreviewSuppressed: true,
    primaryCleanupErrorPreserved: true,
  };
  await fs.mkdir('target/settings-review', { recursive: true });
  await fs.writeFile(
    'target/settings-review/components.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await d.command('DELETE', '');
}
