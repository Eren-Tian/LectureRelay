"""Real wall-clock soak using the preserved native-worker snapshot. Isolated data only."""
import array, ctypes as C, json, os, queue, sqlite3, struct, subprocess, threading, time, uuid, wave
from pathlib import Path
root=Path(__file__).resolve().parents[2]; cache=root/'target/asr-evaluation'
out=cache/('endurance-'+time.strftime('%Y%m%d-%H%M%S'));out.mkdir(exist_ok=True)
seconds=int(os.environ.get('LECTURERELAY_SOAK_SECONDS','5400'))
runtime=cache/'nemo-worker'
worker=subprocess.Popen([str(runtime/'asr-worker.exe'),str(runtime),str(cache/'models/nemotron-speech-streaming-en-0.6b.q8_0.gguf')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,creationflags=0x08000000)
def receive():
 head=worker.stdout.read(8)
 if len(head)!=8:raise RuntimeError('Native worker stopped')
 code,size=struct.unpack('<iI',head);text=worker.stdout.read(size).decode()
 if code:raise RuntimeError('Native worker failed '+str(code))
 return text
receive()
db=sqlite3.connect(out/'app.db',check_same_thread=False)
db.executescript((root/'apps/desktop/src-tauri/src/database/migrations/001_initial.sql').read_text())
db.executescript((root/'apps/desktop/src-tauri/src/database/migrations/002_classroom.sql').read_text());db.execute('pragma user_version=2')
course=str(uuid.uuid4());lecture=str(uuid.uuid4());now=int(time.time())
db.execute('insert into courses(id,name,code,subject,description,assistance_language,created_at) values(?,?,?,?,?,?,?)',(course,'[TEST] Endurance','TEST','Other','Synthetic benchmark only','ko',now))
db.execute('insert into lectures(id,course_id,title,started_at,status,recording_path) values(?,?,?,?,?,?)',(lecture,course,'90-minute native speech soak',now,'recording',str(out/'audio.wav')));db.commit()
speech=queue.Queue(maxsize=8); translations=queue.Queue(maxsize=8);done=threading.Event();errors=[];latencies=[];recorded=0;dropped=0;max_queue=0;max_tqueue=0;peak_ram=0;cpu_values=[]
clips=[]
for f in sorted((cache/'benchmark-data').glob('*.wav')):
 with wave.open(str(f),'rb') as w:clips.append(array.array('h',w.readframes(w.getnframes())).tolist()+[0]*16000)
pcm=sum(clips,[])
db_lock=threading.Lock()
def inference():
 utterance_start=0
 try:
  while True:
   item=speech.get()
   if item is None:
    worker.stdin.write(struct.pack('<I',2<<30));worker.stdin.flush();update=json.loads(receive())
    if update['text'].strip():
     with db_lock:
      db.execute('insert into transcript_segments(id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin,provider,status,transcript_version) values(?,?,?,?,?,?,?,?,?,?)',(f'{lecture}:{utterance_start}',lecture,utterance_start/16000,recorded/16000,update['text'],'','cloud','local','final','live'));db.commit()
    break
   start,samples=item;t=time.perf_counter();data=array.array('f',(s/32768 for s in samples))
   worker.stdin.write(struct.pack('<I',len(samples)|(1<<30))+data.tobytes());worker.stdin.flush();update=json.loads(receive());latencies.append(time.perf_counter()-t)
   if not update['final']:continue
   text=update['text']
   if text.strip():
    with db_lock:
     db.execute('insert into transcript_segments(id,lecture_id,start_seconds,end_seconds,source_text,translated_text,origin,provider,status,transcript_version) values(?,?,?,?,?,? ,?,?,?,?)',(f'{lecture}:{utterance_start}',lecture,utterance_start/16000,(start+len(samples))/16000,text,'','cloud','local','final','live'));db.execute('update lectures set transcribed_until=? where id=?',((start+len(samples))/16000,lecture));db.commit()
    try:translations.put_nowait(start)
    except queue.Full:pass
   utterance_start=start+len(samples)
 except Exception as e:errors.append(str(e))
 finally:done.set()
def translation():
 # Queue pressure simulation only; no simulated translated text is persisted.
 while not done.is_set() or not translations.empty():
  try:translations.get(timeout=.2);time.sleep(.3)
  except queue.Empty:pass
thread=threading.Thread(target=inference);thread.start();translator=threading.Thread(target=translation);translator.start()
class FT(C.Structure):_fields_=[('low',C.c_uint32),('high',C.c_uint32)]
class Mem(C.Structure):_fields_=[('cb',C.c_uint32),('faults',C.c_uint32)]+[(n,C.c_size_t) for n in ['peak','working','peakPaged','paged','peakNonPaged','nonPaged','pagefile','peakPagefile']]
kernel=C.WinDLL('kernel32',use_last_error=True);psapi=C.WinDLL('psapi')
kernel.OpenProcess.restype=C.c_void_p;kernel.GetProcessTimes.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p];psapi.GetProcessMemoryInfo.argtypes=[C.c_void_p,C.c_void_p,C.c_uint32]
handles=[kernel.OpenProcess(0x410,False,p) for p in [os.getpid(),worker.pid]]
def metrics():
 ticks=0;ram=0
 for h in handles:
  c,e,k,u=FT(),FT(),FT(),FT();kernel.GetProcessTimes(h,C.byref(c),C.byref(e),C.byref(k),C.byref(u));ticks+=((k.high<<32)|k.low)+((u.high<<32)|u.low)
  m=Mem();m.cb=C.sizeof(m);psapi.GetProcessMemoryInfo(h,C.byref(m),m.cb);ram+=m.working
 return ticks/1e7,ram/1048576
