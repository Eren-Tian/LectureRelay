"""Approximate transcript WER against official OCW cues, with edge limitations.

Cue timestamps are not word timestamps; partially overlapping first/last cues
are retained and can add edge errors. This is a comparison aid, not a measured
classroom accuracy guarantee. Reference text is kept only in ignored target.
"""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('label')
parser.add_argument('--reference', type=Path, required=True)
parser.add_argument('--start', type=float, required=True)
parser.add_argument('--end', type=float, required=True)
args = parser.parse_args()
root = Path('target/latency-study')/args.label
o = json.loads((root/'observation.json').read_text(encoding='utf-8'))

def seconds(value):
    h,m,s=value.split(':')
    return int(h)*3600+int(m)*60+float(s)

captions = []
for block in args.reference.read_text(encoding='utf-8-sig').split('\n\n'):
    match = re.search(r'(\d\d:\d\d:\d\d\.\d+) --> (\d\d:\d\d:\d\d\.\d+)',block)
    if match and seconds(match[1])<args.end and seconds(match[2])>args.start:
        captions.append(block[match.end():])

def tokens(text):
    text=re.sub(r'<[^>]*>', '', text.lower().replace('’',"'"))
    text=re.sub(r'\b(professor|instructor|lecturer)\s*:', '', text)
    contractions={"don't":"do not","doesn't":"does not","didn't":"did not",
        "can't":"can not","won't":"will not","it's":"it is","that's":"that is",
        "you're":"you are","i'm":"i am","we're":"we are","isn't":"is not"}
    for a,b in contractions.items():text=text.replace(a,b)
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?",text)

reference=tokens(' '.join(captions))
hypothesis=tokens(' '.join(s['sourceText'] for s in o['detail']['segments']))
prior=list(range(len(hypothesis)+1))
for i,word in enumerate(reference,1):
    current=[i]
    for j,heard in enumerate(hypothesis,1):
        current.append(min(prior[j]+1,current[-1]+1,prior[j-1]+(word!=heard)))
    prior=current
result={'scope':'approximate full excerpt WER; OCW cue edge inclusion and normalization apply',
    'referenceWords':len(reference),'hypothesisWords':len(hypothesis),'editDistance':prior[-1],
    'wer':prior[-1]/len(reference),'referencePath':str(args.reference),
    'start':args.start,'end':args.end,'normalization':'lowercase, tag/speaker stripping, explicit common contractions; fillers/numbers retained'}
(root/'reference-comparison.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
