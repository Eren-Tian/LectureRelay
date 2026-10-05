"""Pinned native worker throughput comparison; synthetic audio, no microphone or cloud.
This measures compute throughput and finalization span, not installed audio-to-screen latency.
"""
import argparse
import array
import ctypes
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import threading
import time
import wave
import psutil

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--worker', type=Path, required=True)
parser.add_argument('--label', required=True)
parser.add_argument('--cpu-mode', choices=['siblings', 'cores'], default='cores')
parser.add_argument('--seconds', type=int, default=180)
args = parser.parse_args()
runtime = root / 'apps/desktop/src-tauri/resources/local-asr'
model = root / 'target/asr-evaluation/models/nemotron-speech-streaming-en-0.6b.q8_0.gguf'

class Info(ctypes.Structure):
    _fields_ = [('mask', ctypes.c_size_t), ('relationship', ctypes.c_int), ('reserved', ctypes.c_ulonglong * 2)]

available = psutil.Process().cpu_affinity()
cores = []
size = ctypes.c_ulong()
ctypes.windll.kernel32.GetLogicalProcessorInformation(None, ctypes.byref(size))
buffer = ctypes.create_string_buffer(size.value)
assert ctypes.windll.kernel32.GetLogicalProcessorInformation(buffer, ctypes.byref(size))
for offset in range(0, size.value, ctypes.sizeof(Info)):
    info = Info.from_buffer_copy(buffer, offset)
    if info.relationship == 0:
        allowed = [i for i in available if info.mask & (1 << i)]
        if allowed: cores.append(allowed[0])
cpus = (available if args.cpu_mode == 'siblings' else cores)[:4]
with wave.open(str(root / 'target/asr-evaluation/benchmark-data/lecture.wav'), 'rb') as wav:
    assert wav.getframerate() == 16000 and wav.getnchannels() == 1
    source = array.array('h', wav.readframes(wav.getnframes()))
samples = (source * (args.seconds * 16000 // len(source) + 1))[:args.seconds * 16000]
worker = subprocess.Popen([str(args.worker.resolve()), str(runtime), str(model)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=0x08000000)
process = psutil.Process(worker.pid)
process.cpu_affinity(cpus)
watchdog = threading.Timer(300, worker.kill)
watchdog.start()
def receive():
    head = worker.stdout.read(8)
    assert len(head) == 8, 'worker stopped or watchdog expired'
    code, size = struct.unpack('<iI', head)
    assert size < 20001
    value = worker.stdout.read(size).decode('utf-8')
    assert code == 0, f'worker returned {code}'
    return value

try:
    started = time.perf_counter()
    receive()
    load = time.perf_counter() - started
    began = time.perf_counter()
    rows = []
    final_end = 0
    for offset in range(0, len(samples), 32000):
        pcm = array.array('f', (v / 32768 for v in samples[offset:offset+32000]))
        at = time.perf_counter()
        worker.stdin.write(struct.pack('<I', (1 << 30) | len(pcm)) + pcm.tobytes())
        worker.stdin.flush()
        update = json.loads(receive())
        end = (offset + len(pcm)) / 16000
        span = end - final_end
        if update['final']: final_end = end
        rows.append({'audioEndSeconds': end, 'computeSeconds': time.perf_counter()-at, 'final': update['final'], 'finalSpanSeconds': span if update['final'] else None, 'text': update['text']})
    result = {'scope': 'Actual worker, synthetic repeated source, accelerated compute; not microphone or UI latency', 'workerSha256': hashlib.sha256(args.worker.read_bytes()).hexdigest(), 'cpus': cpus, 'loadSeconds': load, 'audioSeconds': args.seconds, 'computeSeconds': time.perf_counter()-began, 'rows': rows}
    result['realTimeFactor'] = result['computeSeconds'] / args.seconds
    output = root / 'target/classroom-fixes' / f'{args.label}.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'rows'}), flush=True)
finally:
    watchdog.cancel()
    worker.kill()
    worker.wait(10)
