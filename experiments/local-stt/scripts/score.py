import json,re,statistics
from pathlib import Path
cache=Path('target/asr-evaluation');refs=json.loads((cache/'benchmark-data/references.json').read_text())
def words(text):return re.findall(r'[a-z0-9]+',text.lower().replace("'",''))
def errors(ref,hyp):
 a,b=words(ref),words(hyp);dp=[[(0,0,0)]*(len(b)+1) for _ in range(len(a)+1)]
 for i in range(len(a)+1):dp[i][0]=(0,i,0)
 for j in range(len(b)+1):dp[0][j]=(0,0,j)
 for i in range(1,len(a)+1):
  for j in range(1,len(b)+1):
   if a[i-1]==b[j-1]:dp[i][j]=dp[i-1][j-1]
   else:
    s,d,k=dp[i-1][j-1];sub=(s+1,d,k)
    s,d,k=dp[i-1][j];dele=(s,d+1,k)
    s,d,k=dp[i][j-1];ins=(s,d,k+1)
    dp[i][j]=min([sub,dele,ins],key=sum)
 return {'referenceWords':len(a),'substitutions':dp[-1][-1][0],'deletions':dp[-1][-1][1],'insertions':dp[-1][-1][2],'wer':sum(dp[-1][-1])/len(a)}
summary=[]
for filename in ['nemotron-results.jsonl','parakeet-results.jsonl','moonshine-results.jsonl','moonshine-stream-results.jsonl','whisper-results.jsonl','nemotron-quiet-native-stream-results.jsonl','nemotron-bias-native-stream-results.jsonl','nemotron-cuda-results.jsonl']:
 groups={}
 for line in (cache/filename).read_text().splitlines():
  row=json.loads(line)
  if 'clip' not in row:continue
  row['text']=json.loads(row['output'])['text'] if row.get('output') else row.get('text','')
  row.update(errors(refs[row['clip']],row['text']));group='bias' if row.get('bias') else 'default';groups.setdefault(group,[]).append(row)
 for group,rows in groups.items():
  # Batch Moonshine has three repeats; accuracy uses the last repeat of each clip.
  unique={r['clip']:r for r in rows};total=sum(r['referenceWords'] for r in unique.values());err=sum(r['substitutions']+r['deletions']+r['insertions'] for r in unique.values())
  summary.append({'file':filename,'group':group,'werPercent':err/total*100,'referenceWords':total,'deletions':sum(r['deletions'] for r in unique.values()),'insertions':sum(r['insertions'] for r in unique.values()),'maxRamMiB':max([r['ramPeakMiB'] for r in rows if r.get('ramPeakMiB') is not None],default=None),'cpuMeanDuringInference':statistics.mean([r['cpuAveragePercent'] for r in rows if 'cpuAveragePercent' in r]) if any('cpuAveragePercent' in r for r in rows) else None,'clips':[{k:r.get(k) for k in ['clip','wer','wallSeconds','inferenceSeconds','computeSeconds','computeMeanMs','computePeakMs','cpuAveragePercent','cpuPeakPercent','ramPeakMiB','text']} for r in unique.values()]})
(cache/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps([{k:v for k,v in r.items() if k!='clips'} for r in summary],indent=2))
