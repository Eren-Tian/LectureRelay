import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';

export function AudioInputTest({
  source,
  deviceId,
  disabled,
  onTesting,
}: {
  source: 'microphone' | 'system';
  deviceId: string;
  disabled: boolean;
  onTesting?: (testing: boolean) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState('');
  const [error, setError] = useState(false);
  const active = useRef(true);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      unsubscribe.current?.();
    };
  }, []);
  useEffect(() => {
    setResult('');
    setLevel(0);
  }, [source, deviceId]);
  const test = async () => {
    setTesting(true);
    onTesting?.(true);
    setResult('');
    setError(false);
    const id = crypto.randomUUID();
    try {
      const off = await listen<{ id: string; level: number }>(
        'audio-preview-level',
        (e) => {
          if (active.current && e.payload.id === id) setLevel(e.payload.level);
        },
      );
      unsubscribe.current = off;
      if (!active.current) {
        off();
        return;
      }
      const peak = await api.testAudioInput(id, source, deviceId);
      if (active.current) {
        setLevel(peak);
        setResult(
          peak > 0.002
            ? 'Audio detected. This input is ready.'
            : 'No sound detected. Check the selected device and try again.',
        );
      }
    } catch (e) {
      if (active.current) {
        setError(true);
        setResult(errorText(e));
      }
    } finally {
      unsubscribe.current?.();
      unsubscribe.current = undefined;
      if (active.current) setTesting(false);
      onTesting?.(false);
    }
  };
  return (
    <div className="audio-input-test">
      <div className="button-row">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || testing}
          onClick={() => void test()}
        >
          {testing ? 'Testing input…' : 'Test audio input'}
        </button>
        <meter aria-label="Audio input level" min={0} max={1} value={level} />
      </div>
      <p className="field-hint" role={error ? 'alert' : 'status'}>
        {testing
          ? source === 'system'
            ? 'Play audio on the selected output. The test ends after five seconds.'
            : 'Speak into the microphone. The test ends after five seconds.'
          : result ||
            'Five-second device check. Audio is neither saved nor sent.'}
      </p>
    </div>
  );
}
