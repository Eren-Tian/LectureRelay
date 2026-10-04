"""External post-stop observations, without WebDriver, GC or process restarts."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import time

root = Path(os.environ.get('LECTURERELAY_ACCEPTANCE_ROOT', 'target/acceptance-v0.3.1'))
soak = json.loads((root/'independent-result.json').read_text(encoding='utf-8'))
assert soak['seconds'] >= 5400
exe = Path(os.environ['LOCALAPPDATA'])/'Programs/LectureRelay/lecturerelay-desktop.exe'
db = sqlite3.connect((Path(os.environ['LOCALAPPDATA'])/'LectureRelay/app.db').as_uri()+'?mode=ro', uri=True)
deadline = time.monotonic()+120
while db.execute('SELECT status FROM lectures WHERE id=?', (soak['lectureId'],)).fetchone()[0] == 'recording':
    assert time.monotonic() < deadline, 'Stop & save was not clicked'
    time.sleep(0.1)
start = time.monotonic()
samples = []
for at in [0, 5, 30, 60]:
    while time.monotonic()-start < at:
        time.sleep(0.1)
    process = subprocess.run([sys.executable, '-X', 'utf8', 'tests/e2e/app-process-snapshot.py', '--exe', str(exe)], capture_output=True, text=True, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
    sample = json.loads(process.stdout)
    sample['secondsAfterSavedStatus'] = time.monotonic()-start
    sample['segments'], sample['translations'] = db.execute("SELECT COUNT(*),COALESCE(SUM(translated_text!=''),0) FROM transcript_segments WHERE lecture_id=?", (soak['lectureId'],)).fetchone()
    samples.append(sample)
    (root/'independent-post-stop.json').write_text(json.dumps({'scope': 'External counters after ordinary native Stop & save. No forced GC, app reset, process restart or WebDriver.', 'samples': samples}, indent=2), encoding='utf-8')
    print(json.dumps({k:v for k,v in sample.items() if k!='processes'}), flush=True)
db.close()
assert not any(p['name'] in ['asr-worker.exe', 'llama-server.exe'] for p in samples[-1]['processes']), 'Inference processes still present after 60 seconds'
assert samples[-1]['segments'] == samples[-1]['translations']
(root/'independent-post-stop.json').write_text(json.dumps({'passed': True, 'scope': 'External counters after ordinary native Stop & save. No forced GC, app reset, process restart or WebDriver.', 'samples': samples}, indent=2), encoding='utf-8')
