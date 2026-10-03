"""Compare original library rows read-only, allowing new tables/columns and test data."""
import argparse
from collections import Counter
import json
from pathlib import Path
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('--before', type=Path, required=True)
parser.add_argument('--current', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
before = sqlite3.connect(args.before.resolve().as_uri() + '?mode=ro', uri=True)
current = sqlite3.connect(args.current.resolve().as_uri() + '?mode=ro', uri=True)
tables = [r[0] for r in before.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
results = []
for table in tables:
    if table in ('app_settings', 'local_models'):
        continue  # Preferences and model installation are explicitly exercised.
    assert table.replace('_', '').isalnum()
    columns = [r[1] for r in before.execute(f'PRAGMA table_info("{table}")')]
    assert all(c.replace('_', '').isalnum() for c in columns)
    selection = ','.join(f'"{c}"' for c in columns)
    original_rows = Counter(before.execute(f'SELECT {selection} FROM "{table}"'))
    actual_rows = Counter(current.execute(f'SELECT {selection} FROM "{table}"'))
    missing = sum((original_rows - actual_rows).values())
    results.append({'table': table, 'originalRows': sum(original_rows.values()), 'missingOrChangedOriginalRows': missing})
integrity = current.execute('PRAGMA quick_check').fetchone()[0]
result = {'passed': all(r['missingOrChangedOriginalRows'] == 0 for r in results) and integrity == 'ok', 'tables': results, 'sqliteQuickCheck': integrity, 'scope': 'Read-only comparison of every original content row on its original columns. New acceptance rows and schema additions allowed. Settings/model installations checked separately. No restoration or deletion.'}
args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
before.close()
current.close()
raise SystemExit(0 if result['passed'] else 1)
