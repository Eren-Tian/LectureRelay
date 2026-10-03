"""Read-only v3 -> v4 comparison, with narrowly enumerated metadata repairs."""
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sqlite3

root = Path('target/acceptance-v0.3.1')
before = sqlite3.connect((root/'pre-migration/app.db').resolve().as_uri()+'?mode=ro',uri=True)
current = sqlite3.connect((Path(os.environ['LOCALAPPDATA'])/'LectureRelay/app.db').as_uri()+'?mode=ro',uri=True)
restored_course = '145fc0f2-1f98-429f-b94f-73d4d32859c9'
import_ids = {r[0] for r in before.execute("SELECT lecture_id FROM processing_tasks WHERE kind='import'")}
results = []
for (table,) in before.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
    if table == 'app_settings':
        continue  # Quiet Mode was intentionally exercised. No credential-store inspection.
    assert table.replace('_','').isalnum()
    columns = [r[1] for r in before.execute(f'PRAGMA table_info("{table}")')]
    selection = ','.join(f'"{c}"' for c in columns)
    def normalized(row):
        value = dict(zip(columns,row))
        if table == 'transcript_segments' and value.get('origin') == 'cloud' and value.get('provider') == 'local':
            value['origin'] = 'local'
        if table == 'lectures' and value['id'] in import_ids:
            value['audio_source'] = 'import'
        if table == 'courses' and value['id'] == restored_course:
            value['deleted_at'] = None  # This existing labelled test course was restored for review.
        return tuple(value[c] for c in columns)
    originals = Counter(normalized(r) for r in before.execute(f'SELECT {selection} FROM "{table}"'))
    actual = Counter(current.execute(f'SELECT {selection} FROM "{table}"'))
    results.append({'table':table,'originalRows':sum(originals.values()),'unexpectedMissingOrChangedRows':sum((originals-actual).values())})
files = []
for entry in json.loads((root/'pre-migration/manifest.json').read_text(encoding='utf-8')):
    path = Path(entry['path'])
    digest = hashlib.file_digest(path.open('rb'),'sha256').hexdigest() if path.is_file() else None
    files.append({'name':path.name,'unchanged':digest==entry['sha256'],'isRecordingOrModel':path.suffix.lower() in ['.wav','.gguf']})
integrity = current.execute('PRAGMA quick_check').fetchone()[0]
foreign = list(current.execute('PRAGMA foreign_key_check'))
result = {'passed':all(r['unexpectedMissingOrChangedRows']==0 for r in results) and all(r['unchanged'] for r in files if r['isRecordingOrModel']) and integrity=='ok' and not foreign,
    'schemaVersion':current.execute('PRAGMA user_version').fetchone()[0], 'sqliteQuickCheck':integrity,'foreignKeyErrors':len(foreign),'tables':results,
    'filesChecked':len(files),'unchangedFiles':sum(r['unchanged'] for r in files),'changedSnapshotFiles':[r['name'] for r in files if not r['unchanged']],
    'recordingsAndModelsUnchanged':all(r['unchanged'] for r in files if r['isRecordingOrModel']),
    'allowedChanges':['Only proven cloud/local -> local/local origins','Only lectures with recorded import tasks -> import source','One existing labelled acceptance course restored from Trash for review; retained active when user paused UI','Settings exercised separately; Windows credentials never read or changed'],
    'scope':'All pre-existing content rows on original columns; new rows permitted. Original WAVs/models SHA-256 compared. Snapshot JSON may be refreshed from migrated database.'}
(root/'preservation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
raise SystemExit(0 if result['passed'] else 1)
