"""Concatenate non-sensitive synthetic fixtures into continuous playback material."""
import argparse
import json
import wave
from array import array
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--fixtures', type=Path, default=Path('target/asr-evaluation/benchmark-data'))
parser.add_argument('--seconds', type=float, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
names = ['lecture', 'gis', 'cs', 'biology']
clips = {}
for name in names:
    with wave.open(str(args.fixtures / f'{name}.wav'), 'rb') as source:
        assert (source.getframerate(), source.getnchannels(), source.getsampwidth()) == (16000, 1, 2)
        clips[name] = source.readframes(source.getnframes())
args.output.parent.mkdir(parents=True, exist_ok=True)
references = []
frame = 0
with wave.open(str(args.output), 'wb') as output:
    output.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
    while frame / 16000 < args.seconds:
        name = names[len(references) % len(names)]
        data = clips[name]
        samples = array('h', data)
        active = [i for i, v in enumerate(samples) if abs(v) > 120]
        references.append({'index': len(references), 'fixture': name,
                           'startSeconds': frame / 16000,
                           'voiceStartSeconds': (frame + active[0]) / 16000,
                           'voiceEndSeconds': (frame + active[-1]) / 16000,
                           'endSeconds': (frame + len(samples)) / 16000})
        output.writeframes(data)
        output.writeframes(bytes(16000 * 2 * 2))
        frame += len(samples) + 32000
args.output.with_suffix('.references.json').write_text(json.dumps({'durationSeconds': frame / 16000, 'clips': references}, indent=2), encoding='utf-8')
print(json.dumps({'output': str(args.output), 'durationSeconds': frame / 16000, 'clips': len(references)}))
