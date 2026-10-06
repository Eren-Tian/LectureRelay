// Silent, read-only acceptance of the installed app. No key reads, requests,
// model inference, recording or audio playback.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';

const application = process.env.LECTURERELAY_LATENCY_EXE;
assert.ok(application, 'Set the exact installed EXE');
const version = JSON.parse(
  await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'),
).version;
const d = await WebDriver.start(application);
try {
  let boot;
  for (let i = 0; i < 80; i++) {
    try {
      boot = await d.native('bootstrap');
    } catch {
      /* WebView starting */
    }
    if (boot?.storage.version === version) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(boot?.storage.version, version);
  assert.equal(await d.native('recording_status'), null);
  assert.equal(await d.native('job_status'), null);
  const before = await d.native('live_summary_setup');
  assert.notEqual(before.preferences.provider, 'local');
  // Do not let the test cause an already enabled feature to process anything.
  assert.equal(
    before.preferences.enabled,
    false,
    'Requires an idle app with summaries Off',
  );
  await d.clickText('设置');
  await d.clickText('实时总结');
  const end = Date.now() + 15000;
  while (
    !(await d.read(
      'return !!document.querySelector(".live-summary-setup select");',
    ))
  ) {
    assert.ok(Date.now() < end, 'Summary settings UI did not open');
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const options = await d.read(
    'return [...document.querySelector(".live-summary-setup select").options].map(o=>o.value);',
  );
  assert.deepEqual(options, ['groq', 'openai', 'none']);
  assert.equal(
    await d.read(
      'return [...document.querySelectorAll(".live-summary-setup button")].find(b=>b.textContent.trim()==="启用实时总结").disabled;',
    ),
    true,
  );
  assert.match(
    await d.read(
      'return document.querySelector(".live-summary-setup").innerText;',
    ),
    /已停用本地 Qwen 实时总结/,
  );
  const after = await d.native('live_summary_setup');
  assert.deepEqual(
    after,
    before,
    'Inspecting setup must not alter preferences, credentials or test status',
  );
  await fs.mkdir('target/live-summaries', { recursive: true });
  await fs.writeFile(
    'target/live-summaries/installed-settings-v0.3.10.json',
    JSON.stringify(
      {
        version,
        passed: true,
        options,
        summaryEnabled: after.preferences.enabled,
        preferencesUnchanged: true,
        noApiRequests: true,
        noAudio: true,
        scope:
          'Installed Windows WebView2; UI inspection only. Legacy migration and stale-client rejection verified separately in native/React regressions.',
      },
      null,
      2,
    ),
  );
  console.log('Installed summary settings acceptance passed');
} finally {
  await d.command('DELETE', '');
}
