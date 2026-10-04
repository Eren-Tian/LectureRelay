// Checks rendered production CSS, including browser-composited disabled controls.
// This is a focused contrast check, not a complete accessibility audit.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.LECTURERELAY_WEBDRIVER_PORT =
  process.env.LECTURERELAY_COMPONENT_DRIVER_PORT || '4446';
const { WebDriver } = await import('./webdriver.mjs');
const d = new WebDriver();
const { sessionId } = await d.request('POST', '/session', {
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
});
d.session = sessionId;
const root = 'target/engineering-audit';
await fs.mkdir(root, { recursive: true });
const luminance = (rgb) =>
  rgb
    .map((n) => {
      const s = n / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const results = [];
try {
  await d.command('POST', '/url', {
    url:
      (process.env.LECTURERELAY_COMPONENT_URL || 'http://127.0.0.1:5173') +
      '/tests/fixtures/audit.html',
  });
  await d.read(
    `document.body.insertAdjacentHTML('beforeend', '<section id="contrast-controls" style="padding:24px;display:grid;gap:16px"><input placeholder="Course background and terminology"><button class="button primary">Start lecture</button><button class="button secondary">Save changes</button><button class="button primary" disabled>Saving notes…</button><button class="button danger">Permanently delete</button><button class="icon-button segment-edit" aria-label="Edit transcript">✎</button></section>');`,
  );
  for (const theme of ['light', 'dark']) {
    await d.read('document.documentElement.dataset.theme=arguments[0];', [
      theme,
    ]);
    // Let the production 120 ms background transition finish before measuring.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const samples = await d.read(
      `
      const probe=document.createElement('span');document.body.append(probe);
      const rgb=value=>value.match(/[\\d.]+/g).slice(0,3).map(Number);
      const color=name=>{probe.style.color='var(--'+name+')';return rgb(getComputedStyle(probe).color);};
      const tokens={};for(const name of ['ink','muted','secondary','paper','canvas','sidebar','soft','hover','sage','on-accent','danger','control-line','switch-track','switch-thumb'])tokens[name]=color(name);
      probe.remove();
      const controls=[...document.querySelectorAll('#contrast-controls button')].map(e=>{
        const c=getComputedStyle(e);return {name:e.innerText||e.ariaLabel,fg:rgb(c.color),bg:c.backgroundColor==='rgba(0, 0, 0, 0)'?tokens.canvas:rgb(c.backgroundColor),opacity:Number(c.opacity)};
      });
      return {tokens,controls};`,
      [theme],
    );
    const checks = [];
    const check = (name, a, b, minimum) => {
      const ratio = contrast(a, b);
      checks.push({ name, ratio: +ratio.toFixed(2), minimum });
      assert.ok(
        ratio >= minimum,
        `${theme} ${name}: ${ratio.toFixed(2)} < ${minimum}`,
      );
    };
    const t = samples.tokens;
    for (const fg of ['ink', 'secondary', 'muted'])
      for (const bg of ['paper', 'canvas', 'sidebar', 'soft', 'hover'])
        check(`${fg} on ${bg}`, t[fg], t[bg], 4.5);
    check('accent button', t['on-accent'], t.sage, 4.5);
    check('input border', t['control-line'], t.paper, 3);
    check('switch thumb', t['switch-thumb'], t['switch-track'], 3);
    for (const c of samples.controls) {
      assert.equal(c.opacity, 1, `${theme} ${c.name} must not fade text`);
      check(c.name, c.fg, c.bg, 4.5);
    }
    const screenshot = await d.command('GET', '/screenshot');
    await fs.writeFile(
      `${root}/contrast-${theme}.png`,
      Buffer.from(screenshot, 'base64'),
    );
    results.push({ theme, checks });
  }
  const report = {
    passed: true,
    scope:
      'Production CSS rendered in headless Edge; selected text, border, switch and disabled-control pairs only',
    results,
  };
  await fs.writeFile(`${root}/contrast.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await d.command('DELETE', '');
}
