"""Read every saved frame, and compare synthetic audio envelopes across its timeline."""
import argparse
import json
import wave
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--recording', type=Path, required=True)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--references', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()

def read_envelope(path):
    chunks = []
    frames = 0
    with wave.open(str(path), 'rb') as wav:
        assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
        rate = wav.getframerate()
        assert rate % 100 == 0
        declared = wav.getnframes()
        while data := wav.readframes(rate * 30):
            assert len(data) % 2 == 0
            samples = np.frombuffer(data, dtype='<i2')
            frames += len(samples)
            # Full 10 ms RMS windows avoid aliasing when the device resamples 16 -> 48 kHz.
            window = rate // 100
            usable = len(samples) // window * window
            windows = samples[:usable].astype(np.float32).reshape(-1, window)
            chunks.append(np.sqrt(np.mean(windows ** 2, axis=1)))
        assert frames == declared, 'Saved WAV contains fewer readable frames than declared'
    return np.concatenate(chunks), {'sampleRate': rate, 'frames': frames, 'durationSeconds': frames / rate, 'allDeclaredFramesRead': True}

recorded, info = read_envelope(args.recording)
source, source_info = read_envelope(args.source)
references = json.loads(args.references.read_text(encoding='utf-8'))['clips']

def correlation(a, b):
    a = a - a.mean()
    b = b - b.mean()
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / norm) if norm else 0

# Estimate output/playback startup offset using the first known synthetic utterance.
probe = source[200:1200]
offset, initial = max(((shift, correlation(recorded[200 + shift:1200 + shift], probe)) for shift in range(0, 301)), key=lambda v: v[1])
checks = []
for clip in references:
    at = round((clip['voiceStartSeconds'] + 0.2) * 100)
    span = min(1000, round((clip['voiceEndSeconds'] - clip['voiceStartSeconds'] - 0.4) * 100))
    if at + span + offset + 50 >= len(recorded):
        continue
    expected = source[at:at + span]
    shift, score = max(((delta, correlation(recorded[at + offset + delta:at + offset + delta + span], expected)) for delta in range(-50, 51) if at + offset + delta >= 0), key=lambda v: v[1])
    checks.append({'clip': clip['index'], 'fixture': clip['fixture'], 'sourceSeconds': at / 100, 'bestDriftSeconds': shift / 100, 'envelopeCorrelation': score})
tail_span = 1000
tail_at = len(recorded) - tail_span
tail_candidates = [(delta, correlation(recorded[-tail_span:], source[tail_at - offset + delta:tail_at - offset + delta + tail_span]))
                   for delta in range(-50, 51)
                   if 0 <= tail_at - offset + delta <= len(source) - tail_span]
tail_shift, tail_score = max(tail_candidates, key=lambda v: v[1]) if tail_candidates else (None, None)
result = {'recording': str(args.recording), 'wave': info, 'source': source_info,
          'startupOffsetSeconds': offset / 100, 'startupCorrelation': initial,
          'checkedClips': len(checks), 'minEnvelopeCorrelation': min(c['envelopeCorrelation'] for c in checks),
          'maxAbsoluteDriftSeconds': max(abs(c['bestDriftSeconds']) for c in checks),
          'lastTenSecondsCorrelation': tail_score, 'tailAlignmentAdjustmentSeconds': tail_shift / 100 if tail_shift is not None else None, 'checks': checks,
          'method': '100 Hz RMS envelope correlation against known synthetic playback; confirms matching signal across the timeline, not word accuracy or independent audio quality.'}
result['passed'] = info['allDeclaredFramesRead'] and len(checks) > 100 and result['minEnvelopeCorrelation'] > 0.8 and (tail_score or 0) > 0.8
args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'checks'}, indent=2))
raise SystemExit(0 if result['passed'] else 1)
