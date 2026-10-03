"""Sample the installed app's full descendant process tree, excluding test drivers."""
import argparse
import json
import time
from pathlib import Path
import psutil

parser = argparse.ArgumentParser()
parser.add_argument('--exe', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
roots = [p for p in psutil.process_iter(['exe']) if p.info['exe'] and Path(p.info['exe']).resolve() == args.exe.resolve()]
assert len(roots) == 1
root = roots[0]
logical = psutil.cpu_count()
previous = {}
previous_time = time.monotonic()
args.output.parent.mkdir(parents=True, exist_ok=True)
with args.output.open('w', encoding='utf-8', buffering=1) as output:
    while root.is_running():
        now = time.monotonic()
        elapsed = now - previous_time
        processes = []
        cpu_seconds = 0
        for process in [root] + root.children(recursive=True):
            try:
                cpu = process.cpu_times()
                total = cpu.user + cpu.system
                key = (process.pid, process.create_time())
                cpu_seconds += max(0, total - previous.get(key, total))
                previous[key] = total
                memory = process.memory_info()
                processes.append({'pid': process.pid, 'name': process.name(), 'rssBytes': memory.rss, 'privateBytes': memory.private})
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        output.write(json.dumps({'utcSeconds': time.time(), 'appPid': root.pid, 'logicalCpus': logical,
                                 'cpuPercentNormalized': cpu_seconds / max(elapsed, 0.001) / logical * 100,
                                 'rssBytesSum': sum(p['rssBytes'] for p in processes),
                                 'privateBytesSum': sum(p['privateBytes'] for p in processes),
                                 'processes': processes}) + '\n')
        previous_time = now
        time.sleep(2)
