// Real React workflows with controlled IPC; no audio, credentials or cloud.
import assert from 'node:assert/strict';
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
          '--window-size=1100,1100',
        ],
      },
    },
  },
}));
async function until(script) {
  for (let n = 0; n < 80; n++) {
    if (await d.read(script)) return;
    await new Promise((r) => setTimeout(r, 75));
  }
  throw Error(`Workflow timeout: ${script}`);
}
try {
  await d.command('POST', '/url', {
    url:
      process.env.LECTURERELAY_COMPONENT_URL +
      '/tests/fixtures/localization.html?speech=groq',
  });
  await until('return !!document.querySelector(".course-card");');
  assert.equal(
    await d.read(
      'return window.localizationFixture.messageText({code:"cannot_save_notes",message:"changed English wording",params:[]});',
    ),
    '无法保存笔记。',
  );
  const safeError = await d.read(
    'return window.localizationFixture.messageText({code:"unknown",message:"untrusted-private-canary"});',
  );
  assert.doesNotMatch(safeError, /canary|untrusted/);
  await d.click('aside button[aria-label="Introduction to Biology"]');
  await until('return !!document.querySelector(".lecture-row");');
  await d.click('.lecture-row');
  await until('return !!document.querySelector(".replay-player");');
  await d.clickText('继续转录');
  await until(
    'return !!document.querySelector(".modal") || !!document.querySelector(".settings-page");',
  );
  assert.ok(
    await d.read('return !!document.querySelector(".modal");'),
    'A valid speech Key must allow transcription independently of text provider',
  );
  await d.click('.modal .primary');
  await until(
    'return window.localizationFixture.calls.includes("transcribe_lecture");',
  );
  for (const [query, expected] of [
    ['speech=openai', 'confirm'],
    ['speech=groq&text=openai&missing=groq', 'settings'],
    ['speech=none&text=groq', 'confirm'],
    ['speech=local', 'direct'],
    ['speech=groq', 'cancel'],
    ['speech=groq&reject', 'confirm'],
  ]) {
    await d.command('POST', '/url', {
      url:
        process.env.LECTURERELAY_COMPONENT_URL +
        '/tests/fixtures/localization.html?' +
        query,
    });
    await until('return !!document.querySelector(".course-card");');
    await d.click('aside button[aria-label="Introduction to Biology"]');
    await until('return !!document.querySelector(".lecture-row");');
    await d.click('.lecture-row');
    await until('return !!document.querySelector(".replay-player");');
    await d.clickText('继续转录');
    if (expected !== 'direct') {
      await until(
        'return !!document.querySelector(".modal") || !!document.querySelector(".settings-page");',
      );
      if (expected === 'settings') {
        assert.ok(
          await d.read('return !!document.querySelector(".settings-page");'),
          query,
        );
      } else {
        assert.ok(
          await d.read('return !!document.querySelector(".modal");'),
          query,
        );
        await d.click(
          expected === 'cancel' ? '.modal .secondary' : '.modal .primary',
        );
      }
    }
    if (expected === 'direct' || expected === 'confirm')
      await until(
        'return window.localizationFixture.calls.includes("transcribe_lecture");',
      );
    else
      assert.equal(
        await d.read(
          'return window.localizationFixture.calls.includes("transcribe_lecture");',
        ),
        false,
        query,
      );
    if (query.includes('reject')) {
      await until('return !!document.querySelector(".toast.error");');
      assert.equal(
        await d.read(
          'return document.querySelector(".toast.error span").textContent;',
        ),
        '服务商暂时不可用，请稍后重试。',
      );
    }
  }
  await d.command('POST', '/url', {
    url:
      process.env.LECTURERELAY_COMPONENT_URL +
      '/tests/fixtures/live-summary.html?race',
  });
  await until(
    'return !!window.liveSummaryFixture && !!document.querySelector(".summary-live-status");',
  );
  await d.clickText('立即总结');
  await d.read('window.liveSummaryFixture.holdReads=true;');
  await until('return window.liveSummaryFixture.reads.length>=1;');
  const waitingReads = await d.read(
    'return window.liveSummaryFixture.readCount;',
  );
  await new Promise((r) => setTimeout(r, 2100));
  assert.equal(
    await d.read('return window.liveSummaryFixture.readCount;'),
    waitingReads,
    'Polling must coalesce slow reads',
  );
  await d.read('window.liveSummaryFixture.settle();');
  await until('return window.liveSummaryFixture.reads.length>=2;');
  await d.read('window.liveSummaryFixture.reads[1]();');
  await until('return document.querySelectorAll(".summary-card").length===1;');
  await d.read('window.liveSummaryFixture.reads[0]();');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(
    await d.read('return document.querySelectorAll(".summary-card").length;'),
    1,
    'An old response must not hide completed cards',
  );
  await d.command('POST', '/url', {
    url:
      process.env.LECTURERELAY_COMPONENT_URL +
      '/tests/fixtures/live-summary.html?race',
  });
  await until(
    'return !!window.liveSummaryFixture && !!document.querySelector(".summary-live-status");',
  );
  await d.read('window.liveSummaryFixture.failGeneration=true;');
  await d.clickText('立即总结');
  await until(
    'return !!document.querySelector(".live-summary-panel [role=alert]");',
  );
  const readCount = await d.read('return window.liveSummaryFixture.readCount;');
  await until(`return window.liveSummaryFixture.readCount>${readCount};`);
  assert.match(
    await d.read(
      'return document.querySelector(".live-summary-panel [role=alert]")?.textContent || "";',
    ),
    /连接暂时不可用/,
    'Successful polling must not hide a failed generation',
  );
  await d.command('POST', '/url', {
    url: process.env.LECTURERELAY_COMPONENT_URL + '/tests/fixtures/audit.html',
  });
  await until('return !!window.auditFixture;');
  await d.clickText('编辑笔记');
  const editor = await d.element('textarea');
  await d.command('POST', `/element/${editor}/value`, { text: ' quick exit' });
  const draft = await d.read(
    'return document.querySelector("textarea").value;',
  );
  await d.read('window.auditFixture.showNotes(false);');
  await until('return !document.querySelector("textarea");');
  await until(`return window.auditFixture.draft===${JSON.stringify(draft)};`);
  await d.read(
    'localStorage.removeItem("lecturerelay-note-draft:audit-fixture"); window.auditFixture.showNotes(true);',
  );
  await until('return !!document.querySelector("textarea");');
  assert.equal(
    await d.read('return document.querySelector("textarea").value;'),
    draft,
    'Quick navigation must flush the recoverable draft to SQLite',
  );
  const beforeDraft = await d.read(
    'return window.auditFixture.calls.filter(x=>x==="saveDraft").length;',
  );
  await d.read('window.auditFixture.holdDrafts=true;');
  const firstEditor = await d.element('textarea');
  await d.command('POST', `/element/${firstEditor}/value`, {
    text: ' pending write',
  });
  await d.read('window.auditFixture.showNotes(false);');
  await until(
    `return window.auditFixture.calls.filter(x=>x==="saveDraft").length>${beforeDraft};`,
  );
  await d.read('window.auditFixture.showNotes(true);');
  await until('return !!document.querySelector("textarea");');
  const secondEditor = await d.element('textarea');
  await d.command('POST', `/element/${secondEditor}/value`, {
    text: ' newest note',
  });
  const newest = await d.read(
    'return document.querySelector("textarea").value;',
  );
  await d.clickText('保存笔记');
  assert.equal(
    await d.read(
      'return window.auditFixture.calls.filter(x=>x==="saveNote").length;',
    ),
    0,
    'A remounted editor must wait for older draft writes',
  );
  await d.read(
    'window.auditFixture.holdDrafts=false; window.auditFixture.finishDraft();',
  );
  await until('return window.auditFixture.calls.includes("saveNote");');
  await d.read('window.auditFixture.settle();');
  await until('return !document.querySelector("textarea");');
  assert.equal(await d.read('return window.auditFixture.note;'), newest);
  console.log(
    JSON.stringify({
      passed: true,
      independentSpeechProvider: true,
      latestSummaryResponse: true,
      quickDraftRecovery: true,
      structuredErrors: true,
      crossMountDraftOrdering: true,
      slowSummaryReadsCoalesced: true,
    }),
  );
} finally {
  await d.command('DELETE', '').catch(() => {});
}
