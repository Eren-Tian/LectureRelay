"""Short installed latency decomposition; uses actual native trace and first DOM observation."""
import json
import os
from pathlib import Path
import statistics

root=Path('target/acceptance-v0.3.1')
short=json.loads((root/'stage-short.json').read_text(encoding='utf-8'))
trace=Path(os.environ['LOCALAPPDATA'])/'LectureRelay/logs'/f"{short['id']}-caption-stages.jsonl"
events=[json.loads(line) for line in trace.read_text(encoding='utf-8').splitlines()]
by_id={}
starts={}
for e in events:
    if e['stage']=='speech_start':
        starts[e['audioEndSeconds']]=e['utcMs']
    for s in e['segments']:
        row=by_id.setdefault(s['id'],{'id':s['id'],'start':s['start'],'end':s['end']})
        row[e['stage']]=e['utcMs']
for seen in short['seen']:
    if seen['id'] in by_id: by_id[seen['id']]['dom_'+seen['kind']]=seen['utcMs']
rows=[]
for row in by_id.values():
    if not all(key in row for key in ['speech_final','translation_queued','translation_start','translation_done','translation_published','dom_zh']):continue
    start=starts.get(row['end'])
    if start is None:continue
    end_audio=short['captureStartMs']+row['end']*1000
    rows.append({**row,'audioUnitSeconds':row['end']-row['start'],
        'audioEndToSpeechStartMs':start-end_audio,'finalSpeechCallMs':row['speech_final']-start,
        'queueWaitMs':row['translation_start']-row['translation_queued'],
        'translationInferenceMs':row['translation_done']-row['translation_start'],
        'persistPublishMs':row['translation_published']-row['translation_done'],
        'publishToObservedDomMs':row['dom_zh']-row['translation_published'],
        'audioEndToTranslatedDomMs':row['dom_zh']-end_audio,
        'audioStartToTranslatedDomMs':row['dom_zh']-(short['captureStartMs']+row['start']*1000)})
def stats(key):
    values=sorted(r[key] for r in rows)
    return {'median':statistics.median(values),'p95NearestRank':values[max(0,int((len(values)*.95)+.999999)-1)],'max':max(values)}
keys=['audioUnitSeconds','audioEndToSpeechStartMs','finalSpeechCallMs','queueWaitMs','translationInferenceMs','persistPublishMs','publishToObservedDomMs','audioEndToTranslatedDomMs','audioStartToTranslatedDomMs']
result={'scope':'180 s actual installed capture; Quiet Mode, local Nemotron + Hy-MT2. 100 ms DOM polling plus WebDriver call time. Capture anchor estimated from first read of recorder duration, includes its clock/checkpoint uncertainty. First model load included. Final speech call time excludes prior partial inference calls. Not the independent memory benchmark, and not directly comparable to old 5 s polling.', 'segmentsMeasured':len(rows),'savedSegments':len(short['detail']['segments']),'statistics':{k:stats(k) for k in keys},'rows':rows}
(root/'stage-analysis.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='rows'}))
