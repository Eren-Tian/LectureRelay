import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = process.env.LECTURERELAY_WEBDRIVER_PORT || '4444';
const sessionFile = path.join(
  root,
  `target/webdriver-session${port === '4444' ? '' : '-' + port}.json`,
);
export class WebDriver {
  constructor(session) {
    this.session = session;
  }
  async request(method, endpoint, body) {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60000),
    });
    const { value } = await response.json();
    if (!response.ok || value?.error)
      throw new Error(`${value.error}: ${value.message}`);
    return value;
  }
  async command(method, endpoint, body) {
    return this.request(method, `/session/${this.session}${endpoint}`, body);
  }
  async read(script, args = []) {
    return this.command('POST', '/execute/sync', { script, args });
  }
  async native(command, args = {}) {
    if (
      ![
        'bootstrap',
        'study_state',
        'library_search',
        'live_status',
        'recording_status',
        'lecture_detail',
        'course_detail',
        'local_model_status',
        'local_text_models',
        'job_status',
        'provider_status',
        'trash_courses',
        'existing_lecture_ids',
      ].includes(command)
    ) {
      throw new Error(
        `Only read-only native inspection is allowed: ${command}`,
      );
    }
    // W3C execute/sync waits for a returned Promise. Avoid execute/async here:
    // EdgeDriver 154's callback wrapper retained each result in a long timer
    // during installed acceptance, contaminating the WebView memory baseline.
    return this.command('POST', '/execute/sync', {
      script:
        'return window.__TAURI_INTERNALS__.invoke(arguments[0],arguments[1]).then(v=>({ok:true,value:v}),()=>({ok:false}));',
      args: [command, args],
    }).then((r) => {
      if (!r.ok) throw new Error(`Native read failed: ${command}`);
      return r.value;
    });
  }
  async element(selector) {
    const value = await this.command('POST', '/element', {
      using: 'css selector',
      value: selector,
    });
    return value['element-6066-11e4-a52e-4f735466cecf'];
  }
  async click(selector) {
    return this.command(
      'POST',
      `/element/${await this.element(selector)}/click`,
      {},
    );
  }
  async course(name) {
    if (!name.startsWith('[ACCEPTANCE '))
      throw new Error('Require labelled test course');
    const element = await this.read(
      "return [...document.querySelectorAll('.course-card')].find(e=>e.querySelector('h3')?.textContent.trim()===arguments[0]);",
      [name],
    );
    if (!element) throw new Error('Exact acceptance course missing');
    return this.command(
      'POST',
      `/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`,
      {},
    );
  }
  async lecture(title) {
    if (!title.startsWith('[ACCEPTANCE]'))
      throw new Error('Require labelled test lecture');
    const element = await this.read(
      "return [...document.querySelectorAll('.lecture-row')].find(e=>e.querySelector('h3')?.textContent.trim()===arguments[0]);",
      [title],
    );
    if (!element) throw new Error('Exact acceptance lecture missing');
    return this.command(
      'POST',
      `/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`,
      {},
    );
  }
  async clickText(text) {
    const deadline = Date.now() + 10000;
    let element;
    do {
      element = await this.read(
        "return [...document.querySelectorAll('button')].find(e=>e.innerText.trim()===arguments[0] && e.getClientRects().length && !e.disabled);",
        [text],
      );
      if (element) break;
      await new Promise((r) => setTimeout(r, 100));
    } while (Date.now() < deadline);
    if (!element) throw new Error(`Visible enabled button missing: ${text}`);
    return this.command(
      'POST',
      `/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`,
      {},
    );
  }
  async scroll(selector, deltaY) {
    const element = await this.element(selector);
    return this.command('POST', '/actions', {
      actions: [
        {
          type: 'wheel',
          id: 'acceptance-wheel',
          actions: [
            {
              type: 'scroll',
              x: 0,
              y: 0,
              deltaX: 0,
              deltaY,
              duration: 200,
              origin: { 'element-6066-11e4-a52e-4f735466cecf': element },
            },
          ],
        },
      ],
    });
  }
  async clickAt(x, y) {
    return this.command('POST', '/actions', {
      actions: [
        {
          type: 'pointer',
          id: 'acceptance-pointer',
          parameters: { pointerType: 'mouse' },
          actions: [
            {
              type: 'pointerMove',
              x: Math.round(x),
              y: Math.round(y),
              duration: 0,
              origin: 'viewport',
            },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    });
  }
  async fill(selector, text) {
    const id = await this.element(selector);
    await this.command('POST', `/element/${id}/clear`, {});
    return this.command('POST', `/element/${id}/value`, {
      text,
      value: [...text],
    });
  }
  async snapshot() {
    return this.read(
      `return {url:location.href,text:document.body.innerText,controls:[...document.querySelectorAll('button,input,textarea,select,audio')].map(e=>({tag:e.tagName,type:e.type,id:e.id,name:e.name,label:e.getAttribute('aria-label'),text:e.tagName==='SELECT'?e.innerText:e.tagName==='BUTTON'?e.innerText:null,value:e.type==='password'?'<redacted>':e.value,disabled:e.disabled}))};`,
    );
  }
  async screenshot(name) {
    const image = await this.command('GET', '/screenshot');
    const dir = path.join(root, 'target/installed-acceptance/screenshots');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `${name}.png`),
      Buffer.from(image, 'base64'),
    );
  }
  static async current() {
    return new WebDriver(
      JSON.parse(await fs.readFile(sessionFile, 'utf8')).value.sessionId,
    );
  }
  static async start(application) {
    const driver = new WebDriver();
    const value = await driver.request('POST', '/session', {
      capabilities: {
        alwaysMatch: { browserName: 'wry', 'tauri:options': { application } },
      },
    });
    await fs.writeFile(sessionFile, JSON.stringify({ value }, null, 2));
    return new WebDriver(value.sessionId);
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [action, selector, value] = process.argv.slice(2);
  const driver =
    action === 'start'
      ? await WebDriver.start(selector)
      : await WebDriver.current();
  if (action === 'click') await driver.click(selector);
  if (action === 'button') await driver.clickText(selector);
  if (action === 'scroll') await driver.scroll(selector, Number(value));
  if (action === 'fill') await driver.fill(selector, value);
  if (action === 'read')
    console.log(JSON.stringify(await driver.read(selector), null, 2));
  else if (action === 'screenshot') await driver.screenshot(selector);
  else if (action === 'quit') await driver.command('DELETE', '');
  else if (action === 'snapshot' || action === 'start')
    console.log(JSON.stringify(await driver.snapshot(), null, 2));
  else console.log(JSON.stringify({ completed: action }));
}
