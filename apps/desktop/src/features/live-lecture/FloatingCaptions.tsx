import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';
import type {
  AppSettings,
  LiveStatus,
  RecordingStatus,
} from '../../types/domain';
import {
  nextLiveStatus,
  visibleTranslationPreview,
} from '../../lib/live-status';
import { TranslationLine } from './TranslationLine';

export function FloatingCaptions() {
  const [live, setLive] = useState<LiveStatus | null>(null),
    [settings, setSettings] = useState<AppSettings | null>(null),
    [recording, setRecording] = useState<RecordingStatus | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true,
      busy = false;
    const subscription = listen<LiveStatus>('live-status', (event) => {
      if (alive) setLive((current) => nextLiveStatus(current, event.payload));
    });
    const read = async () => {
      if (busy) return;
      busy = true;
      try {
        const state = await api.captionState();
        if (alive) {
          setLive((current) => nextLiveStatus(current, state.live));
          setSettings(state.settings);
          setRecording(state.recording);
          document.documentElement.dataset.theme = state.settings.theme;
          setError('');
        }
      } catch {
        if (alive) setError('字幕连接暂时不可用，请查看主窗口。');
      } finally {
        busy = false;
      }
    };
    void read();
    const timer = setInterval(() => void read(), 1000);
    return () => {
      alive = false;
      clearInterval(timer);
      void subscription.then((unsubscribe) => unsubscribe()).catch(() => {});
    };
  }, []);
  return (
    <main className="floating-captions">
      <header>
        <strong>{'实时字幕'}</strong>
        <span>
          {recording
            ? recording.paused
              ? '已暂停'
              : '正在录音'
            : live?.active
              ? '正在完成剩余字幕'
              : '录音已保存'}
        </span>
        <button
          className="button secondary"
          onClick={() =>
            void api.closeCaptions().catch((e) => setError(errorText(e)))
          }
        >
          {'关闭字幕窗'}
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="floating-lines">
        {live?.segments.slice(-3).map((s) => {
          const preview = visibleTranslationPreview(
            live.translationPreviews,
            s.id,
            s.sourceText,
            live.targetLanguage ?? '',
          );
          return (
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
              {settings?.showTranslation && !s.translatedText && preview && (
                <TranslationLine
                  preview={preview}
                  size={settings.translationFontSize}
                />
              )}
            </article>
          );
        })}
        {live?.draft && settings?.showEnglish && (
          <p className="muted" style={{ fontSize: settings.englishFontSize }}>
            {live.draft.partialText}
          </p>
        )}
        {live?.draft &&
          settings?.showTranslation &&
          (() => {
            const id = `${live.draft.id}:0`;
            const preview = visibleTranslationPreview(
              live.translationPreviews,
              id,
              live.draft.partialText,
              live.targetLanguage ?? '',
            );
            return (
              preview && (
                <TranslationLine
                  preview={preview}
                  size={settings.translationFontSize}
                />
              )
            );
          })()}
        {!live?.segments.length && !live?.draft && (
          <p className="muted">
            {recording ? '等待声音…' : '请在主窗口开始录音。'}
          </p>
        )}
      </div>
      <footer>{'关闭字幕窗不会停止录音。'}</footer>
    </main>
  );
}
