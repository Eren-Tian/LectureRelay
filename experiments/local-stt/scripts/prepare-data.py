import wave, audioop, json
from pathlib import Path
cache=Path('target/asr-evaluation'); dest=cache/'benchmark-data'
for f in list(dest.glob('*-original.wav'))+[cache/'jfk.wav']:
 with wave.open(str(f),'rb') as w:
  pcm=w.readframes(w.getnframes()); rate=w.getframerate(); width=w.getsampwidth(); channels=w.getnchannels()
  if channels==2:pcm=audioop.tomono(pcm,width,0.5,0.5)
  pcm=audioop.lin2lin(pcm,width,2)
  pcm,_=audioop.ratecv(pcm,2,1,rate,16000,None)
 with wave.open(str(dest/(f.stem.replace('-original','')+'.wav')),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(pcm)
for f in dest.glob('*-original.wav'):f.unlink()
refs=json.loads((dest/'references.json').read_text(encoding='utf-8-sig'))
refs['jfk']='And so my fellow Americans ask not what your country can do for you ask what you can do for your country'
(dest/'references.json').write_text(json.dumps(refs,indent=2))
