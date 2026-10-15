"""One-shot real Windows playback with monotonic/wall timestamps. Never loops."""
import argparse
import json
import time
import winsound
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--audio', type=Path, required=True)
parser.add_argument('--log', type=Path, required=True)
args = parser.parse_args()
args.log.parent.mkdir(parents=True, exist_ok=True)
with args.log.open('a', encoding='utf-8', buffering=1) as log:
    def event(kind):
        log.write(json.dumps({'event': kind, 'unixMs': time.time_ns() // 1000000,
                              'monotonicNs': time.monotonic_ns(), 'source': args.audio.name}) + '\n')
    event('play_requested')
    winsound.PlaySound(str(args.audio.resolve()), winsound.SND_FILENAME)
    event('play_returned')
