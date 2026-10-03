import json,subprocess,time,wave
from pathlib import Path
from measure import Measure
cache=Path('target/asr-evaluation').resolve()
for clip in sorted((cache/'benchmark-data').glob('*.wav')):
 args=[str(cache/'nemo-cuda/bin/nemo-speech.exe'),'transcribe',str(clip),'--model',str(cache/'models/nemotron-speech-streaming-en-0.6b.q8_0.gguf'),'--device','cuda:0','--format','json','--no-batching','--stream']
 at=time.perf_counter()
 with Measure() as measure:r=subprocess.run(args,capture_output=True,text=True,timeout=120)
 print(json.dumps({'model':'nemotron-cuda','clip':clip.stem,'code':r.returncode,'wallSeconds':time.perf_counter()-at,'output':r.stdout,'stderr':r.stderr[-1200:],**measure.values()}),flush=True)
