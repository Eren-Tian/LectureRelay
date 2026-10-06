// Chinese UI acceptance in the full React app; isolated synthetic native replies.
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
const output = 'target/localization/components';
await fs.mkdir(output, { recursive: true });
const screens = [];
async function until(script) {
  for (let n = 0; n < 80; n++) {
    if (await d.read(script)) return;
    await new Promise((r) => setTimeout(r, 75));
  }
  throw Error(`Chinese fixture timeout: ${script}`);
}
const text = () => d.read('return document.body.innerText;');
async function click(label) {
  await until(
    `return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled);`,
  );
  await d.clickText(label);
}
async function screenshot(name) {
  await new Promise((r) => setTimeout(r, 150));
  await fs.writeFile(
    `${output}/${name}.png`,
    Buffer.from(await d.command('GET', '/screenshot'), 'base64'),
  );
  const bounds = await d.read(
    'const m=document.querySelector("main.main-content"); return {width:m.clientWidth,content:m.scrollWidth};',
  );
  assert.ok(bounds.content <= bounds.width + 1, `${name}: horizontal overflow`);
  screens.push({ name, bounds });
}
try {
  await d.command('POST', '/url', {
    url:
      process.env.LECTURERELAY_COMPONENT_URL +
      '/tests/fixtures/localization.html',
  });
  await until('return !!document.querySelector(".course-card");');
  assert.equal(await d.read('return document.documentElement.lang;'), 'zh-CN');
  assert.match(await text(), /计算机科学/);
  assert.match(await text(), /Introduction to Biology/);
  await click('新建课程');
  await until('return !!document.querySelector(".modal select");');
  assert.equal(
    await d.read(
      'return document.querySelector(".modal select option").textContent;',
    ),
    '中文',
  );
  assert.equal(
    await d.read(
      'return [...document.querySelectorAll(".modal select")].at(-1).value;',
    ),
    'Computer Science',
  );
  await click('取消');
  await click('设置');
  await click('首次设置');
  await until('return !!document.querySelector(".setup-guide");');
  await screenshot('setup');
  for (const category of [
    '通用',
    '声音与字幕',
    'AI 与模型',
    '数据与存储',
    '安全与隐私',
    '关于',
  ]) {
    await click(category);
    await until(
      `return document.querySelector('.settings-section-heading')?.textContent===${JSON.stringify(category)};`,
    );
    const body = await text();
    assert.doesNotMatch(
      body,
      /Getting started|Quiet Mode|Download Model|Jump to Live|Security & Privacy|Interface language/,
    );
    if (category === 'AI 与模型') {
      await click('本地模型');
      const models = await text();
      assert.match(models, /Nemotron Streaming EN 0.6B/);
      assert.match(models, /Hy-MT2-1.8B/);
      assert.match(models, /Qwen3.5-4B/);
      assert.match(models, /模型下载已取消/);
    }
    if (category === '声音与字幕') {
      await click('字幕样式');
      assert.match(await text(), /字幕预览/);
    }
    if (category === '关于') assert.match(body, /简体中文/);
    await screenshot(`settings-${category}`);
  }
  await click('数据与存储');
  await click('清空课堂数据与模型…');
  await until('return !!document.querySelector(".modal input");');
  assert.match(await text(), /输入 清空全部数据 以确认/);
  assert.equal(
    await d.read('return document.querySelector(".modal .danger").disabled;'),
    true,
  );
  await click('取消');
  await click('永久删除');
  await until('return !!document.querySelector(".modal input");');
  assert.match(await text(), /输入 删除 以确认/);
  assert.match(await text(), /无法恢复/);
  await click('取消');
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await until('return !!document.querySelector(".lecture-row");');
  await d.click('.lecture-row');
  await until('return !!document.querySelector(".replay-player");');
  assert.match(await text(), /录音设备报告声音中断/);
  assert.match(await text(), /Mitochondria produce ATP/);
  await screenshot('replay');
  if (
    await d.read('return !!document.querySelector(".study-workspace.narrow");')
  )
    await click('学习工具');
  await click('处理进度');
  await until('return !!document.querySelector(".task-state");');
  assert.match(await text(), /翻译文本 · 中文/);
  assert.match(await text(), /失败/);
  assert.match(await text(), /额度或请求频率限制/);
  await screenshot('processing');
  await click('时间索引');
  assert.match(await text(), /章节/);
  assert.match(await text(), /ATP production/);
  await click('我的笔记');
  await d.read('document.querySelector(".study-tools details").open=true;');
  assert.match(await text(), /整堂复习/);
  assert.match(await text(), /Original manual notes/);
  await click('删除课堂记录');
  await until('return !!document.querySelector(".modal input");');
  assert.match(await text(), /将永久删除“Cellular respiration”/);
  await screenshot('delete-confirmation');
  await click('取消');
  assert.ok(
    !(await d.read('return window.localizationFixture.calls;')).some((c) =>
      /delete|free_all/.test(c),
    ),
  );
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await click('开始录音');
  await until(
    'return !!document.querySelector(".modal select option[value=fixture-device]");',
  );
  await d.read('document.querySelector(".modal form").requestSubmit();');
  await until('return !!document.querySelector(".classroom-controls");');
  assert.match(await text(), /丢失 2 个音频缓冲区（640 个采样点）/);
  assert.match(await text(), /Mitochondria produce ATP/);
  assert.match(await text(), /结束并保存/);
  await screenshot('live');
  await d.command('POST', '/window/rect', { width: 880, height: 620 });
  const viewport = await d.read(
    'return {width:innerWidth,height:innerHeight};',
  );
  // Browser chrome differs from the native WebView; compare the content area.
  await d.command('POST', '/window/rect', {
    width: 880 + 880 - viewport.width,
    height: 620 + 620 - viewport.height,
  });
  await screenshot('live-compact');
  const controls = await d.read(
    'return {caption:document.querySelector(".caption-scroll").clientHeight,stop:document.querySelector(".classroom-controls").getBoundingClientRect().bottom,height:innerHeight};',
  );
  assert.ok(controls.caption >= 100 && controls.stop <= controls.height);
  const message = await d.read(
    `return window.localizationFixture.messageText('Recording could not keep up: 12 audio buffers (3840 samples) were lost. Check the saved recording. The audio device reported a discontinuity. Check the recording; the device did not report how much audio was affected.');`,
  );
  assert.match(message, /12 个音频缓冲区（3840 个采样点）/);
  assert.match(message, /设备未提供受影响的时长/);
  assert.doesNotMatch(message, /Recording|audio/);
  const model = await d.read(
    `return window.localizationFixture.messageText('Download Hy-MT2-1.8B · Q4_K_M in Settings → Local AI first. No text has been uploaded.');`,
  );
  assert.match(model, /下载 Hy-MT2-1.8B · Q4_K_M/);
  assert.match(model, /尚未上传任何文本/);
  const report = {
    passed: true,
    scope:
      'Full React app; synthetic IPC; no native audio, model inference or cloud calls',
    screens,
    originalEnglishContentPreserved: true,
    subjectIdentifierPreserved: true,
    destructiveConfirmationsRetained: true,
    dynamicWarningsTranslated: true,
  };
  await fs.writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  await fs.writeFile(
    `${output}/failure.png`,
    Buffer.from(await d.command('GET', '/screenshot'), 'base64'),
  );
  await fs.writeFile(`${output}/failure.txt`, await text());
  throw error;
} finally {
  await d.command('DELETE', '');
}
