import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';
import { ui } from '../../i18n';

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
  const pending = useRef(false);
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
    if (pending.current) return;
    pending.current = true;
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
            ? ui.audioTestSoundDetected
            : ui.audioTestNoSoundDetected,
        );
      }
    } catch (e) {
      if (active.current) {
        setError(true);
        setResult(errorText(e));
      }
    } finally {
      pending.current = false;
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
          {testing ? ui.audioTestTesting : ui.audioTestButton}
        </button>
        <meter
          aria-label={ui.audioTestLevelLabel}
          min={0}
          max={1}
          value={level}
        />
      </div>
      <p className="field-hint" role={error ? 'alert' : 'status'}>
        {testing
          ? source === 'system'
            ? ui.audioTestSystemPrompt
            : ui.audioTestMicrophonePrompt
          : result || ui.audioTestHint}
      </p>
    </div>
  );
}
