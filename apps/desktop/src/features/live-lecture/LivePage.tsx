import { ui } from '../../i18n';
import { messageText } from '../../i18n/messages';
import { StudyWorkspace } from '../../components/StudyWorkspace';
import { StudyTools } from '../study/StudyTools';
import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '../../api/client';
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
  const [openingCaptions, setOpeningCaptions] = useState(false);
  const settings = workspace.data.settings;
  const live = workspace.live?.lectureId === id ? workspace.live : null;
  if (!data) return <ResourceState error={error} reload={reload} />;
  if (!recording || recording.lectureId !== id)
    return (
      <div className="empty-state paper">
        <h2>{ui.recordingSaved}</h2>
        <p>
          {live?.active
            ? ui.liveSavedStillProcessingBody
            : ui.liveSavedReadyBody}
        </p>
        <button
          className="button primary"
          onClick={() => navigate({ view: 'lecture', id })}
        >
          {ui.liveOpenLectureRecord}
        </button>
      </div>
    );
  const translation = live?.translation ?? {
    enabled: settings.liveTranslation && settings.translationMode !== 'none',
    configured:
      settings.translationMode === 'cloud' &&
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
    }, ui.recordingSavedNotice);
  const target = languageName(data.course.assistanceLanguage);
  return (
    <div className="live-page">
      <header className="classroom-heading">
        <div>
          <div className="eyebrow">
            {data.course.code || ui.liveInSessionEyebrow}
          </div>
          <h1>{data.course.name}</h1>
          <p>{data.lecture.title}</p>
        </div>
        <span className="pill">
          <span className="status-dot" />
          {settings.quietMode ? ui.quietMode : ui.fullSpeedMode}
        </span>
      </header>
      <section
        className="classroom-status"
        aria-label={ui.liveRecordingStatusLabel}
      >
        <div className="recording-label">
          <span
            className={`record-dot ${recording.paused || recording.failed ? 'inactive' : ''}`}
          />
          {recording.failed
            ? ui.liveRecordingFailedStatus
            : recording.paused
              ? ui.liveRecordingPausedStatus
              : ui.recordingInProgress}
          <strong aria-label={ui.liveRecordingDurationLabel}>
            {clock(recording.durationSeconds)}
          </strong>
        </div>
        <span className="actual-device" title={recording.deviceName}>
          {recording.source === 'system' ? ui.systemAudio : ui.microphone} ·{' '}
          {recording.deviceName}
        </span>
        <div className="audio-health">
          <Icon name="mic" size={16} />
          <div
            className="level-track"
            role="meter"
            aria-label={ui.liveAudioLevelLabel}
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
          {messageText(recording.warning)}
        </p>
      )}
      {live && settings.speechProvider !== 'none' && (
        <div
          className={`classroom-notice ${live.backlogSeconds > 6 ? 'warning' : ''}`}
          role="status"
        >
          <strong>
            {live.state === 'unavailable'
              ? ui.liveEnglishCaptionsUnavailable
              : live.state === 'loading'
                ? ui.liveLoadingSpeechModel
                : live.backlogSeconds > 6
                  ? ui.liveRecognitionBehind(Math.round(live.backlogSeconds))
                  : ui.liveRecognitionOnTrack}
          </strong>
          {live.backlogSeconds > 6 && <p>{ui.liveBacklogHint}</p>}
          <div className="button-row">
            {settings.quietMode && live.backlogSeconds > 6 && (
              <button
                className="button secondary"
                onClick={() =>
                  void api
                    .saveRuntimePreferences({ quietMode: false })
                    .then(refresh)
                    .catch((e) => workspace.notify(errorText(e), true))
                }
              >
                {ui.liveSwitchToFullSpeed}
              </button>
            )}
            {translation.enabled && translation.configured && (
              <button
                className="text-button"
                onClick={() =>
                  void api
                    .pauseLiveTranslation(!live.translationPaused)
                    .then(async () => {
                      await refresh();
                    })
                    .catch((e) => workspace.notify(errorText(e), true))
                }
              >
                {live.translationPaused
                  ? ui.liveResumeTranslation
                  : ui.livePauseTranslation}
              </button>
            )}
            {live.translationPaused && (
              <span>{ui.liveTranslationPausedHint}</span>
            )}
          </div>
        </div>
      )}
      <StudyWorkspace
        primaryLabel={ui.captions}
        primary={
          <section className="live-caption-area">
            <div className="caption-heading">
              <div>
                <strong>{ui.liveCaptions}</strong>
                <span className="caption-language">
                  {ui.english}
                  <Icon name="arrow" size={13} /> {target}
                </span>
              </div>
              <span className="caption-state">
                {settings.speechProvider === 'none'
                  ? ui.audioOnly
                  : live?.state === 'unavailable'
                    ? ui.liveCaptionsUnavailable
                    : recording.paused
                      ? ui.liveRecordingPausedStatus
                      : live?.state === 'loading'
                        ? ui.liveLoadingSpeechModel
                        : live?.draft
                          ? ui.listening
                          : ui.liveWaitingForSpeechStatus}
              </span>
            </div>
            {settings.showTranslation &&
              (!translation.enabled || !translation.configured) && (
                <div className="translation-setup">
                  <Icon
                    name={
                      settings.translationMode === 'local'
                        ? 'download'
                        : 'cloud'
                    }
                    size={17}
                  />
                  <p>
                    {!translation.enabled
                      ? ui.liveTranslationOffNotice
                      : settings.translationMode === 'local'
                        ? ui.liveDownloadModelForTranslation(target)
                        : ui.liveConfigureTextAiForTranslation(target)}{' '}
                    {ui.liveTranscriptAndAudioKept}
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      navigate({
                        view: 'settings',
                        entry:
                          settings.translationMode === 'local'
                            ? 'models'
                            : 'services',
                      })
                    }
                  >
                    {ui.settings}
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
              previews={live?.translationPreviews}
            />
            {(live?.message || translation.message) && (
              <p className="classroom-notice warning" role="status">
                {messageText(live?.message || translation.message)}
              </p>
            )}
            {translation.pendingIds.length > 0 && (
              <div className="caption-footer" role="status">
                <span>
                  {ui.livePendingTranslations(translation.pendingIds.length)}
                </span>
              </div>
            )}
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
        <div className="button-row">
          <button
            className="button secondary"
            disabled={openingCaptions}
            onClick={() => {
              setOpeningCaptions(true);
              void api
                .openCaptions()
                .catch((error) => workspace.notify(errorText(error), true))
                .finally(() => setOpeningCaptions(false));
            }}
          >
            {openingCaptions
              ? ui.liveOpeningCaptionWindow
              : ui.liveCaptionWindowButton}
          </button>
          <button
            className="button secondary"
            disabled={busy || recording.failed}
            onClick={() =>
              void run(() => api.pauseLecture(id, !recording.paused))
            }
          >
            <Icon name={recording.paused ? 'play' : 'pause'} size={17} />
            {recording.paused ? ui.liveResumeRecording : ui.livePauseRecording}
          </button>
          <button className="button primary" disabled={busy} onClick={stop}>
            <Icon name="stop" size={17} />
            {busy ? ui.liveSavingRecording : ui.liveStopAndSave}
          </button>
        </div>
      </footer>
    </div>
  );
}
