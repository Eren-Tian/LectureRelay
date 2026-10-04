"""Snapshot and compare original content; never restore, delete, or modify the library."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('phase', choices=['before', 'after'])
parser.add_argument('--root', type=Path, default=Path('target/engineering-audit'))
args = parser.parse_args()
root = args.root
original = json.loads((root / 'installed-original.json').read_text(encoding='utf-8'))
db = Path(original['storage']['database'])
current = sqlite3.connect(db.resolve().as_uri() + '?mode=ro', uri=True)
backup = root / 'installed-before.db'
manifest = root / 'installed-files.json'
if args.phase == 'before':
    if backup.exists() or manifest.exists():
        raise RuntimeError('Preserve the existing baseline; do not overwrite it.')
    with sqlite3.connect(backup) as destination:
        current.backup(destination)
    files = []
    for folder in [Path(original['storage']['library']) / 'Courses', db.parent / 'models']:
        for file in folder.rglob('*'):
            if file.is_file() and file.suffix.lower() in ['.wav', '.gguf', '.bin']:
                with file.open('rb') as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                files.append({'path': str(file), 'sha256': digest})
    manifest.write_text(json.dumps(files, indent=2), encoding='utf-8')
    print(json.dumps({'baselineSaved': True, 'files': len(files)}))
else:
    before = sqlite3.connect(backup.resolve().as_uri() + '?mode=ro', uri=True)
    tables = []
    for (table,) in before.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
        assert table.replace('_', '').isalnum()
        old = Counter(before.execute(f'SELECT * FROM "{table}"'))
        new = Counter(current.execute(f'SELECT * FROM "{table}"'))
        tables.append({'table': table, 'originalRows': sum(old.values()), 'missingOrChangedRows': sum((old-new).values())})
    changed = 0
    entries = json.loads(manifest.read_text(encoding='utf-8'))
    for entry in entries:
        file = Path(entry['path'])
        if not file.is_file():
            changed += 1
        else:
            with file.open('rb') as stream:
                changed += hashlib.file_digest(stream, 'sha256').hexdigest() != entry['sha256']
    integrity = current.execute('PRAGMA quick_check').fetchone()[0]
    foreign = len(list(current.execute('PRAGMA foreign_key_check')))
    result = {'passed': all(t['missingOrChangedRows'] == 0 for t in tables) and changed == 0 and integrity == 'ok' and foreign == 0,
              'tables': tables, 'originalFilesHashed': len(entries), 'changedFiles': changed, 'sqliteQuickCheck': integrity, 'foreignKeyErrors': foreign,
              'scope': 'All original SQLite rows including preferences; original WAV, GGUF and BIN file hashes. New labelled test content is retained.'}
    (root / 'preservation.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
    raise SystemExit(0 if result['passed'] else 1)
