"""Consistent pre-migration backup; run with LectureRelay closed. Never deletes data."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3

root = Path(__file__).resolve().parents[2]
out = root / "target/acceptance-v0.3.1/pre-migration"
out.mkdir(parents=True, exist_ok=False)
data = Path(os.environ["LOCALAPPDATA"]) / "LectureRelay"
library = Path.home() / "Documents/LectureRelay"
with sqlite3.connect(f"file:{data / 'app.db'}?mode=ro", uri=True) as db:
    with sqlite3.connect(out / "app.db") as backup:
        db.backup(backup)
        assert backup.execute("PRAGMA quick_check").fetchone()[0] == "ok"
shutil.copytree(library, out / "library")
manifest = []
for base in [library, data / "models"]:
    for path in sorted(base.rglob("*")):
        if path.is_file():
            digest = hashlib.file_digest(path.open("rb"), "sha256").hexdigest()
            manifest.append({"path": str(path), "bytes": path.stat().st_size, "sha256": digest})
(out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps({"backup": str(out), "files": len(manifest), "bytes": sum(f["bytes"] for f in manifest)}))
