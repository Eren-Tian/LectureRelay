"""Independent upstream baseline; development only, never shipped in the EXE.

Install fxtranslate==0.4.2 into target/local-ai-evaluation/bergamot-package.
Model discovery/download uses Mozilla Remote Settings with verified attachments.
The explicit cache keeps all files out of the user's Firefox / classroom data.
"""
import hashlib
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "target/local-ai-evaluation"
sys.path.insert(0, str(OUT / "bergamot-package"))
from fxtranslate import Translator  # noqa: E402

samples = json.loads((ROOT / "experiments/local-ai/classroom-samples.json").read_text(encoding="utf-8"))
cache = OUT / "bergamot-models"
started = time.perf_counter()
rows = []
loads = {}
for target in ["zh-Hans", "ja", "ko"]:
    started = time.perf_counter()
    translator = Translator.load("en", target, cache_dir=str(cache))
    loads[target] = round((time.perf_counter() - started) * 1000)
    for sample in samples:
        started = time.perf_counter()
        try:
            result = translator.translate_long(sample["source"])
        except BaseException as error:
            if isinstance(error, (KeyboardInterrupt, SystemExit)):
                raise
            rows.append({**sample, "language": target, "error": str(error)})
            print(f'{target}: engine failure; no usable translation', flush=True)
            break
        elapsed = round((time.perf_counter() - started) * 1000, 2)
        rows.append({**sample, "language": target, "milliseconds": elapsed, "result": result})
        print(f'{target} {sample["id"]}: {elapsed} ms', flush=True)
files = [{"path": str(p.relative_to(cache)), "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in cache.rglob("*") if p.is_file()]
report = {"engine": "fxtranslate 0.4.2", "source": "https://github.com/gregtatum/translations", "backend": translator.backend(), "loadAndDownloadMs": loads, "rows": rows, "files": files, "limits": "No terminology/context prompt support. Not an integrated application or laptop test."}
(OUT / "bergamot-comparison.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
