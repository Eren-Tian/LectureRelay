"""Compact read-only progress while the installed-app soak runs."""
import json
import statistics
import os
import sqlite3
from pathlib import Path
from collections import deque

root = Path('target/acceptance-v0.3-2026-10-03')
progress = json.loads((root / 'soak-progress.json').read_text())
with (root / 'soak-processes.jsonl').open() as f:
    lines = deque(f, maxlen=31)
samples = []
for line in lines:
    try:
        samples.append(json.loads(line))
    except json.JSONDecodeError:
        pass  # Writer may still be appending its last line.
samples = samples[-30:]
latest = samples[-1]
database = Path(os.environ['LOCALAPPDATA']) / 'LectureRelay' / 'app.db'
with sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True) as db:
    saved = db.execute("""SELECT COUNT(s.id),SUM(s.translated_text != '')
        FROM transcript_segments s WHERE s.lecture_id = (
          SELECT l.id FROM lectures l JOIN courses c ON c.id=l.course_id
          WHERE c.name='[ACCEPTANCE 2026-10-03] Local AI classroom'
          AND l.title LIKE '[ACCEPTANCE] v0.3 local AI soak %'
          ORDER BY l.started_at DESC LIMIT 1)""").fetchone()
print(json.dumps({
    'utc': progress['utc'], 'minutes': round(progress['elapsedSeconds'] / 60, 1),
    'recentTranslated': progress['translatedRecent'],
    'totalSavedSegments': saved[0], 'totalSavedTranslations': saved[1],
    'queue': progress['translationQueue'], 'deferred': progress['deferred'],
    'backlogSeconds': round(progress['backlogSeconds'], 2),
    'discontinuities': progress['droppedChunks'],
    'cpuLastMinuteMeanPercent': round(statistics.mean(s['cpuPercentNormalized'] for s in samples), 2),
    'rssMiB': round(latest['rssBytesSum'] / 1048576),
    'privateMiB': round(latest['privateBytesSum'] / 1048576),
    'webViewRssMiB': round(sum(p['rssBytes'] for p in latest['processes'] if p['name'] == 'msedgewebview2.exe') / 1048576),
    'controllerFinished': (root / 'soak-result.json').exists(),
}))
