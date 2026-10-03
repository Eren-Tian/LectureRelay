import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type {
  AppSettings,
  LiveStatus,
  RecordingStatus,
} from '../../types/domain';

export function FloatingCaptions() {
  const [live, setLive] = useState<LiveStatus | null>(null),
    [settings, setSettings] = useState<AppSettings | null>(null),
    [recording, setRecording] = useState<RecordingStatus | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true,
      busy = false;
    const read = async () => {
      if (busy) return;
      busy = true;
      try {
        const [state, bootstrap] = await Promise.all([
          api.live(),
          api.bootstrap(),
        ]);
        if (alive) {
          setLive(state);
          setSettings(bootstrap.settings);
          setRecording(bootstrap.recording);
          document.documentElement.dataset.theme = bootstrap.settings.theme;
          setError('');
        }
      } catch {
        if (alive)
          setError('Caption connection is unavailable. Check the main window.');
      } finally {
        busy = false;
      }
    };
    void read();
    const timer = setInterval(() => void read(), 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <main className="floating-captions">
      <header>
        <strong>Live captions</strong>
        <span>
          {recording
            ? recording.paused
              ? 'Paused'
              : 'Recording'
            : live?.active
              ? 'Finishing captions'
              : 'Recording saved'}
        </span>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="floating-lines">
        {live?.segments.slice(-3).map((s) => (
          <article key={s.id}>
            {settings?.showEnglish && (
              <p style={{ fontSize: settings.englishFontSize }}>
                {s.sourceText}
              </p>
            )}
            {settings?.showTranslation && s.translatedText && (
              <p
                className="translated-text"
                style={{ fontSize: settings.translationFontSize }}
              >
                {s.translatedText}
              </p>
            )}
          </article>
        ))}
        {live?.draft && settings?.showEnglish && (
          <p className="muted" style={{ fontSize: settings.englishFontSize }}>
            {live.draft.partialText}
          </p>
        )}
        {!live?.segments.length && !live?.draft && (
          <p className="muted">
            {recording
              ? 'Waiting for speech…'
              : 'Start a lecture in the main window.'}
          </p>
        )}
      </div>
      <footer>Closing this window keeps the recording running.</footer>
    </main>
  );
}
