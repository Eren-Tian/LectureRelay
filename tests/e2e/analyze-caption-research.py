"""Analyze matched trace requests and actual DOM samples; never subtract medians.

The first-output clock is the player's reported start, unless a separately
verified audio onset correction is supplied. Stage-to-stage samples use the
same segment ID/start/end/hash/revision (legacy traces omit hash/revision).
"""
import argparse
import json
import statistics
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('label')
args = parser.parse_args()
root = Path('target/latency-study') / args.label
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
lines = lambda p: [json.loads(s) for s in p.read_text(encoding='utf-8-sig').splitlines() if s]
o = read(root / 'observation.json')
samples = o['samples']
play = lines(root / 'playback.jsonl')[0]['utcSeconds'] * 1000
trace = []
malformed_trace_lines = 0
for line in (root/'stages.jsonl').read_text(encoding='utf-8-sig').splitlines():
    try:
        trace.append(json.loads(line))
    except json.JSONDecodeError:
        # Older diagnostic writers could interleave lines from two workers.
        # Keep valid observations, report losses; never invent repaired timings.
        malformed_trace_lines += 1

def dist(values):
    v = sorted(values)
    if not v:
        return {'n': 0}
    return {'n': len(v), 'median': statistics.median(v),
            'p95': v[min(len(v)-1, int(len(v)*.95))], 'max': max(v)}

def first(predicate):
    return next(((s['utcMs'] - play)/1000 for s in samples if predicate(s)), None)

def key(event):
    return tuple((s['id'], round(s['start'], 4), round(s['end'], 4),
                  s.get('sourceSha256'), s.get('revision')) for s in event['segments'])

by_stage = {}
for event in trace:
    by_stage.setdefault(event['stage'], {}).setdefault(key(event), []).append(event)

def pairs(start, end):
    result = []
    for k, ends in by_stage.get(end, {}).items():
        starts = by_stage.get(start, {}).get(k, [])
        for e in ends:
            prior = [v for v in starts if v['utcMs'] <= e['utcMs']]
            if prior:
                a = prior[-1]
                result.append({'unit': k, 'seconds': (e['utcMs'] - a['utcMs'])/1000})
    return result

matched = {name: pairs(a, b) for name, a, b in [
    ('previewQueue', 'preview_eligible', 'preview_start'),
    ('previewComputeFirstDelta', 'preview_start', 'preview_first_delta'),
    ('previewComputeComplete', 'preview_start', 'preview_done'),
    ('finalQueue', 'translation_queued', 'translation_start'),
    ('finalComputeComplete', 'translation_start', 'translation_done'),
    ('finalPublished', 'speech_final', 'translation_published'),
]}
# Final DOM timing pairs the persisted source ID/text, not another row's median.
published_to_dom = []
final_to_dom = []
segments = o['detail']['segments']
for seg in segments:
    seen = next((s for s in samples if any(v['id'] == seg['id'] and
                v['sourceText'] == seg['sourceText'] and v.get('translatedText')
                for v in s['segments']) and seg['translatedText'] in s['chinese']), None)
    if not seen:
        continue  # stop-tail publication is checked in the DB, not live DOM.
    finals = [v for v in trace if v['stage'] == 'speech_final' and
              any(t['id'] == seg['id'] for t in v['segments'])]
    pubs = [v for v in trace if v['stage'] == 'translation_published' and
            any(t['id'] == seg['id'] for t in v['segments'])]
    if finals:
        final_to_dom.append({'id': seg['id'], 'seconds': (seen['utcMs']-finals[0]['utcMs'])/1000})
    if pubs:
        published_to_dom.append({'id': seg['id'], 'seconds': (seen['utcMs']-pubs[0]['utcMs'])/1000})
matched['finalSourceToDom'] = final_to_dom
matched['finalPublishToDom'] = published_to_dom
preparations = {}
for model in ['speech', 'translation']:
    starts = [e for e in trace if e['stage'] == model + '_prepare_start']
    ready = [e for e in trace if e['stage'] == model + '_ready']
    if starts and ready:
        preparations[model] = (ready[0]['utcMs']-starts[0]['utcMs'])/1000
metrics = lines(root / 'processes.jsonl')
active_end = play + samples[-1]['elapsed']*1000
resources = {}
ready_events = [e for e in trace if e['stage'] in ['speech_ready', 'translation_ready']]
ready_at = max((e['utcMs'] for e in ready_events), default=play)
for phase, condition in [
    ('idle', lambda t: t < play - (o.get('readySilenceSeconds', 0)+1)*1000),
    ('readySilence', lambda t: ready_at <= t < play),
    ('active', lambda t: play <= t <= active_end),
]:
    m = [v for v in metrics if condition(v['utcSeconds']*1000)]
    resources[phase] = {'normalizedCpuPercent': dist([v['cpuPercentNormalized'] for v in m]),
        'workingMiB': dist([v['rssBytesSum']/1048576 for v in m]),
        'privateMiB': dist([v['privateBytesSum']/1048576 for v in m]),
        'cpuSeconds': sum(v.get('cpuSecondsDelta', 0) for v in m) if m and 'cpuSecondsDelta' in m[0] else None}
revisions = {}
for s in samples:
    for p in s.get('previews', []):
        if p['kind'] == 'draft':
            revisions.setdefault(p['id'], {}).setdefault(p['sourceRevision'], p['sourceText'])
result = {'label': args.label, 'clock': 'player audio-start, not yet phoneme-onset aligned',
    'malformedTraceLinesExcluded': malformed_trace_lines,
    'firstUsefulEnglishSeconds': first(lambda s: any(len(t.split()) >= 4 for t in s['english'])),
    'firstChinese8CharsSeconds': first(lambda s: any(len(t.strip()) >= 8 for t in s['chinese'])),
    'firstIntroPsychMeaningSeconds': first(lambda s: any('心理' in t and ('入门' in t or '导论' in t) for t in s['chinese'])),
    'firstFinalChineseSeconds': first(lambda s: any(v.get('translatedText') for v in s['segments'])),
    'preparationSeconds': preparations, 'backlogSeconds': dist([s['backlog'] for s in samples]),
    'maxQueue': max(s['queue'] for s in samples), 'maxDeferred': max(s['deferred'] for s in samples),
    'translatedSegments': sum(bool(s['translatedText']) for s in segments), 'segments': len(segments),
    'sourceRevisionsObserved': sum(len(v) for v in revisions.values()),
    'previewMaxWords': max((len(t.split()) for v in revisions.values() for t in v.values()), default=0),
    'matched': {k: dist([v['seconds'] for v in rows]) for k, rows in matched.items()},
    'resources': resources, 'playback': o['playback'], 'floating': o.get('floating')}
(root/'analysis.json').write_text(json.dumps({'summary': result, 'matchedUnits': matched}, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
