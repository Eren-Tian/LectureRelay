// Diagnostic snapshot of the explicitly selected installed test app only.
// https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root = 'target/acceptance-v0.3-2026-10-03';
const port = process.env.LECTURERELAY_WEBDRIVER_PORT || '4448';
const session = JSON.parse(
  await fs.readFile(`target/webdriver-session-${port}.json`, 'utf8'),
);
const address = session.value.capabilities['ms:edgeOptions'].debuggerAddress;
const url = new URL(`http://${address}/json/list`);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
const pages = await (await fetch(url)).json();
const selected = pages.filter(
  (p) =>
    p.type === 'page' &&
    p.title === 'LectureRelay' &&
    p.url === 'http://tauri.localhost/',
);
assert.equal(selected.length, 1);
const socket = new WebSocket(selected[0].webSocketDebuggerUrl);
const chunks = [];
const started = Date.now();
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(Error('Snapshot timed out')), 60000);
  socket.addEventListener(
    'error',
    () => {
      clearTimeout(timeout);
      reject(Error('Snapshot connection failed'));
    },
    { once: true },
  );
  socket.addEventListener(
    'open',
    () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: 'HeapProfiler.takeHeapSnapshot',
          params: { reportProgress: false },
        }),
      ),
    { once: true },
  );
  socket.addEventListener('message', (event) => {
    const item = JSON.parse(String(event.data));
    if (item.method === 'HeapProfiler.addHeapSnapshotChunk')
      chunks.push(item.params.chunk);
    if (item.id === 1) {
      clearTimeout(timeout);
      socket.close();
      if (item.error) reject(Error(JSON.stringify(item.error)));
      else resolve();
    }
  });
});
const file = `${root}/post-soak.heapsnapshot`;
await fs.writeFile(file, chunks.join(''));
console.log(
  JSON.stringify({
    file,
    seconds: (Date.now() - started) / 1000,
    bytes: (await fs.stat(file)).size,
  }),
);
