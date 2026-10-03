"""Exact reference-phrase miss rate, not a semantic terminology WER."""
import json,re
from pathlib import Path
cache=Path('target/asr-evaluation')
terms={'biology':['CRISPR Cas nine','epigenetics','RNA polymerase','transcription factor'],
       'cs':['CUDA','transformer','self attention','kernel','shared memory','occupancy'],
       'gis':["Moran's I",'Getis Ord G I star','spatial autocorrelation','geographically weighted regression','Landsat','Geo A I','heterogeneity']}
def normalize(s):return ' '.join(re.findall(r'[a-z0-9]+',s.lower().replace("'",'')))
results=[]
for model in json.loads((cache/'summary.json').read_text()):
 missed=[];total=0
 for clip in model['clips']:
  for term in terms.get(clip['clip'],[]):
   total+=1
   if ' '+normalize(term)+' ' not in ' '+normalize(clip['text'])+' ':missed.append(term)
 results.append({'file':model['file'],'group':model['group'],'terms':total,'missed':missed,'exactPhraseMissPercent':len(missed)/total*100})
(cache/'term-summary.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
