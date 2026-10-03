"""Aggregate the completed installed-app run and plot its measured resource history."""
import json
from datetime import datetime
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path('target/installed-acceptance')
result = json.loads((root / 'soak-result.json').read_text(encoding='utf-8'))
assert result['passed'], 'Do not summarize a failed controller run as passed'
start = datetime.fromisoformat(result['utcStart'].replace('Z', '+00:00')).timestamp()
end = start + result['wallSeconds']
processes = [json.loads(line) for line in (root / 'soak-processes.jsonl').read_text(encoding='utf-8').splitlines()]
processes = [p for p in processes if start <= p['utcSeconds'] <= end]
ui = [json.loads(line) for line in (root / 'soak-ui.jsonl').read_text(encoding='utf-8').splitlines()]
cpu = np.array([p['cpuPercentNormalized'] for p in processes])
rss = np.array([p['rssBytesSum'] / 1048576 for p in processes])
private = np.array([p['privateBytesSum'] / 1048576 for p in processes])
minutes = np.array([(p['utcSeconds'] - start) / 60 for p in processes])
late = rss[minutes >= minutes[-1] - 10]
early = rss[(minutes >= 1) & (minutes <= 5)]
latencies = np.array([e['endOfChunkToDomSeconds'] for e in result['events'] if e['kind'] == 'partial'])
final_latencies = np.array([e['endOfChunkToDomSeconds'] for e in result['events'] if e['kind'] == 'final'])
wave = json.loads((root / 'soak-wave.json').read_text(encoding='utf-8')) if (root / 'soak-wave.json').exists() else None
summary = {
    'runCompleted': True,
    'waveVerified': wave['passed'] if wave else None,
    'wallSeconds': result['wallSeconds'],
    'recordedSeconds': result['recordedSeconds'],
    'segmentCount': result['segmentCount'],
    'firstCaptionSeconds': result['firstCaptionMs'] / 1000,
    'cpuNormalized': {'meanPercent': float(cpu.mean()), 'p95Percent': float(np.percentile(cpu, 95)), 'peakPercent': float(cpu.max()), 'logicalCpus': processes[0]['logicalCpus']},
    'workingSetSumMiB': {'mean': float(rss.mean()), 'peak': float(rss.max()), 'earlyMedian': float(np.median(early)), 'lastTenMinuteMedian': float(np.median(late)), 'growthOfWindowMedians': float(np.median(late) - np.median(early))},
    'privateCommitSumMiB': {'mean': float(private.mean()), 'peak': float(private.max())},
    'partialChunkEndToDomSeconds': {'samples': len(latencies), 'median': float(np.median(latencies)), 'p95': float(np.percentile(latencies, 95)), 'peak': float(latencies.max())},
    'finalChunkEndToDomSeconds': {'samples': len(final_latencies), 'median': float(np.median(final_latencies)), 'p95': float(np.percentile(final_latencies, 95)), 'peak': float(final_latencies.max())},
    'maxBacklogSeconds': result['maxBacklogSeconds'],
    'droppedOrDiscontinuousCount': result['droppedChunks'],
    'warnings': result['warnings'],
    'restartPreserved': result['restartPreserved'],
    'instrumentation': 'Native WebDriver DOM/native status polling each second and process sampling each 2 seconds. This run also requested screenshots throughout each 15-minute milestone minute; that screenshot cadence is measurement overhead, not ordinary student use.',
}
(root / 'soak-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
fig, axes = plt.subplots(3, 1, figsize=(12, 9), sharex=True, constrained_layout=True)
axes[0].plot(minutes, rss / 1024, label='Whole process group working-set sum', color='#52694f', linewidth=1)
axes[0].plot(minutes, private / 1024, label='Whole process group private commit', color='#a48d56', linewidth=1)
axes[0].set_ylabel('GiB')
axes[0].legend(loc='upper left')
axes[1].plot(minutes, cpu, color='#52694f', linewidth=.6)
axes[1].set_ylabel(f"CPU % / {processes[0]['logicalCpus']} logical CPUs")
axes[2].plot([p['elapsedSeconds'] / 60 for p in ui], [p['backlogSeconds'] for p in ui], color='#52694f', linewidth=.8)
axes[2].set_ylabel('Speech backlog (s)')
axes[2].set_xlabel('Real elapsed minutes')
for ax in axes:
    ax.grid(alpha=.2)
    for minute in range(15, 90, 15):
        ax.axvspan(minute, minute + 1, color='#a48d56', alpha=.1)
fig.suptitle('Installed LectureRelay 0.2.0 — real 90-minute desktop run\nCPU local speech; cloud translation disabled; shaded periods include screenshot activity')
fig.savefig(root / 'soak-resources.png', dpi=160)
plt.close(fig)
print(json.dumps(summary, indent=2))
