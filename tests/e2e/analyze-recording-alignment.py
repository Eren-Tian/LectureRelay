"""Verify complete PCM reads and align natural source/recording RMS envelopes.

This estimates audible onset at 10 ms resolution. Acoustic microphone matching
is reported with its correlation; it cannot certify classroom ASR accuracy.
"""
import argparse
import hashlib
import json
import statistics
import wave
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('label')
args = parser.parse_args()
root = Path('target/latency-study')/args.label
o = json.loads((root/'observation.json').read_text(encoding='utf-8'))
recording = Path(o['detail']['lecture']['recordingPath'])
source = Path(o['audio'])

def envelope(path, start, duration):
    with wave.open(str(path)) as w:
        assert w.getsampwidth() == 2
        w.setpos(min(w.getnframes(), round(start*w.getframerate())))
        raw = w.readframes(round(duration*w.getframerate()))
        values = np.frombuffer(raw,dtype='<i2').astype(float).reshape(-1,w.getnchannels()).mean(axis=1)
        block = round(w.getframerate()*.01)
        values = values[:len(values)//block*block].reshape(-1,block)
        return np.sqrt(np.mean(values*values,axis=1))

def align(ref, observed):
    centered = ref - ref.mean()
    n = len(ref)
    dot = np.correlate(observed,centered,mode='valid')
    sums = np.cumsum(np.r_[0.,observed])
    squares = np.cumsum(np.r_[0.,observed*observed])
    variance = squares[n:]-squares[:-n]-(sums[n:]-sums[:-n])**2/n
    score = dot / np.sqrt(np.maximum(variance,1e-12)*np.sum(centered*centered))
    best = int(np.argmax(score))
    return best*.01,float(score[best])

duration = o['detail']['lecture']['durationSeconds']
ref = envelope(source,0,10)
observed = envelope(recording,0,60)
offset,correlation = align(ref,observed)
audible = next((i*.01 for i,rms in enumerate(ref) if rms > max(ref)*.02),0.)
checks = []
with wave.open(str(source)) as w:
    source_duration = w.getnframes()/w.getframerate()
for position in [0,source_duration*.25,source_duration*.5,source_duration*.75,max(0,source_duration-12)]:
    r = envelope(source,position,10)
    start = max(0,position+offset-1)
    a = envelope(recording,start,12)
    if len(a) < len(r) or len(r) == 0:
        checks.append({'sourceSeconds':position,'complete':False})
        continue
    local_offset,quality = align(r,a)
    checks.append({'sourceSeconds':position,'offsetSeconds':start+local_offset-position,'correlation':quality})
with wave.open(str(recording)) as w:
    declared = w.getnframes()
    actual = 0
    while data := w.readframes(262144):
        actual += len(data)//(w.getnchannels()*w.getsampwidth())
    assert actual == declared, 'Recording PCM is truncated'
    params = {'rate':w.getframerate(),'channels':w.getnchannels(),'frames':actual,'seconds':actual/w.getframerate()}
clock = statistics.median(s['utcMs']-s['duration']*1000 for s in o['samples'])
onset_utc = clock+(offset+audible)*1000
player_utc = json.loads((root/'playback.jsonl').read_text(encoding='utf-8').splitlines()[0])['utcSeconds']*1000
summary = json.loads((root/'analysis.json').read_text(encoding='utf-8'))['summary']
corrected = {k: v+(player_utc-onset_utc)/1000 for k,v in summary.items()
             if k.startswith('first') and k.endswith('Seconds') and isinstance(v,(int,float))}
result = {'scope':'10 ms RMS onset estimate + sampled source/recording alignment; not phoneme ground truth',
    'recording':params,'sourceOffsetInRecordingSeconds':offset,'firstWindowCorrelation':correlation,
    'estimatedSpeechOnsetInSourceSeconds':audible,'estimatedOnsetUtcMs':onset_utc,
    'onsetMinusPlayerStartSeconds':(onset_utc-player_utc)/1000,'onsetAdjustedFirstOutput':corrected,
    'windowChecks':checks,'completePcmRead':True,
    'clockNote':'Recording origin estimated from median UI UTC minus native captured duration; polling uncertainty applies.'}
(root/'alignment.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
