"""Aggregate observed installed-app data without equating functional success to quality."""
import argparse
import json
from datetime import datetime
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path('target/acceptance-v0.3-2026-10-03'))
args = parser.parse_args()
root = args.root
r = json.loads((root / 'soak-result.json').read_text(encoding='utf-8'))
assert r['passed'] and r['wallSeconds'] >= 5400
start = datetime.fromisoformat(r['utcStart'].replace('Z', '+00:00')).timestamp()
rows = [json.loads(s) for s in (root / 'soak-processes.jsonl').read_text().splitlines()]
rows = [s for s in rows if start <= s['utcSeconds'] <= start + r['wallSeconds']]
ui = [json.loads(s) for s in (root / 'soak-ui.jsonl').read_text().splitlines()]
detail = json.loads((root / 'soak-detail.json').read_text(encoding='utf-8'))
segments = {s['id']: s for s in detail['segments']}
minutes = np.array([(s['utcSeconds'] - start) / 60 for s in rows])
cpu = np.array([s['cpuPercentNormalized'] for s in rows])
rss = np.array([s['rssBytesSum'] / 1048576 for s in rows])
private = np.array([s['privateBytesSum'] / 1048576 for s in rows])

def stats(values):
    a = np.array(values)
    return {'count': len(a), 'median': float(np.median(a)), 'p95': float(np.percentile(a, 95)), 'peak': float(a.max())} if len(a) else None

processes = {}
for row in rows:
    for p in row['processes']:
        key = str(p['pid'])
        if key not in processes:
            processes[key] = {'name': p['name'], 'firstMiB': p['rssBytes'] / 1048576, 'peakMiB': 0}
        processes[key]['lastMiB'] = p['rssBytes'] / 1048576
        processes[key]['peakMiB'] = max(processes[key]['peakMiB'], p['rssBytes'] / 1048576)
summary = {
    'wallSeconds': r['wallSeconds'], 'recordedSeconds': r['recordedSeconds'],
    'segments': r['segmentCount'], 'translated': r['translated'],
    'cpuPercentOfAllLogicalCpus': {**stats(cpu), 'mean': float(cpu.mean()), 'logicalCpus': rows[0]['logicalCpus']},
    'rssSumMiB': {**stats(rss), 'earlyMedian': float(np.median(rss[(minutes >= 1) & (minutes <= 5)])), 'lastTenMinuteMedian': float(np.median(rss[minutes >= 80]))},
    'privateCommitSumMiB': stats(private),
    'sourceEndToEnglishDomSeconds': stats([e['captureEndToDomSeconds'] for e in r['events'] if e['kind'] == 'english' and e['captureEndToDomSeconds'] is not None]),
    'sourceEndToTranslationDomSeconds': stats([e['captureEndToDomSeconds'] for e in r['events'] if e['kind'] == 'translation' and e['captureEndToDomSeconds'] is not None]),
    'sourceStartToTranslationDomSeconds': stats([
        e['captureEndToDomSeconds'] + segments[e['id']]['endSeconds'] - segments[e['id']]['startSeconds']
        for e in r['events'] if e['kind'] == 'translation' and e['captureEndToDomSeconds'] is not None and e['id'] in segments
    ]),
    'firstEnglishSeconds': r['firstEnglishMs'] / 1000, 'firstTranslationSeconds': r['firstTranslationMs'] / 1000,
    'maxBacklogSeconds': r['maxBacklog'], 'maxTranslationQueue': r['maxQueue'],
    'maxDroppedOrDiscontinuous': max(s['droppedChunks'] for s in ui),
    'maxDeferredTranslations': max(s['deferred'] for s in ui),
    'processRssMiB': processes,
    'instrumentation': 'Actual installed native app and real local models. UI/native polling each 5 s; whole descendant process group each 2 s; one screenshot each 15 min. RSS sums can double-count shared pages. Latency is a capture-clock/DOM proxy with up to 5 s polling, not an acoustic boundary measurement. Source-start translation latency includes the sentence/chunk accumulation time; source-end latency does not.',
}
(root / 'soak-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
fig, ax = plt.subplots(4, 1, figsize=(12, 10), sharex=True, constrained_layout=True)
ax[0].plot(minutes, rss / 1024, label='RSS sum', color='#52694f')
ax[0].plot(minutes, private / 1024, label='Private commit sum', color='#ad914d')
ax[0].set_ylabel('GiB'); ax[0].legend()
ax[1].plot(minutes, cpu, linewidth=.65, color='#52694f'); ax[1].set_ylabel('CPU % / 32 CPUs')
ax[2].plot([s['elapsedSeconds']/60 for s in ui], [s['backlogSeconds'] for s in ui], color='#52694f'); ax[2].set_ylabel('Speech backlog (s)')
ax[3].plot([s['elapsedSeconds']/60 for s in ui], [s['translationQueue'] for s in ui], color='#52694f'); ax[3].set_ylabel('Translation batches'); ax[3].set_xlabel('Real elapsed minutes')
for a in ax: a.grid(alpha=.2)
fig.suptitle('LectureRelay 0.3.0 installed Windows app — 90 real minutes\nNemotron + Hy-MT2 on CPU, shared Quiet Mode budget, synthetic system audio')
fig.savefig(root / 'soak-resources.png', dpi=150)
plt.close(fig)
print(json.dumps(summary, indent=2))
