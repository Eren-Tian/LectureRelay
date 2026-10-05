"""Compare two isolated native runs of the SAME documented real lecturer WAV.

First output and per-final publication wait are observations, not per-word latency.
Read all recorded frames and compare RMS envelopes without creating a transcript
reference or claiming word accuracy. Evidence remains under ignored target/.
"""
import argparse
import difflib
import json
import re
import wave
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('before', type=Path)
parser.add_argument('after', type=Path, nargs='?')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def envelope(path):
    parts, frames = [], 0
    with wave.open(str(path), 'rb') as wav:
        assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
        rate, declared = wav.getframerate(), wav.getnframes()
        assert rate % 100 == 0
        while data := wav.readframes(rate * 10):
            samples = np.frombuffer(data, dtype='<i2')
            frames += len(samples)
            width = rate // 100
            usable = len(samples) // width * width
            windows = samples[:usable].astype(np.float64).reshape(-1, width)
            parts.append(np.sqrt(np.mean(windows ** 2, axis=1)))
        assert frames == declared, 'Missing readable WAV frames'
    return np.concatenate(parts), {'frames': frames, 'sampleRate': rate, 'durationSeconds': frames / rate, 'allDeclaredFramesRead': True}


def correlation(a, b):
    if len(a) != len(b) or not len(a):
        return -1.
    a, b = a - a.mean(), b - b.mean()
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / norm) if norm else 0.


def audio_check(recording, source):
    recorded, info = envelope(recording)
    original, _ = envelope(source)
    offset, initial = max(((shift, correlation(recorded[200 + shift:1200 + shift], original[200:1200])) for shift in range(301)), key=lambda item: item[1])
    checks = []
    # Check the real signal near the beginning, middle and end; permit <=0.5 s
    # alignment variation, report it rather than confusing it with missing audio.
    for at in [200, 2000, 4000, 6000, 7800]:
        span = min(1000, len(original) - at - 50)
        shift, score = max(((delta, correlation(recorded[at + offset + delta:at + offset + delta + span], original[at:at + span])) for delta in range(-50, 51) if at + offset + delta >= 0), key=lambda item: item[1])
        checks.append({'sourceSeconds': at / 100, 'correlation': score, 'alignmentAdjustmentSeconds': shift / 100})
    return {**info, 'startupOffsetSeconds': offset / 100, 'startupCorrelation': initial, 'envelopeChecks': checks, 'allChecksAbove0_8': all(c['correlation'] > .8 for c in checks)}


def analyse(folder):
    data = read_json(folder / 'observation.json')
    events = [json.loads(line) for line in (folder / 'playback.jsonl').read_text(encoding='utf-8').splitlines()]
    started = next(e['utcSeconds'] * 1000 for e in events if e['event'] == 'audio-start')
    samples = data['samples']
    first = lambda predicate: next(((s['utcMs'] - started) / 1000 for s in samples if predicate(s)), None)
    final_waits = []
    for segment in data['detail']['segments']:
        initial = first(lambda s: any(v['id'] == segment['id'] and v['sourceText'] in s['english'] for v in s['segments']))
        translated = first(lambda s: any(v['id'] == segment['id'] and v['translatedText'] and v['translatedText'] in s['chinese'] for v in s['segments']))
        if initial is not None and translated is not None:
            final_waits.append(translated - initial)
    backlog = [s['backlog'] for s in samples]
    lecture = data['detail']['lecture']
    diagnostic_root = Path('target/classroom-fixes/ui-1/app-data/logs')
    performance = read_json(diagnostic_root / (data['lectureId'] + '-performance.json'))
    return data, {
        'scope': data['scope'], 'lectureId': data['lectureId'],
        'polls': len(samples), 'firstEnglishSeconds': first(lambda s: bool(s['english'])),
        'firstAnyChineseSeconds': first(lambda s: bool(s['chinese'])),
        'firstSavedChineseSeconds': first(lambda s: any(v['translatedText'] and v['translatedText'] in s['chinese'] for v in s['segments'])),
        'finalToSavedChineseWaitMedianSeconds': float(np.median(final_waits)),
        'finalToSavedChineseWaitP95Seconds': float(np.percentile(final_waits, 95)),
        'finalToSavedChineseWaitObservations': len(final_waits),
        'speechBacklogMedianSeconds': float(np.median(backlog)),
        'speechBacklogP95Seconds': float(np.percentile(backlog, 95)),
        'speechBacklogMaxSeconds': max(backlog),
        'maxFinalQueueIncludingActive': max(s['queue'] for s in samples),
        'maxDeferred': max(s['deferred'] for s in samples),
        'previewVisiblePolls': sum(bool(s.get('previews')) for s in samples),
        'savedSegments': len(data['detail']['segments']),
        'savedTranslatedSegments': sum(bool(v['translatedText']) for v in data['detail']['segments']),
        'recordingStatus': lecture['status'], 'transcribedUntil': lecture['transcribedUntil'],
        'recordingWarning': data['detail']['recordingWarning'],
        'droppedBuffers': performance['droppedBuffers'],
        'droppedSamples': performance['droppedSamples'],
        'deviceDiscontinuities': performance['deviceDiscontinuities'],
        'audio': audio_check(lecture['recordingPath'], data['audio']),
    }


before, before_result = analyse(args.before)
result = {
    'run': before_result,
    'measurementLimitations': 'One 90-second MIT clip, native debug app and WebView2, instrumented ~200 ms polling, current machine, Quiet Mode. Cold starts can vary. Does not establish per-word latency, ordinary laptop resources, general microphone robustness, installed-app soak or independent translation accuracy.',
}
if args.after:
    after, after_result = analyse(args.after)
    assert Path(before['audio']).resolve() == Path(after['audio']).resolve()
    words = lambda data: re.findall(r"[a-z0-9']+", ' '.join(s['sourceText'] for s in data['detail']['segments']).lower())
    a, b = words(before), words(after)
    result.pop('run')
    result.update({
        'before': before_result, 'after': after_result,
        'transcriptComparison': {'beforeWords': len(a), 'afterWords': len(b), 'sequenceAgreement': difflib.SequenceMatcher(None, a, b, autojunk=False).ratio(), 'limitation': 'Agreement between model runs, not ground-truth WER or semantic accuracy.'},
    })
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(result, indent=2, ensure_ascii=False))
