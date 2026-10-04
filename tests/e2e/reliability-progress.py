"""Reads observer output and the app's existing performance file; no IPC/UI."""
import json
import os
import time
from pathlib import Path
p=Path('target/acceptance-v0.3.1/independent-progress.json')
if p.exists():
    d=json.loads(p.read_text(encoding='utf-8'))
    status = {'minutes':round(d['elapsedSeconds']/60,2),'segments':d['savedSegments'],'translated':d['savedTranslations'],'rssMiB':round(d['rssBytesSum']/1048576,1),'privateMiB':round(d['privateBytesSum']/1048576,1),'cpuPercent':round(d['cpuPercentNormalized'],2),'processNames':sorted(set(p['name'] for p in d['processes']))}
    # The UUID is this run's explicitly labelled lecture. No unrelated log reads.
    log = Path(os.environ['LOCALAPPDATA'])/'LectureRelay/logs/903a0347-947f-4bfa-9fb3-e7458cc52e80-performance.json'
    if log.exists():
        health = json.loads(log.read_text(encoding='utf-8'))
        status.update({k:health[k] for k in ['droppedChunks','speechBacklogSeconds','translationQueue']})
        with (p.parent/'independent-sparse-health.jsonl').open('a',encoding='utf-8') as out:
            out.write(json.dumps({'utcSeconds':time.time(),'logModifiedSeconds':log.stat().st_mtime,**status})+'\n')
    print(json.dumps(status))
else: print('Observer waiting for first saved sample')
