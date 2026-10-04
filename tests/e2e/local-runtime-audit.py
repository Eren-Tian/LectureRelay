"""Read only the selected installed app's workers; never read command lines or keys."""
import argparse
import json
from pathlib import Path
import urllib.request
import urllib.error
import psutil

parser = argparse.ArgumentParser()
parser.add_argument('--exe', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--performance', choices=['quiet', 'full'], default='quiet')
args = parser.parse_args()
roots = [p for p in psutil.process_iter(['exe'])
         if p.info['exe'] and Path(p.info['exe']).resolve() == args.exe.resolve()]
assert len(roots) == 1
root = roots[0]
workers = [p for p in root.children(recursive=True)
           if p.name() in ('asr-worker.exe', 'llama-server.exe')]
assert len(workers) == 2, 'Run while local speech and translation are both loaded'
affinities = [p.cpu_affinity() for p in workers]
assert affinities[0] == affinities[1]
if args.performance == 'quiet':
    assert len(affinities[0]) <= 4
else:
    assert affinities[0] == root.cpu_affinity()
text_worker = next(p for p in workers if p.name() == 'llama-server.exe')
listeners = [c.laddr for c in text_worker.net_connections(kind='inet') if c.status == psutil.CONN_LISTEN]
assert listeners and all(a.ip in ('127.0.0.1', '::1') for a in listeners)
address = next(a for a in listeners if a.ip == '127.0.0.1')
# Synthetic unauthenticated metadata read; does not generate text or expose a secret.
try:
    urllib.request.build_opener(urllib.request.ProxyHandler({})).open(
        f'http://127.0.0.1:{address.port}/v1/models', timeout=3)
    status = 200
except urllib.error.HTTPError as error:
    status = error.code
assert status == 401
result = {'passed': True, 'appPid': root.pid,
          'performance': args.performance,
          'workers': [{'pid': p.pid, 'name': p.name(), 'cpuAffinity': p.cpu_affinity()} for p in workers],
          'listenerAddresses': [dict(ip=a.ip, port=a.port) for a in listeners],
          'unauthenticatedStatus': status,
          'scope': 'Shared AI worker affinity, loopback listener, unauthenticated metadata rejection. No token read, paid request or independent security audit.'}
args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
