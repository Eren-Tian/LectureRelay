"""Deterministic speech + a unique continuous band-limited timing pilot (no network).

Requires numpy/scipy. The pilot changes at every sample, including between repeated
speech clips. Never loop the resulting WAV when testing continuity.
"""
import argparse
import hashlib
import json
import wave
from pathlib import Path

import numpy as np
from scipy import signal


def generate(output, seconds, fixtures):
    rate = 48000
    clips = []
    for name in ['lecture', 'gis', 'cs', 'biology']:
        with wave.open(str(fixtures / f'{name}.wav'), 'rb') as source:
            assert (source.getframerate(), source.getnchannels(), source.getsampwidth()) == (16000, 1, 2)
            audio = np.frombuffer(source.readframes(source.getnframes()), '<i2').astype(np.float64) / 32768
        audio = signal.sosfiltfilt(signal.butter(6, 3000, fs=16000, output='sos'), audio)
        clips.append(np.concatenate([signal.resample_poly(audio, 3, 1) * .75, np.zeros(rate * 2)]))
    speech = np.concatenate(clips)
    rng = np.random.default_rng(20261004)
    sos = signal.butter(4, [3800, 6200], btype='bandpass', fs=rate, output='sos')
    state = np.zeros((len(sos), 2))
    count = int(seconds * rate)
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), 'wb') as wav:
        wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        for start in range(0, count, rate):
            size = min(rate, count - start)
            pilot, state = signal.sosfilt(sos, rng.standard_normal(size), zi=state)
            # About -47 dBFS RMS: audible at high volume; remains above PCM quantization.
            mixed = speech[(np.arange(size) + start) % len(speech)] + pilot * .014
            wav.writeframes(np.round(np.clip(mixed, -1, 1) * 32767).astype('<i2').tobytes())
    sha = hashlib.file_digest(output.open('rb'), 'sha256').hexdigest()
    metadata = {'schema': 1, 'seconds': seconds, 'rate': rate, 'seed': 20261004,
                'pilotHz': [3800, 6200], 'pilotScale': .014, 'sha256': sha,
                'speech': 'Four local synthetic English classroom fixtures; speech repeats, pilot never loops'}
    output.with_suffix('.source.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(json.dumps(metadata))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--seconds', type=float, required=True)
    parser.add_argument('--fixtures', type=Path, default=Path('target/asr-evaluation/benchmark-data'))
    parser.add_argument('--short-suite', action='store_true', help='Also split a 40-second reference into source.wav (0..30 s) and tail.wav (30..40 s)')
    args = parser.parse_args()
    if args.short_suite:
        assert args.seconds == 40 and args.output.name not in ['source.wav', 'tail.wav']
    generate(args.output, args.seconds, args.fixtures)
    if args.short_suite:
        with wave.open(str(args.output), 'rb') as reference:
            for name, seconds in [('source.wav', 30), ('tail.wav', 10)]:
                with wave.open(str(args.output.parent / name), 'wb') as part:
                    part.setparams(reference.getparams())
                    part.writeframes(reference.readframes(seconds * reference.getframerate()))
