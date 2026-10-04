"""Fault injection restricted to an explicitly labelled acceptance lecture and app."""
import argparse
import json
import shutil
import sqlite3
import uuid
from pathlib import Path
import psutil

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['workers', 'worker', 'text-worker', 'crash', 'checkpoint-on', 'checkpoint-off'])
parser.add_argument('--exe', type=Path, required=True)
parser.add_argument('--state', type=Path, required=True)
parser.add_argument('--lecture', required=True)
parser.add_argument('--course', help='Optional exact labelled course for stricter isolation')
parser.add_argument('--backups', type=Path, default=Path('target/installed-acceptance/fault-backups'))
args = parser.parse_args()
uuid.UUID(args.lecture)
database = sqlite3.connect((args.state / 'app.db').resolve().as_uri() + '?mode=ro', uri=True)
row = database.execute('SELECT l.title,c.name FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=?', (args.lecture,)).fetchone()
assert row and row[0].startswith('[ACCEPTANCE]'), 'Refusing fault injection on non-test data'
if args.course:
    assert args.course.startswith('[ACCEPTANCE ') and row[1] == args.course
database.close()
roots = [p for p in psutil.process_iter(['exe']) if p.info['exe'] and Path(p.info['exe']).resolve() == args.exe.resolve()]
assert len(roots) == 1, 'Require exactly one matching installed test app'
root = roots[0]
if args.action == 'workers':
    workers = [p for p in root.children(recursive=True)
               if p.name() in ('asr-worker.exe', 'llama-server.exe')
               and args.exe.resolve().parent in Path(p.exe()).parents]
    print(json.dumps({'workers': [{'name': p.name(), 'pid': p.pid} for p in workers]}))
elif args.action in ('worker', 'text-worker'):
    name, folder = ('asr-worker.exe', 'local-asr') if args.action == 'worker' else ('llama-server.exe', 'local-text')
    workers = [p for p in root.children(recursive=True) if p.name() == name and Path(p.exe()).parent == args.exe.resolve().parent / folder]
    assert len(workers) == 1
    workers[0].kill()
    print(json.dumps({'action': args.action, 'pid': workers[0].pid}))
elif args.action == 'crash':
    children = [{'pid': p.pid, 'name': p.name(), 'created': p.create_time()}
                for p in root.children(recursive=True)]
    root.kill()
    root.wait(timeout=10)
    print(json.dumps({'action': args.action, 'pid': root.pid, 'children': children}))
else:
    marker = args.state.resolve() / 'recovery' / f'{args.lecture}.json'
    assert marker.parent == args.state.resolve() / 'recovery'
    backup = args.backups / marker.name
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
