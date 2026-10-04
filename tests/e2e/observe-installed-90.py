"""90 real minutes: plain installed app, Windows loopback, external counters only.
Launch BEFORE starting the labelled recording. No WebDriver, CDP, JS or app IPC.
"""
import argparse
import json
import os
from pathlib import Path
import sqlite3
import statistics
import struct
import time
import winsound
import psutil

parser = argparse.ArgumentParser()
parser.add_argument('--title', required=True)
parser.add_argument('--seconds', type=int, default=5400)
args = parser.parse_args()
assert args.title.startswith('[ACCEPTANCE] v0.3.1')
assert args.seconds >= 5400, 'This acceptance is a real 90-minute run'
root = Path('target/acceptance-v0.3.1')
exe = (Path(os.environ['LOCALAPPDATA'])/'Programs/LectureRelay/lecturerelay-desktop.exe').resolve()
apps = [p for p in psutil.process_iter(['exe']) if p.info['exe'] and Path(p.info['exe']).resolve() == exe]
assert len(apps) == 1
app = apps[0]
assert not any(p.name().lower() in ['msedgedriver.exe', 'tauri-driver.exe'] for p in psutil.process_iter()), 'Stop test drivers before this independent memory run'
db_path = Path(os.environ['LOCALAPPDATA'])/'LectureRelay/app.db'
db = sqlite3.connect(db_path.resolve().as_uri()+'?mode=ro', uri=True)
db.execute('PRAGMA query_only=ON')
deadline = time.monotonic()+600
while True:
    rows = db.execute("SELECT l.id,l.recording_path FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.title=? AND c.name=? AND l.status='recording'", (args.title, '[ACCEPTANCE 2026-10-03] Local AI classroom')).fetchall()
    assert len(rows) <= 1
    if rows:
        lecture_id, recording_path = rows[0]
        try:
            with open(recording_path, 'rb') as f:
                head = f.read(44)
            if len(head) == 44 and struct.unpack('<I', head[40:44])[0] > 0:
                break
        except FileNotFoundError:
            pass
    assert time.monotonic() < deadline, 'Recording was not started within ten minutes'
    time.sleep(0.1)
print(json.dumps({'started': True, 'lectureId': lecture_id, 'recording': recording_path}), flush=True)
start = time.monotonic()
previous_time = start
previous = {}
samples = []
logical = psutil.cpu_count()
source = Path('target/installed-acceptance/soak.wav').resolve()
def snapshot():
    now = time.monotonic()
    processes, cpu_seconds = [], 0
    for process in [app]+app.children(recursive=True):
        try:
            cpu = process.cpu_times()
            total = cpu.user+cpu.system
            key = (process.pid, process.create_time())
            cpu_seconds += max(0,total-previous.get(key,total))
            previous[key] = total
            memory = process.memory_info()
            processes.append({'pid':process.pid,'createdAt':process.create_time(),'name':process.name(),'rssBytes':memory.rss,'privateBytes':memory.private})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    count = db.execute("SELECT COUNT(*),COALESCE(SUM(translated_text!=''),0) FROM transcript_segments WHERE lecture_id=?", (lecture_id,)).fetchone()
    return {'utcSeconds':time.time(),'elapsedSeconds':now-start,'logicalCpus':logical,'cpuPercentNormalized':cpu_seconds/max(now-previous_time,0.001)/logical*100,'rssBytesSum':sum(p['rssBytes'] for p in processes),'privateBytesSum':sum(p['privateBytes'] for p in processes),'savedSegments':count[0],'savedTranslations':count[1],'processes':processes}
with (root/'independent-processes.jsonl').open('x', encoding='utf-8', buffering=1) as output:
    winsound.PlaySound(str(source), winsound.SND_FILENAME|winsound.SND_ASYNC)
    try:
        while time.monotonic()-start < args.seconds:
            sample = snapshot()
            output.write(json.dumps(sample)+'\n')
            samples.append(sample)
            previous_time = time.monotonic()
            if len(samples) % 15 == 0:
                (root/'independent-progress.json').write_text(json.dumps(sample,indent=2),encoding='utf-8')
            assert db.execute('SELECT status FROM lectures WHERE id=?',(lecture_id,)).fetchone()[0]=='recording', 'Recording ended early'
            time.sleep(2)
    finally:
        winsound.PlaySound(None,0)
        db.close()

def window(low,high):
    selected = [s for s in samples if low<=s['elapsedSeconds']<high]
    names = sorted({p['name'] for s in selected for p in s['processes']})
    return {'samples':len(selected),'rssMedianMiB':statistics.median(s['rssBytesSum'] for s in selected)/1048576,'privateMedianMiB':statistics.median(s['privateBytesSum'] for s in selected)/1048576,'byProcessName':{name:{'rssMedianMiB':statistics.median(sum(p['rssBytes'] for p in s['processes'] if p['name']==name) for s in selected)/1048576,'privateMedianMiB':statistics.median(sum(p['privateBytes'] for p in s['processes'] if p['name']==name) for s in selected)/1048576} for name in names}}
result = {'scope':'Installed EXE launched without WebDriver. Real-time Windows playback and loopback, local ASR and translation; external process counters and read-only SQLite. No injected JS/native IPC, forced GC, app reset or worker restart. Working-set sums may count shared pages multiple times.', 'lectureId':lecture_id,'recording':recording_path,'source':str(source),'seconds':time.monotonic()-start,'samples':len(samples),'warmup0to2Minutes':window(0,120),'early5to15Minutes':window(300,900),'middle40to50Minutes':window(2400,3000),'late80to90Minutes':window(4800,5400),'cpuMeanPercent':statistics.mean(s['cpuPercentNormalized'] for s in samples[1:]),'rssPeakMiB':max(s['rssBytesSum'] for s in samples)/1048576,'privatePeakMiB':max(s['privateBytesSum'] for s in samples)/1048576,'finalSavedSegments':samples[-1]['savedSegments'],'finalSavedTranslations':samples[-1]['savedTranslations']}
(root/'independent-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result),flush=True)
