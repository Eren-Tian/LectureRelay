import { StudyWorkspace } from '../../components/StudyWorkspace';
import { StudyTools } from '../study/StudyTools';
import { useCallback, useEffect } from 'react';
import { api } from '../../api/client';
import { clock, languageName } from '../../lib/presentation';
import { Icon } from '../../components/Icon';
import { ResourceState } from '../../components/ResourceState';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { useWorkspace } from '../../app/Workspace';
import { LiveCaptions } from './LiveCaptions';

export function LivePage({ id }: { id: string }) {
  const workspace = useWorkspace();
  const { recording, refresh, navigate } = workspace;
  const load = useCallback(() => api.lecture(id), [id]);
  const { data, error, reload } = useResource(load);
  useEffect(() => {
    void reload();
  }, [reload]);
  const { busy, run } = useAction();
  const settings = workspace.data.settings;
  const live = workspace.live?.lectureId === id ? workspace.live : null;
  if (!data) return <ResourceState error={error} reload={reload} />;
  if (!recording || recording.lectureId !== id)
    return (
      <div className="empty-state paper">
        <h2>Recording saved</h2>
        <p>
          {live?.active
            ? 'Remaining captions and translations are processing. You can open the lecture now.'
            : 'Your lecture is ready to review.'}
        </p>
        <button
          className="button primary"
          onClick={() => navigate({ view: 'lecture', id })}
        >
          Open lecture
        </button>
      </div>
    );
  const translation = live?.translation ?? {
    enabled: settings.liveTranslation,
    configured:
      settings.provider !== 'none' &&
      workspace.data.providers.some(
        (p) => p.provider === settings.provider && p.hasKey,
      ),
    pendingIds: [],
    deferredIds: [],
    message: null,
  };
  const stop = () =>
    void run(async () => {
      try {
        await api.stopLecture(id);
      } finally {
        await refresh();
        if (!(await api.recording())) navigate({ view: 'lecture', id });
      }
    }, 'Recording saved.');
  const target = languageName(data.course.assistanceLanguage);
  return (
    <div className="live-page">
      <header className="classroom-heading">
        <div>
          <div className="eyebrow">{data.course.code || 'LIVE CLASSROOM'}</div>
          <h1>{data.course.name}</h1>
          <p>{data.lecture.title}</p>
        </div>
        <span className="pill">
          <span className="status-dot" />
          {settings.quietMode ? 'Quiet Mode' : 'Full performance'}
        </span>
      </header>
      <section className="classroom-status" aria-label="Recording status">
        <div className="recording-label">
          <span
            className={`record-dot ${recording.paused || recording.failed ? 'inactive' : ''}`}
          />
          {recording.failed
            ? 'Recording needs attention'
            : recording.paused
              ? 'Paused'
              : 'Recording'}
          <strong aria-label="Recording duration">
            {clock(recording.durationSeconds)}
          </strong>
        </div>
        <span className="actual-device" title={recording.deviceName}>
          {recording.source === 'system' ? 'System audio' : 'Microphone'} ·{' '}
          {recording.deviceName}
        </span>
        <div className="audio-health">
          <Icon name="mic" size={16} />
          <div
            className="level-track"
            role="meter"
            aria-label="Audio level"
            aria-valuenow={Math.min(100, Math.round(recording.level * 400))}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              style={{ width: Math.min(100, recording.level * 400) + '%' }}
            />
          </div>
        </div>
      </section>
      {recording.warning && (
        <p className="classroom-notice warning" role="alert">
          {recording.warning}
        </p>
      )}
      <StudyWorkspace
        primaryLabel="Captions"
        primary={
          <section className="live-caption-area">
            <div className="caption-heading">
              <div>
                <strong>Live captions</strong>
                <span className="caption-language">
                  English <Icon name="arrow" size={13} /> {target}
                </span>
              </div>
              <span className="caption-state">
                {settings.speechProvider === 'none'
                  ? 'Audio only'
                  : live?.state === 'unavailable'
                    ? 'Captions unavailable'
                    : recording.paused
                      ? 'Paused'
                      : live?.state === 'loading'
                        ? 'Loading speech model…'
                        : live?.draft
                          ? 'Listening…'
                          : 'Ready for speech'}
              </span>
            </div>
            {settings.showTranslation &&
              (!translation.enabled || !translation.configured) && (
                <div className="translation-setup">
                  <Icon name="cloud" size={17} />
                  <p>
                    {!translation.enabled
                      ? 'Live translation is off.'
                      : `Connect a text provider for live ${target} translation.`}{' '}
                    English and audio stay saved.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate({ view: 'settings' })}
                  >
                    Settings
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              )}
            <LiveCaptions
              segments={live?.segments ?? data.segments.slice(-200)}
              draft={live?.draft ?? null}
              translation={translation}
              settings={settings}
              language={data.course.assistanceLanguage}
              listening={settings.speechProvider !== 'none'}
            />
            {(live?.message || translation.message) && (
              <p className="classroom-notice warning" role="status">
                {live?.message || translation.message}
              </p>
            )}
            <div className="caption-footer">
              <span>
                {settings.speechProvider === 'local'
                  ? 'English on this device'
                  : settings.speechProvider === 'none'
                    ? 'Audio only'
                    : 'Cloud English captions'}
              </span>
              <span>
                {translation.pendingIds.length
                  ? `${translation.pendingIds.length} translation${translation.pendingIds.length === 1 ? '' : 's'} pending`
                  : 'Recent captions · full transcript in replay'}
              </span>
            </div>
          </section>
        }
        secondary={
          <StudyTools
            detail={data}
            position={recording.durationSeconds}
            onReload={reload}
          />
        }
      />
      <footer className="classroom-controls">
        <p>
          <Icon name="shield" size={16} />
          Audio is saved as you go.
        </p>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => void run(() => api.openCaptions())}
          >
            Caption window
          </button>
          <button
            className="button secondary"
            disabled={busy || recording.failed}
            onClick={() =>
              void run(() => api.pauseLecture(id, !recording.paused))
            }
          >
            <Icon name={recording.paused ? 'play' : 'pause'} size={17} />
            {recording.paused ? 'Resume' : 'Pause'}
          </button>
          <button className="button primary" disabled={busy} onClick={stop}>
            <Icon name="stop" size={17} />
            {busy ? 'Saving recording…' : 'Stop & save'}
          </button>
        </div>
      </footer>
    </div>
  );
}
