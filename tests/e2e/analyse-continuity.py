"""Compare a unique pilot against the saved WAV; keep, rather than remove, offset jumps.

Requires numpy/scipy. Ordinary probes every 250 ms use 100 ms of unique source.
Around each persisted event, add probes every 25 ms over +/- 1 second.
This is a content alignment measurement, not proof of inaudibility or zero loss.
"""
import argparse
import json
import math
import wave
from pathlib import Path

import numpy as np
from scipy import signal

RATE = 16000
FILTER = signal.butter(4, [4000, 5900], btype='bandpass', fs=RATE, output='sos')


class Audio:
    def __init__(self, path):
        self.wav = wave.open(str(path), 'rb')
        assert self.wav.getsampwidth() == 2 and self.wav.getnchannels() == 1
        self.rate = self.wav.getframerate()
        self.frames = self.wav.getnframes()
        self.seconds = self.frames / self.rate

    def read(self, start, length):
        start = max(0, start)
        self.wav.setpos(min(self.frames, round(start * self.rate)))
        raw = self.wav.readframes(round(length * self.rate))
        audio = np.frombuffer(raw, '<i2').astype(np.float64) / 32768
        if self.rate != RATE:
            gcd = math.gcd(self.rate, RATE)
            audio = signal.resample_poly(audio, RATE // gcd, self.rate // gcd)
        return audio

    def pilot(self, start, length):
        # Filter with margins, then trim; avoid filter transients near every probe.
        left = max(0, start - .025)
        audio = self.read(left, length + (start - left) + .025)
        if len(audio) < 100:
            return np.array([])
        filtered = signal.sosfiltfilt(FILTER, audio)
        offset = round((start - left) * RATE)
        return filtered[offset:offset + round(length * RATE)]


def correlate(template, search):
    if len(search) < len(template) or len(template) < 100:
        return None
    dots = signal.correlate(search, template, mode='valid', method='fft')
    energy = np.concatenate([[0.], np.cumsum(search ** 2)])
    window_energy = energy[len(template):] - energy[:-len(template)]
    norm = np.sqrt(np.maximum(window_energy, 1e-20) * max(float(template @ template), 1e-20))
    # Near-silent windows otherwise amplify FFT/cumulative-sum roundoff into false matches.
    valid = window_energy > max(float(np.max(window_energy)) * 1e-6, 1e-14)
    scores = np.where(valid, np.clip(dots / norm, -1, 1), -1)
    index = int(np.argmax(scores))
    return index / RATE, float(scores[index])


def match(source, recording, at, expected, radius, length=.1):
    template = source.pilot(at, length)
    left = max(0, expected - radius)
    result = correlate(template, recording.pilot(left, radius * 2 + length))
    if result is None:
        return {'sourceSeconds': at, 'matched': False}
    offset, confidence = result
    return {'sourceSeconds': at, 'recordingSeconds': round(left + offset, 6),
            'offsetSeconds': round(left + offset - at, 6),
            'correlation': round(confidence, 5), 'matched': confidence >= .75}


def analyse(source_path, recording_path, output, start=0., end=None):
    source, recording = Audio(source_path), Audio(recording_path)
    event_path = recording_path.with_name('recording-events.json')
    trace = json.loads(event_path.read_text(encoding='utf-8')) if event_path.exists() else None
    results = []
    lag = 0.
    end = source.seconds if end is None else min(source.seconds, end)
    assert 0 <= start < end <= source.seconds
    for at in np.arange(start + .1, end - .1, .25):
        at = float(at)
        result = match(source, recording, at, at + lag, 15 if not results else .3)
        if not result['matched']:
            result = match(source, recording, at, at + lag, 15)
        if result['matched']:
            lag = result['offsetSeconds']
        results.append(result)
    matched = [row for row in results if row['matched']]
    edges = []
    if matched:
        for at, lag in [(start, matched[0]['offsetSeconds']), (end - .025, matched[-1]['offsetSeconds'])]:
            edges.append(match(source, recording, at, at + lag, .3, length=.025))
    jumps = []
    for before, after in zip(matched, matched[1:]):
        delta = after['offsetSeconds'] - before['offsetSeconds']
        if abs(delta) > .002:
            jumps.append({'sourceBefore': before['sourceSeconds'], 'sourceAfter': after['sourceSeconds'],
                          'recordingBefore': before['recordingSeconds'], 'recordingAfter': after['recordingSeconds'],
                          'offsetJumpSeconds': round(delta, 6)})
    neighborhoods = []
    if trace and matched:
        for event in trace['events']:
            if event['kind'] == 'capture_anchor':
                continue
            position = event['queuedSamples'] / trace['sampleRate']
            nearest = min(matched, key=lambda row: abs(row['recordingSeconds'] - position))
            estimate = position - nearest['offsetSeconds']
            if not start - 1 <= estimate <= end + 1:
                continue
            dense = [match(source, recording, float(at), float(at) + nearest['offsetSeconds'], .3)
                     for at in np.arange(max(.025, estimate - 1), min(source.seconds - .125, estimate + 1), .025)]
            neighborhoods.append({'event': event, 'recordingPositionSeconds': position,
                                  'estimatedSourceSeconds': estimate, 'probes': dense})
    # Read every frame separately from content matching, detecting truncation/decode issues.
    recording.wav.rewind()
    read_frames = 0
    zero_frames = 0
    while raw := recording.wav.readframes(recording.rate):
        values = np.frombuffer(raw, '<i2')
        read_frames += len(values)
        zero_frames += int(np.count_nonzero(values == 0))
    assert read_frames == recording.frames, 'Truncated WAV payload'
    report = {'method': 'Unique band-limited pilot; normalized local correlation; no time warping',
              'probeSeconds': .1, 'probeStepSeconds': .25, 'eventProbeStepSeconds': .025,
              'alignmentGridSeconds': 1 / RATE, 'offsetJumpThresholdSeconds': .002,
              'matchThreshold': .75, 'searchRecoverySeconds': 15,
              'limits': '150 ms between ordinary probe windows; cancelling defects there can escape detection. Low-confidence windows remain unresolved. Intended pauses/playback gaps require external lifecycle interpretation. Microphone acoustic filtering may prevent pilot matching.',
              'sourceSeconds': source.seconds, 'recordingSeconds': recording.seconds,
              'analysisStartSeconds': start, 'analysisEndSeconds': end,
              'sampleRate': recording.rate, 'framesRead': read_frames, 'zeroSamples': zero_frames,
              'matchedProbes': len(matched), 'unmatchedProbes': len(results) - len(matched),
              'firstMatch': matched[0] if matched else None, 'lastMatch': matched[-1] if matched else None,
              'firstAndLast25ms': edges,
              'offsetJumps': jumps, 'probes': results, 'events': neighborhoods}
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ['probes', 'events', 'limits']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--recording', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start', type=float, default=0.)
    parser.add_argument('--end', type=float)
    args = parser.parse_args()
    analyse(args.source, args.recording, args.output, args.start, args.end)
