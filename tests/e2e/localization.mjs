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
  await click('清空数据与模型…');
  await until('return !!document.querySelector(".modal input");');
  assert.match(await text(), /输入 清空 以确认/);
  assert.equal(
    await d.read('return document.querySelector(".modal .danger").disabled;'),
    true,
  );
  await click('取消');
  await click('永久删除');
  await until('return !!document.querySelector(".modal");');
  assert.equal(
    await d.read('return !!document.querySelector(".modal input");'),
    false,
  );
  assert.match(await text(), /无法恢复/);
  await click('取消');
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await until('return !!document.querySelector(".lecture-row");');
  // A position saved by an earlier session is offered, not applied.
  await d.read(
    'localStorage.setItem("lecturerelay-position:localization-lecture", "30");',
  );
  await d.click('.lecture-row');
  await until('return !!document.querySelector(".replay-player");');
  assert.match(await text(), /录音设备报告声音中断/);
  assert.match(await text(), /Mitochondria produce ATP/);
  await screenshot('replay');
  // The app's own player: ←/→ move the playhead by 5 s when no control has focus.
  assert.match(
    await d.read('return document.querySelector(".player-time").textContent;'),
    /^00:00 \//,
  );
  await click('从 00:30 继续');
  await until(
    'return document.querySelector(".player-time").textContent.startsWith("00:30");',
  );
  assert.equal(
    await d.read('return !!document.querySelector(".player-resume");'),
    false,
  );
  await d.read(
    'document.activeElement?.blur(); document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));',
  );
  await until(
    'return document.querySelector(".player-time").textContent.startsWith("00:35");',
  );
  assert.equal(
    await d.read(
      'return document.querySelector(".follow-toggle").getAttribute("aria-pressed");',
    ),
    'true',
  );
  // Selecting transcript text offers "Ask AI", which opens Q&A with the excerpt.
  await d.read(
    'const p=document.querySelector(".transcript-segment .source-text"); const r=document.createRange(); r.selectNodeContents(p); const s=getSelection(); s.removeAllRanges(); s.addRange(r); p.closest(".transcript-list").dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));',
  );
  await click('问 AI');
  await until(
    'return document.querySelector("#lecture-question")?.value.includes("Mitochondria produce ATP");',
  );
  assert.equal(
    await d.read('return document.activeElement.id;'),
    'lecture-question',
  );
  await screenshot('replay-ask-selection');
  // An answer can be added to the note draft.
  await click('加入我的笔记');
  await until(
    'return !!document.querySelector("textarea[aria-label=课堂笔记]") && document.querySelector("textarea[aria-label=课堂笔记]").value.includes("**What makes ATP?**");',
  );
  await click('问答');
  // A short selection can be added to the course glossary.
  await d.read(
    'const t=document.querySelector(".transcript-segment .source-text").firstChild; const r=document.createRange(); r.setStart(t,0); r.setEnd(t,12); const s=getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector(".transcript-list").dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));',
  );
  await click('加入术语表');
  await until(
    'return document.querySelector(".modal input")?.value === "Mitochondria";',
  );
  await d.fill('.modal input[placeholder]', '线粒体');
  await click('添加术语');
  await until('return !!window.localizationFixture.savedTerm;');
  assert.equal(
    await d.read('return window.localizationFixture.savedTerm;'),
    'Mitochondria=线粒体',
  );
  // Speakers: label a segment, then rename that speaker everywhere.
  await d.read('document.querySelector(".speaker-chip").click();');
  await click('老师');
  await until(
    'return document.querySelector(".speaker-chip").textContent === "老师";',
  );
  await until('return !document.querySelector(".modal");');
  await d.read('document.querySelector(".speaker-chip").click();');
  // The dialog renders and focuses its field on the next frame.
  await until(
    'return document.activeElement === document.querySelector(".modal input");',
  );
  await d.fill('.modal input', '李老师');
  await until(
    'return document.querySelector(".modal input").value === "李老师";',
  );
  await click('把所有“老师”改成这个名字');
  await until(
    'return document.querySelector(".speaker-chip").textContent === "李老师";',
  );
  await screenshot('replay-speaker');
  assert.match(
    await d.read(
      'return document.querySelector(".replay-heading p").textContent;',
    ),
    /1 位讲话人/,
  );
  // Automatic speaker detection keeps the typed name.
  await click('识别讲话人');
  await until('return document.body.innerText.includes("找到 1 位讲话人");');
  assert.equal(
    await d.read('return document.querySelector(".speaker-chip").textContent;'),
    '李老师',
  );
  // Without the speaker model, the button leads to Local models.
  await d.read('window.localizationFixture.speakerModelInstalled = false;');
  await click('识别讲话人');
  await until(
    'return document.body.innerText.includes("请先下载讲话人识别模型") && !!document.querySelector(".settings-nav");',
  );
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await until('return !!document.querySelector(".lecture-row");');
  await d.click('.lecture-row');
  await until('return !!document.querySelector(".replay-player");');
  // Keyword chips filter the transcript, and a second click clears the filter.
  const keyword =
    'return [...document.querySelectorAll(".keyword-chips button")].find(b=>b.textContent.startsWith("Mitochondria"))';
  await until(`return !!(${keyword.slice(7)});`);
  await d.read(`${keyword.slice(7)}.click();`);
  await until(
    'return document.querySelector("input[type=search]").value === "Mitochondria";',
  );
  assert.equal(
    await d.read(`${keyword}.getAttribute("aria-pressed");`),
    'true',
  );
  await d.read(`${keyword.slice(7)}.click();`);
  await until(
    'return document.querySelector("input[type=search]").value === "";',
  );
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
  // The notes show either rendered or in the editor, which reopens for a draft.
  assert.match(
    await d.read(
      'return document.querySelector(".study-notes").innerText + (document.querySelector("textarea[aria-label=课堂笔记]")?.value ?? "");',
    ),
    /Original manual notes/,
  );
  await click('删除课堂记录');
  await until('return !!document.querySelector(".modal");');
  assert.match(await text(), /“Cellular respiration”的录音.*无法恢复/);
  await screenshot('delete-confirmation');
  await click('取消');
  assert.ok(
    !(await d.read('return window.localizationFixture.calls;')).some((c) =>
      /delete|free_all/.test(c),
    ),
  );
  await d.click('aside button[aria-label="Introduction to Biology"]');
  // Dropping a file: other types are refused; media opens the import dialog.
  await d.read('window.localizationFixture.drop(["C:/Lectures/slides.pdf"]);');
  await until('return document.body.innerText.includes("只能导入 WAV");');
  await d.read(
    'window.localizationFixture.drop(["C:/Lectures/Week 3 enzymes.mp3"]);',
  );
  await until('return !!document.querySelector(".dropped-file");');
  assert.match(
    await d.read('return document.querySelector(".dropped-file").textContent;'),
    /Week 3 enzymes.mp3/,
  );
  assert.equal(
    await d.read(
      'return document.querySelector(".modal input:not([type])").value;',
    ),
    'Week 3 enzymes',
  );
  await screenshot('import-dropped');
  await click('导入');
  await until(
    'return window.localizationFixture.droppedImport === "Week 3 enzymes";',
  );
  await until('return !!document.querySelector(".replay-player");');
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await until('return !!document.querySelector(".course-delete");');
  // A link straight to a media file downloads and imports it.
  await click('导入音视频');
  await until('return !!document.querySelector(".modal input[type=url]");');
  await d.fill('.modal input[type=url]', 'https://example.edu/week4.mp4');
  await click('下载并导入');
  await until(
    'return window.localizationFixture.linkImport === "https://example.edu/week4.mp4";',
  );
  await until('return !!document.querySelector(".replay-player");');
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await until('return !!document.querySelector(".course-delete");');
  // Trash is recoverable: the course moves at once and the toast offers Undo.
  await click('删除课程');
  await until('return !!document.querySelector(".toast .text-button");');
  assert.match(await text(), /课程已移入回收站/);
  assert.equal(
    await d.read('return !!document.querySelector(".modal");'),
    false,
  );
  await click('撤销');
  await until(
    'return window.localizationFixture.calls.includes("restore_course") && !!document.querySelector(".course-delete");',
  );
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
    `return window.localizationFixture.messageText('Download Hy-MT2-1.8B · Q4_K_M in Settings → AI & models → Local models first. No text has been uploaded.');`,
  );
  assert.match(model, /下载 Hy-MT2-1.8B · Q4_K_M/);
  assert.match(model, /设置 → AI 与模型 → 本地模型/);
  assert.match(model, /尚未上传任何文本/);
  // A replacement device chosen by the recorder is announced.
  await d.read('window.localizationFixture.switchDevice("Laptop Microphone");');
  await until(
    'return document.body.innerText.includes("已自动切换到 Laptop Microphone");',
  );
  // The device can also be switched by hand during the lecture.
  await d.read('window.localizationFixture.extraDevice = true;');
  await d.click('.actual-device');
  await click('Desk Microphone');
  await until(
    'return document.body.innerText.includes("已切换到 Desk Microphone，录音没有中断");',
  );
  assert.match(
    await d.read(
      'return document.querySelector(".actual-device").textContent;',
    ),
    /Desk Microphone/,
  );
  // If the device fails mid-lecture, one click saves and starts a follow-on.
  await d.read('window.localizationFixture.failRecording();');
  await click('保存并继续录音');
  await until(
    'return [...document.querySelectorAll(".modal input")].some(i=>i.value==="Cellular respiration（续）");',
  );
  assert.ok(
    (await d.read('return window.localizationFixture.calls;')).includes(
      'stop_lecture',
    ),
  );
  await screenshot('device-lost-continue');
  await click('取消');
  // A lecture in progress with live summaries on, at a common laptop size:
  // the newest summary leads, is readable without scrolling and gets a
  // full-height column beside the captions.
  await d.command('POST', '/window/rect', { width: 1366, height: 768 });
  const laptop = await d.read('return {width:innerWidth,height:innerHeight};');
  await d.command('POST', '/window/rect', {
    width: 1366 + 1366 - laptop.width,
    height: 768 + 768 - laptop.height,
  });
  await d.command('POST', '/url', {
    url:
      process.env.LECTURERELAY_COMPONENT_URL +
      '/tests/fixtures/localization.html?classroom',
  });
  await until('return !!document.querySelector(".course-card");');
  // The lecture left at 00:30 earlier is offered on the home page.
  await until('return !!document.querySelector(".continue-card");');
  assert.match(
    await d.read(
      'return document.querySelector(".continue-learning").innerText;',
    ),
    /继续学习[\s\S]*Cellular respiration[\s\S]*从 00:30 继续/,
  );
  await screenshot('home-continue');
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await click('开始录音');
  await until(
    'return !!document.querySelector(".modal select option[value=fixture-device]");',
  );
  await d.read('document.querySelector(".modal form").requestSubmit();');
  await until(
    'return document.querySelectorAll(".live-summary-panel .summary-card").length===2;',
  );
  const classroom = await d.read(`
    const box = (s) => document.querySelector(s).getBoundingClientRect();
    const first = document.querySelector('.live-summary-panel .summary-card');
    return {
      latest: first.classList.contains('summary-latest'),
      title: first.querySelector('.summary-title').textContent,
      badge: first.querySelector('.summary-badge')?.textContent,
      firstPointBottom: first.querySelector('.summary-points li').getBoundingClientRect().bottom,
      height: innerHeight,
      tools: box('.study-tools').width,
      columns: box('.study-columns').width,
      progress: !!document.querySelector('.summary-progress'),
      notice: !!document.querySelector('.classroom-notice'),
      chip: document.querySelector('.classroom-chip')?.textContent,
    };`);
  assert.equal(classroom.latest, true);
  assert.equal(classroom.title, '线粒体中的能量转换');
  assert.equal(classroom.badge, '最新');
  assert.ok(
    classroom.firstPointBottom < classroom.height - 150,
    `newest summary below the fold: ${JSON.stringify(classroom)}`,
  );
  assert.ok(classroom.tools >= classroom.columns * 0.4, 'summary column');
  assert.ok(classroom.progress && !classroom.notice);
  assert.match(classroom.chip, /英文识别进度正常/);
  await d.read(
    'document.querySelector(".study-tabs [aria-selected=true]").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));',
  );
  await until(
    'return document.querySelector(".study-tabs [aria-selected=true]").textContent==="我的笔记" && document.activeElement.textContent==="我的笔记";',
  );
  await screenshot('live-summary-classroom');
  const report = {
    passed: true,
    scope:
      'Full React app; synthetic IPC; no native audio, model inference or cloud calls',
    screens,
    originalEnglishContentPreserved: true,
    subjectIdentifierPreserved: true,
    destructiveConfirmationsRetained: true,
    dynamicWarningsTranslated: true,
    newestLiveSummaryLeadsAndIsVisible: true,
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
