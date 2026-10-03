"""Fault injection restricted to an explicitly labelled acceptance lecture and app."""
import argparse
import json
import shutil
import sqlite3
import uuid
from pathlib import Path
import psutil

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['worker', 'crash', 'checkpoint-on', 'checkpoint-off'])
parser.add_argument('--exe', type=Path, required=True)
parser.add_argument('--state', type=Path, required=True)
parser.add_argument('--lecture', required=True)
args = parser.parse_args()
uuid.UUID(args.lecture)
database = sqlite3.connect((args.state / 'app.db').resolve().as_uri() + '?mode=ro', uri=True)
row = database.execute('SELECT title FROM lectures WHERE id=?', (args.lecture,)).fetchone()
assert row and row[0].startswith('[ACCEPTANCE]'), 'Refusing fault injection on non-test data'
database.close()
roots = [p for p in psutil.process_iter(['exe']) if p.info['exe'] and Path(p.info['exe']).resolve() == args.exe.resolve()]
assert len(roots) == 1, 'Require exactly one matching installed test app'
root = roots[0]
if args.action == 'worker':
    workers = [p for p in root.children(recursive=True) if p.name() == 'asr-worker.exe' and Path(p.exe()).parent == args.exe.resolve().parent / 'local-asr']
    assert len(workers) == 1
    workers[0].kill()
    print(json.dumps({'action': args.action, 'pid': workers[0].pid}))
elif args.action == 'crash':
    root.kill()
    root.wait(timeout=10)
    print(json.dumps({'action': args.action, 'pid': root.pid}))
else:
    marker = args.state.resolve() / 'recovery' / f'{args.lecture}.json'
    assert marker.parent == args.state.resolve() / 'recovery'
    backup = Path('target/installed-acceptance/fault-backups') / marker.name
    backup.parent.mkdir(parents=True, exist_ok=True)
    if args.action == 'checkpoint-on':
        assert marker.is_file() and not marker.is_symlink()
        shutil.copy2(marker, backup)
        marker.unlink()
        marker.mkdir()  # Only this test lecture's atomic checkpoint replace now fails.
    else:
        assert marker.is_dir() and not marker.is_symlink()
        marker.rmdir()  # Empty test-only directory; never recursive.
        shutil.copy2(backup, marker)
    print(json.dumps({'action': args.action, 'lecture': args.lecture}))
