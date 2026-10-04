"""Calibrate the offline detector using known deletions, repetitions and silence."""
import importlib.util
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location('analysis', Path(__file__).with_name('analyse-continuity.py'))
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)


class Detector(unittest.TestCase):
    def test_known_content_changes_remain_visible_as_offsets(self):
        rate = 48000
        source = np.random.default_rng(932).integers(-1500, 1500, 8 * rate, dtype=np.int16)
        workspace = Path(__file__).resolve().parents[2]
        temporary = workspace / 'target' / 'continuity-detector-tests'
        temporary.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temporary) as directory:
            root = Path(directory)
            def save(name, values):
                path = root / f'{name}.wav'
                with wave.open(str(path), 'wb') as wav:
                    wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
                    wav.writeframes(values.astype('<i2').tobytes())
                return path
            reference = analysis.Audio(save('reference', source))
            cut, length = 3 * rate, int(.025 * rate)
            cases = {
                'unchanged': (source, 0),
                'deleted25ms': (np.concatenate([source[:cut], source[cut + length:]]), -.025),
                'repeated25ms': (np.concatenate([source[:cut], source[cut - length:cut], source[cut:]]), .025),
                'insertedSilence25ms': (np.concatenate([source[:cut], np.zeros(length), source[cut:]]), .025),
            }
            for name, (audio, expected) in cases.items():
                captured = analysis.Audio(save(name, np.concatenate([np.zeros(rate), audio, np.zeros(rate)])))
                before = analysis.match(reference, captured, 2., 3., .3)
                after = analysis.match(reference, captured, 5., 6., .3)
                self.assertTrue(before['matched'] and after['matched'], name)
                self.assertAlmostEqual(after['offsetSeconds'] - before['offsetSeconds'], expected, delta=1 / analysis.RATE)
                captured.wav.close()
            silent = analysis.Audio(save('silent', np.zeros(rate * 3)))
            self.assertFalse(analysis.match(reference, silent, 2., 1., .3)['matched'])
            silent.wav.close()
            reference.wav.close()


if __name__ == '__main__':
    unittest.main()
