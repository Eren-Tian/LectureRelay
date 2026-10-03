import json,subprocess,time,wave
from pathlib import Path
from measure import Measure
cache=Path('target/asr-evaluation').resolve()
for clip in sorted((cache/'benchmark-data').glob('*.wav')):
 with wave.open(str(clip),'rb') as w:duration=w.getnframes()/w.getframerate()
 output=cache/('whisper-'+clip.stem)
 with Measure() as measure:
  at=time.perf_counter();r=subprocess.run([str(cache/'whisper/Release/whisper-cli.exe'),'-m',str(cache/'models/ggml-tiny.en.bin'),'-f',str(clip),'-t','2','-l','en','-oj','-of',str(output)],capture_output=True,timeout=120);wall=time.perf_counter()-at
 transcript=json.loads(output.with_suffix('.json').read_text()) if output.with_suffix('.json').exists() else {}
 text=' '.join(v['text'] for v in transcript.get('transcription',[]))
 print(json.dumps({'model':'whisper.cpp-tiny.en','clip':clip.stem,'code':r.returncode,'wallSeconds':wall,'audioSeconds':duration,'text':text,**measure.values()}),flush=True)
