import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebDriver } from './webdriver.mjs';

// This four-character invalid value is deliberately not a provider credential.
// Do not substitute a real key: authenticated acceptance requires manual Settings entry.
const invalidInput = 'test';
const driver = await WebDriver.current();
const before = await driver.native('bootstrap');
assert.equal(before.settings.provider, 'none');
assert.equal(await driver.native('recording_status'), null);
assert.equal((await driver.native('live_status')).active, false);
assert(
  before.providers.every((p) => !p.hasKey),
  'Do not touch existing credentials',
);
await driver.clickText('Settings');
await driver.clickText('Security & Privacy');
const fieldBefore = await driver.read(
  'const e=document.querySelector(".key-form input");return {type:e?.type,autocomplete:e?.autocomplete,empty:e?.value===""};',
);
assert.deepEqual(fieldBefore, {
  type: 'password',
  autocomplete: 'off',
  empty: true,
});
await driver.fill('.key-form input', invalidInput);
await driver.click('.key-form button');
let error;
const deadline = Date.now() + 10000;
do {
  error = await driver.read(
    'return document.querySelector(".toast.error")?.innerText;',
  );
  if (error) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
} while (Date.now() < deadline);
assert(error?.includes('Paste a valid API key without spaces or newlines.'));
assert(!error.includes(invalidInput));
const emptyAfter = await driver.read(
  'return document.querySelector(".key-form input").value === "";',
);
assert(emptyAfter, 'Input must be cleared on a rejected save');
const statuses = await Promise.all(
  ['openai', 'groq'].map((provider) =>
    driver.native('provider_status', { provider }),
  ),
);
assert(statuses.every((status) => !status.hasKey));
assert.equal((await driver.native('bootstrap')).settings.provider, 'none');
await driver.screenshot('key-form-invalid-input');
await fs.writeFile(
  path.resolve('target/installed-acceptance/key-form-negative.json'),
  JSON.stringify(
    {
      passed: true,
      utc: new Date().toISOString(),
      fieldBefore,
      emptyAfter,
      hasSavedKey: false,
      userVisibleError: error,
      scope:
        'Actual installed password form and native local validation. No real key, credential write or cloud request; does not test server authentication.',
    },
    null,
    2,
  ),
);
console.log(
  'Installed key form rejected invalid input and cleared its password field',
);