start_wall=time.perf_counter();prev_wall=start_wall;prev_cpu,_=metrics();pending=[];sample_cursor=0;last_checkpoint=start_wall;last_report=start_wall
file=open(out/'audio.wav','w+b');file.write(b'RIFF'+struct.pack('<I',36)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,16000,32000,2,16)+b'data'+struct.pack('<I',0));file.flush()
def checkpoint():
 file.seek(4);file.write(struct.pack('<I',36+recorded*2));file.seek(40);file.write(struct.pack('<I',recorded*2));file.seek(0,2);file.flush();os.fsync(file.fileno())
 temp=out/'recovery.pending';temp.write_text(json.dumps({'sampleCount':recorded,'sampleRate':16000}));os.replace(temp,out/'recovery.json')
while time.perf_counter()-start_wall<seconds:
 elapsed=time.perf_counter()-start_wall
 # Actual pause/resume, excluded from the audio timeline, at minute 1 and 45.
 if 60<=elapsed<70 or 2700<=elapsed<2710:time.sleep(.25);continue
 chunk=[pcm[(sample_cursor+i)%len(pcm)] for i in range(4000)];sample_cursor+=4000
 file.write(array.array('h',chunk).tobytes());recorded+=len(chunk);pending+=chunk
 if len(pending)>=32000:
  try:speech.put_nowait((recorded-len(pending),pending));pending=[]
  except queue.Full:dropped+=1;pending=[]
 max_queue=max(max_queue,speech.qsize());max_tqueue=max(max_tqueue,translations.qsize());t=time.perf_counter()
 if t-last_checkpoint>=1:checkpoint();last_checkpoint=t
 if t-last_report>=5:
  cpu,ram=metrics();cpu_values.append((cpu-prev_cpu)/(t-prev_wall)/(os.cpu_count() or 1)*100);prev_cpu=cpu;prev_wall=t;peak_ram=max(peak_ram,ram)
  report={'elapsedSeconds':t-start_wall,'audioSeconds':recorded/16000,'cpuAveragePercent':sum(cpu_values)/len(cpu_values),'cpuPeakPercent':max(cpu_values),'ramMiB':ram,'ramPeakMiB':peak_ram,'sttMeanMs':sum(latencies)/len(latencies)*1000 if latencies else None,'sttPeakMs':max(latencies)*1000 if latencies else None,'speechQueueMax':max_queue,'translationQueueMax':max_tqueue,'droppedSpeechChunks':dropped,'errors':errors,'scope':'Python WAV/checkpoint harness + Nemotron native worker (four logical CPU affinity); translation queue pressure simulation; not a full UI endurance test'}
  (out/'progress.json').write_text(json.dumps(report,indent=2));last_report=t
  print(json.dumps({'elapsedSeconds':round(report['elapsedSeconds']),'audioSeconds':report['audioSeconds'],'ramMiB':round(ram,1),'queue':speech.qsize(),'errors':len(errors)}),flush=True)
 if errors:break
 time.sleep(max(0,.25-(time.perf_counter()-t)))
if pending:speech.put((recorded-len(pending),pending))
speech.put(None);thread.join(60);done.set();translator.join(10);checkpoint();file.close();worker.terminate();worker.wait(10)
with db_lock:
 rows=db.execute('select id,start_seconds,end_seconds from transcript_segments order by start_seconds').fetchall()
 assert len({r[0] for r in rows})==len(rows)
 assert all(rows[i][2]<=rows[i+1][1]+.001 for i in range(len(rows)-1))
 db.execute('update lectures set duration_seconds=?,status=?,ended_at=? where id=?',(recorded/16000,'completed',int(time.time()),lecture));db.commit();db.close()
with wave.open(str(out/'audio.wav'),'rb') as w:assert w.getnframes()==recorded
report.update({'audioSeconds':recorded/16000,'completed':not errors and time.perf_counter()-start_wall>=seconds,'wallSeconds':time.perf_counter()-start_wall,'requestedSeconds':seconds,'segments':len(rows),'pauseResumeVerified':seconds>=70,'wavFrames':recorded,'recoveryMatches':json.loads((out/'recovery.json').read_text())['sampleCount']==recorded,'duplicates':0})
(out/'result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
