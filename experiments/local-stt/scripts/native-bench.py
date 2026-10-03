"""Developer-only native CPU comparison. No Python is shipped."""
import ctypes as C, json, os, sys, time, wave, array, subprocess
from pathlib import Path
from measure import Measure
root=Path(__file__).resolve().parents[3]
cache=root/'target/asr-evaluation'
sdk=cache/'nemo'
if not sdk.exists(): sdk=root/'target/native/speech-worker/nemo'
mode=sys.argv[1] if len(sys.argv)>1 else 'moonshine'
if mode=='moonshine' or mode=='whisper':
    dll_dir=cache/'transcribe/transcribe-native-windows-x86_64-cpu-vulkan'
    cookie=os.add_dll_directory(str(dll_dir))
    lib=C.CDLL(str(dll_dir/'transcribe.dll'))
    lib.transcribe_init_backends.argtypes=[C.c_char_p]
    lib.transcribe_init_backends(str(dll_dir).encode())
    class Load(C.Structure): _fields_=[('size',C.c_uint64),('backend',C.c_int),('device',C.c_void_p)]
    class Session(C.Structure): _fields_=[('size',C.c_uint64),('threads',C.c_int),('kv',C.c_int),('ctx',C.c_int)]
    lp=Load();lib.transcribe_model_load_params_init(C.byref(lp));lp.backend=1
    sp=Session();lib.transcribe_session_params_init(C.byref(sp));sp.threads=2
    session=C.c_void_p()
    lib.transcribe_open.argtypes=[C.c_char_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_void_p)]
    model='moonshine-streaming-small-Q8_0.gguf' if mode=='moonshine' else 'ggml-tiny.en.bin'
    start=time.perf_counter();code=lib.transcribe_open(str(cache/'models'/model).encode(),C.byref(lp),C.byref(sp),C.byref(session))
    print(json.dumps({'model':mode,'loadCode':code,'startupSeconds':time.perf_counter()-start}),flush=True)
    if code: sys.exit(1)
    lib.transcribe_run.argtypes=[C.c_void_p,C.POINTER(C.c_float),C.c_int,C.c_void_p]
    lib.transcribe_full_text.argtypes=[C.c_void_p];lib.transcribe_full_text.restype=C.c_char_p
    for wav in sorted((cache/'benchmark-data').glob('*.wav')):
        with wave.open(str(wav),'rb') as f:
            assert f.getframerate()==16000 and f.getnchannels()==1 and f.getsampwidth()==2
            data=array.array('h',f.readframes(f.getnframes()))
        pcm=(C.c_float*len(data))(*(v/32768 for v in data))
        for i in range(3):
            with Measure() as measure:
             start=time.perf_counter();code=lib.transcribe_run(session,pcm,len(pcm),None);duration=time.perf_counter()-start
            print(json.dumps({'model':mode,'clip':wav.stem,'iteration':i,'code':code,'inferenceSeconds':duration,'audioSeconds':len(pcm)/16000,'text':lib.transcribe_full_text(session).decode(),**measure.values()}),flush=True)
    lib.transcribe_close.argtypes=[C.c_void_p];lib.transcribe_close(session)
else:
    model='nemotron-speech-streaming-en-0.6b.q8_0.gguf' if mode=='nemotron' else 'parakeet-tdt-0.6b-v3.q8_0.gguf'
    for wav in sorted((cache/'benchmark-data').glob('*.wav')):
      for bias in ([False,True] if mode=='nemotron' else [False]):
        args=[str(sdk/'bin/nemo-speech.exe'),'transcribe',str(wav),'--model',str(cache/'models'/model),'--device','cpu','--format','json','--no-batching']
        if mode=='nemotron':args+=['--stream']
        if bias:
          for term in ['Moran\'s I','Getis-Ord Gi star','spatial autocorrelation','GeoAI','Landsat','CUDA','CRISPR-Cas9','RNA polymerase']:args+=['--speech-context',term]
          args+=['--speech-context-boost','3']
        start=time.perf_counter()
        with Measure() as measure:r=subprocess.run(args,capture_output=True,text=True,timeout=180)
        print(json.dumps({'model':mode,'clip':wav.stem,'bias':bias,'wallSeconds':time.perf_counter()-start,'code':r.returncode,'output':r.stdout,'stderr':r.stderr[-3000:],**measure.values()}),flush=True)
