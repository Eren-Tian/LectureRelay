"""Summarize the completed external run; do not infer absence of all leaks."""
import json
import statistics
from pathlib import Path

root = Path('target/acceptance-v0.3.1')
result = json.loads((root/'independent-result.json').read_text(encoding='utf-8'))
assert result['seconds'] >= 5400
rows = [json.loads(line) for line in (root/'independent-processes.jsonl').read_text(encoding='utf-8').splitlines()]
names = sorted({p['name'] for row in rows for p in row['processes']})
assert not any('driver' in name.lower() for name in names)

def memory(row, key, name):
    return sum(p[key] for p in row['processes'] if name is None or p['name'] == name)/1048576

def summary(selected, name=None):
    times = [r['elapsedSeconds']/60 for r in selected]
    return {key: {'medianMiB': statistics.median(memory(r, field, name) for r in selected),
                  'linearSlopeMiBPerMinute': statistics.linear_regression(times, [memory(r, field, name) for r in selected]).slope}
            for key, field in [('workingSet','rssBytes'),('privateCommitted','privateBytes')]}

windows = {}
for label, low, high in [('early5to15',5,15),('middle40to50',40,50),('late80to90',80,90),('last30',60,90)]:
    selected = [r for r in rows if low <= r['elapsedSeconds']/60 < high]
    windows[label] = {'wholeGroup': summary(selected), 'byProcessName': {name:summary(selected,name) for name in names}}

cpu = sorted(r['cpuPercentNormalized'] for r in rows[1:])
health = [json.loads(line) for line in (root/'independent-sparse-health.jsonl').read_text(encoding='utf-8').splitlines()]
workers = {name: sorted({p['pid'] for r in rows for p in r['processes'] if p['name']==name}) for name in ['asr-worker.exe','llama-server.exe']}
analysis = {'scope': 'Actual independent 90-minute run. Linear slopes describe this observation only. Sparse native log readings began around minute 31; they are not continuous queue or discontinuity telemetry.',
            'windows':windows, 'cpuMeanPercentOfMachine':statistics.mean(cpu), 'cpuP95PercentOfMachine':cpu[int(len(cpu)*.95)],
            'maxSavedEnglishRowsNotYetTranslated':max(r['savedSegments']-r['savedTranslations'] for r in rows),
            'workerPids':workers, 'sparseHealthFirst':health[0], 'sparseHealthLast':health[-1],
            'sparseHealthMaxDroppedOrDiscontinuous':max(h['droppedChunks'] for h in health),
            'sparseHealthMaxSpeechBacklogSeconds':max(h['speechBacklogSeconds'] for h in health),
            'sparseHealthMaxTranslationQueue':max(h['translationQueue'] for h in health)}
(root/'independent-analysis.json').write_text(json.dumps(analysis,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in analysis.items() if k!='windows'},indent=2))
