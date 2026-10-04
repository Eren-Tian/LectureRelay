"""Ten-minute external observation: no WebDriver, CDP or application IPC.

Start the installed app and the labelled recording through native UI first.
This plays only the known synthetic WAV and reads process counters/SQLite.
Stop and save through native UI after this observer finishes.
"""
import json
import os
from pathlib import Path
import sqlite3
import statistics
import time
import winsound
import psutil

root = Path('target/acceptance-v0.3-2026-10-03')
exe = (root / 'app/lecturerelay-desktop.exe').resolve()
title = '[ACCEPTANCE] Standalone memory 10 minutes'
roots = [p for p in psutil.process_iter(['exe']) if p.info['exe'] and Path(p.info['exe']).resolve() == exe]
assert len(roots) == 1
app = roots[0]
db_path = Path(os.environ['LOCALAPPDATA']) / 'LectureRelay/app.db'
db = sqlite3.connect(db_path.resolve().as_uri() + '?mode=ro', uri=True)
rows = db.execute("SELECT l.id FROM lectures l JOIN courses c ON l.course_id=c.id WHERE l.title=? AND c.name=? AND l.status='recording'", (title, '[ACCEPTANCE 2026-10-03] Local AI classroom')).fetchall()
assert len(rows) == 1, rows
lecture_id = rows[0][0]
start = time.monotonic()
previous_time = start
previous = {}
samples = []
logical = psutil.cpu_count()
with (root / 'standalone-processes.jsonl').open('w', encoding='utf-8', buffering=1) as output:
    winsound.PlaySound(str(Path('target/installed-acceptance/soak.wav').resolve()), winsound.SND_FILENAME | winsound.SND_ASYNC)
    try:
        while time.monotonic() - start < 600:
            now = time.monotonic()
            processes = []
            cpu_seconds = 0
            for p in [app] + app.children(recursive=True):
                try:
                    cpu = p.cpu_times()
                    total = cpu.user + cpu.system
                    key = (p.pid, p.create_time())
                    cpu_seconds += max(0, total - previous.get(key, total))
                    previous[key] = total
                    m = p.memory_info()
                    processes.append({'pid': p.pid, 'name': p.name(), 'rssBytes': m.rss, 'privateBytes': m.private})
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            text = db.execute("SELECT COUNT(*),COALESCE(SUM(translated_text!=''),0) FROM transcript_segments WHERE lecture_id=?", (lecture_id,)).fetchone()
            sample = {'utcSeconds': time.time(), 'elapsedSeconds': now-start, 'logicalCpus': logical, 'cpuPercentNormalized': cpu_seconds / max(now-previous_time, 0.001) / logical * 100, 'rssBytesSum': sum(p['rssBytes'] for p in processes), 'privateBytesSum': sum(p['privateBytes'] for p in processes), 'webViewRssBytes': sum(p['rssBytes'] for p in processes if p['name']=='msedgewebview2.exe'), 'savedSegments': text[0], 'savedTranslations': text[1], 'processes': processes}
            output.write(json.dumps(sample) + '\n')
            samples.append(sample)
            previous_time = now
            time.sleep(2)
    finally:
        winsound.PlaySound(None, 0)
        db.close()

def window(low, high):
    selected = [s for s in samples if low <= s['elapsedSeconds'] < high]
    return {'samples': len(selected), 'rssMedianMiB': statistics.median(s['rssBytesSum'] for s in selected)/1048576, 'webViewMedianMiB': statistics.median(s['webViewRssBytes'] for s in selected)/1048576}

result = {'scope': 'Independent installed EXE, native UI control; external process counters and read-only SQLite only. No WebDriver/CDP/injected JS/native IPC. Ten minutes does not establish 90-minute memory stability.', 'lectureId': lecture_id, 'seconds': time.monotonic()-start, 'samples': len(samples), 'earlyMinute1to3': window(60,180), 'lateMinute8to10': window(480,600), 'cpuMeanPercent': statistics.mean(s['cpuPercentNormalized'] for s in samples[1:]), 'rssPeakMiB': max(s['rssBytesSum'] for s in samples)/1048576, 'finalSavedSegments': samples[-1]['savedSegments'], 'finalSavedTranslations': samples[-1]['savedTranslations']}
(root / 'standalone-result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
