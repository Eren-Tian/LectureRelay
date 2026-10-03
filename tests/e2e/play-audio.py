"""Play known non-sensitive WAV fixtures through the real default Windows output."""
import argparse
import json
import time
import wave
import winsound
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--audio', type=Path, required=True)
parser.add_argument('--seconds', type=float, required=True)
parser.add_argument('--log', type=Path, required=True)
args = parser.parse_args()
with wave.open(str(args.audio), 'rb') as wav:
    duration = wav.getnframes() / wav.getframerate()
args.log.parent.mkdir(parents=True, exist_ok=True)
deadline = time.monotonic() + args.seconds
with args.log.open('w', encoding='utf-8', buffering=1) as log:
    iteration = 0
    while time.monotonic() < deadline:
        iteration += 1
        started = time.time()
        log.write(json.dumps({'iteration': iteration, 'event': 'audio-start', 'utcSeconds': started, 'durationSeconds': duration}) + '\n')
        winsound.PlaySound(str(args.audio.resolve()), winsound.SND_FILENAME)
        log.write(json.dumps({'iteration': iteration, 'event': 'audio-end', 'utcSeconds': time.time()}) + '\n')
        time.sleep(2)
