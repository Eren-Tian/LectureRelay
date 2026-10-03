import array,json,struct,subprocess,time,wave,sys
from pathlib import Path
from measure import Measure
mode=sys.argv[1] if len(sys.argv)>1 else 'moonshine'
cache=Path('target/asr-evaluation').resolve()
runtime=Path('apps/desktop/src-tauri/resources/local-asr').resolve() if mode=='nemo' else cache/'moonshine-worker'
model=cache/'models/nemotron-speech-streaming-en-0.6b.q8_0.gguf' if mode=='nemo' else cache/'models/moonshine-streaming-small-Q8_0.gguf'
worker=subprocess.Popen([str(runtime/'asr-worker.exe'),str(runtime),str(model)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,creationflags=0x08000000)
def receive():
 code,size=struct.unpack('<iI',worker.stdout.read(8));text=worker.stdout.read(size).decode();return code,text
at=time.perf_counter();code,_=receive();print(json.dumps({'startupSeconds':time.perf_counter()-at,'code':code}),flush=True)
if len(sys.argv)>2 and sys.argv[2]=='bias':
 phrases=["Moran's I",'Getis-Ord Gi*','spatial autocorrelation','geographically weighted regression','Landsat','GeoAI','heterogeneity','CRISPR-Cas9','epigenetics','RNA polymerase','transcription factor','CUDA','transformer','self-attention','kernel','shared memory','occupancy']
 payload=('\0'.join(phrases)+'\0').encode();worker.stdin.write(struct.pack('<I',(3<<30)|len(payload))+payload);worker.stdin.flush();receive()
for clip in sorted((cache/'benchmark-data').glob('*.wav')):
 with wave.open(str(clip),'rb') as w:data=array.array('h',w.readframes(w.getnframes()))
 texts=[];partials=[];times=[];codes=[]
 with Measure(worker.pid) as measure:
  for start in range(0,len(data),32000):
   samples=data[start:start+32000];pcm=array.array('f',(v/32768 for v in samples));at=time.perf_counter()
   worker.stdin.write(struct.pack('<I',len(samples)|(1<<30))+pcm.tobytes());worker.stdin.flush();code,text=receive();elapsed=time.perf_counter()-at;times.append(elapsed);codes.append(code)
   if code:break
   update=json.loads(text)
   if update['final']:texts.append(update['text'])
   else:partials.append({'audioEndSeconds':(start+len(samples))/16000,'text':update['text'],'computeSeconds':elapsed})
  worker.stdin.write(struct.pack('<I',2<<30));worker.stdin.flush();code,text=receive();codes.append(code)
  if code==0:texts.append(json.loads(text)['text'])
 print(json.dumps({'model':mode+'-streaming','bias':len(sys.argv)>2 and sys.argv[2]=='bias','clip':clip.stem,'text':' '.join(texts),'partialUpdates':partials,'codes':codes,'audioSeconds':len(data)/16000,'computeSeconds':sum(times),'computeMeanMs':sum(times)/max(1,len(times))*1000,'computePeakMs':max(times)*1000,**measure.values()}),flush=True)
worker.terminate();worker.wait(10)
