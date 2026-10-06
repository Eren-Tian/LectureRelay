// An independently built, offline prototype. It does not modify classroom data.
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import path from 'node:path';
const model = 'target/latency-study/bergamot-model';
const files = await fs.readdir(model);
const find = (start) =>
  `${model}/${files.find((f) => f.startsWith(start) && !f.endsWith('.gz'))}`;
const application = path.resolve(
  'target/x86_64-pc-windows-msvc/release/translation-bench.exe',
);
const worker = spawn(
  application,
  [find('model.'), find('srcvocab.'), find('trgvocab.'), find('lex.')],
  { windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'] },
);
const replies = createInterface({ input: worker.stdout })[
  Symbol.asyncIterator
]();
const ready = JSON.parse((await replies.next()).value);
const original = JSON.parse(
  await fs.readFile(
    'target/latency-study/baseline-mit-cold/observation.json',
    'utf8',
  ),
);
const rows = original.detail.segments.map((s) => ({
  id: s.id,
  text: s.sourceText,
  existing: s.translatedText,
}));
rows.push({
  id: 'corrected-negation',
  text: 'I do not know either Mark or Laura, so my guess that Mark loves Laura might be true or might be false.',
});
rows.push({
  id: 'corrected-terms',
  text: 'Correlation does not establish causation. A race condition can occur when two threads update shared state.',
});
rows.push({
  id: 'corrected-number',
  text: 'This is a one-dimensional peak-finding problem. The array contains 32 elements, not 16.',
});
const results = [];
for (const row of rows) {
  worker.stdin.write(JSON.stringify(row) + '\n');
  const response = JSON.parse((await replies.next()).value);
  results.push({ ...row, result: response });
}
worker.stdin.end();
await once(worker, 'exit');
await fs.writeFile(
  'target/latency-study/bergamot-comparison.json',
  JSON.stringify(
    {
      scope:
        'Independent native offline translator, same recorded Nemotron output; not installed-app end-to-end latency',
      ready,
      results,
    },
    null,
    2,
  ),
);
const times = results.map((r) => r.result.computeMs).sort((a, b) => a - b);
console.log(
  JSON.stringify({
    ready,
    count: results.length,
    medianMs: times[Math.floor(times.length * 0.5)],
    p95Ms: times[Math.floor(times.length * 0.95)],
    checks: results.slice(-3),
  }),
);
