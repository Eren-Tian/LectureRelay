"""Actual pinned worker A/B; synthetic four-topic source plus separately labelled JFK speech.
No generated expected transcript and no inference cloud calls. CPU capped to the app's Quiet budget.
"""
import array
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import time
import wave
import psutil

root = Path(__file__).resolve().parents[2]
runtime = Path.home() / 'AppData/Local/Programs/LectureRelay/local-asr'
model = root / 'target/asr-evaluation/models/nemotron-speech-streaming-en-0.6b.q8_0.gguf'
out = root / 'target/acceptance-v0.3.1'
out.mkdir(exist_ok=True, parents=True)
block_seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
glossary = len(sys.argv) > 2 and sys.argv[2] == 'glossary'
worker = subprocess.Popen([str(runtime/'asr-worker.exe'), str(runtime), str(model)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=0x08000000)
process = psutil.Process(worker.pid)
process.cpu_affinity(process.cpu_affinity()[:4])
def receive():
    head = worker.stdout.read(8)
    assert len(head) == 8, 'worker exited'
    code, size = struct.unpack('<iI', head)
    value = worker.stdout.read(size).decode('utf-8')
    assert code == 0, (code, value)
    return value
def send(command, pcm):
    worker.stdin.write(struct.pack('<I', (command<<30)|len(pcm)) + pcm.tobytes())
    worker.stdin.flush()
    return json.loads(receive())
try:
    receive()
    terms = ["Moran's I", 'Getis-Ord Gi*', 'spatial autocorrelation', 'geographically weighted regression', 'Landsat', 'GeoAI', 'spatial heterogeneity', 'CRISPR-Cas9', 'epigenetics', 'RNA polymerase', 'transcription factor', 'CUDA', 'kernel synchronization', 'shared memory', 'occupancy']
    if glossary:
        payload = ('\0'.join(terms)+'\0').encode('utf-8')
        worker.stdin.write(struct.pack('<I', (3<<30)|len(payload))+payload)
        worker.stdin.flush()
        receive()
    results = []
    clips = ['saved-boundary'] if os.environ.get('LECTURERELAY_SAVED_BOUNDARY') == '1' else ['lecture', 'gis', 'cs', 'biology', 'jfk']
    for name in clips:
        with wave.open(str(root/'target/asr-evaluation/benchmark-data'/f'{name}.wav'), 'rb') as wav:
            assert wav.getframerate() == 16000 and wav.getnchannels() == 1
            samples = array.array('h', wav.readframes(wav.getnframes()))
        segments, partials = [], []
        chunk = int(16000*block_seconds)
        start = 0
        cpu = process.cpu_times()
        began = time.perf_counter()
        for offset in range(0, len(samples), chunk):
            pcm = array.array('f', (v/32768 for v in samples[offset:offset+chunk]))
            at = time.perf_counter()
            update = send(1, pcm)
            end = (offset+len(pcm))/16000
            row = {'audioStartSeconds': start, 'audioEndSeconds': end, 'text': update['text'], 'inferenceSeconds': time.perf_counter()-at}
            if update['final']:
                if update['text']: segments.append(row)
                start = end
            else:
                partials.append(row)
        at = time.perf_counter()
        update = send(2, array.array('f'))
        if update['text']: segments.append({'audioStartSeconds': start, 'audioEndSeconds': len(samples)/16000, 'text': update['text'], 'inferenceSeconds': time.perf_counter()-at})
        after = process.cpu_times()
        result = {'clip': name, 'sourceType': 'natural public speech excerpt' if name == 'jfk' else 'synthetic annotated speech', 'ingressSeconds': block_seconds, 'glossary': terms if glossary else [], 'quietCpus': process.cpu_affinity(), 'segments': segments, 'partials': partials, 'text': ' '.join(s['text'] for s in segments), 'computeWallSeconds': time.perf_counter()-began, 'cpuSeconds': after.user+after.system-cpu.user-cpu.system, 'rssBytes': process.memory_info().rss}
        results.append(result)
        print(json.dumps({k:result[k] for k in ['clip','text','computeWallSeconds']}, ensure_ascii=False), flush=True)
    prefix = 'saved-boundary' if clips == ['saved-boundary'] else 'speech'
    (out/f'{prefix}-{block_seconds:g}s-{glossary}.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
finally:
    worker.terminate()
    worker.wait(10)
