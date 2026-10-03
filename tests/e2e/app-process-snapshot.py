"""One resource snapshot of the exact test application, without reading secrets."""
import argparse
import json
from pathlib import Path
import time
import psutil

parser = argparse.ArgumentParser()
parser.add_argument('--exe', type=Path, required=True)
args = parser.parse_args()
roots = [p for p in psutil.process_iter(['exe']) if p.info['exe'] and Path(p.info['exe']).resolve() == args.exe.resolve()]
assert len(roots) == 1
rows = []
for p in [roots[0]] + roots[0].children(recursive=True):
    try:
        m = p.memory_info()
        rows.append({'pid': p.pid, 'name': p.name(), 'rssMiB': m.rss / 1048576, 'privateMiB': m.private / 1048576, 'affinity': p.cpu_affinity()})
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        continue
print(json.dumps({'utcSeconds': time.time(), 'rssMiB': sum(r['rssMiB'] for r in rows), 'privateMiB': sum(r['privateMiB'] for r in rows), 'processes': rows}))
