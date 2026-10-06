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
        <h2>{'录音已保存'}</h2>
        <p>
          {live?.active
            ? '剩余字幕和译文仍在处理，你可以先打开课堂记录。'
            : '课堂记录已保存，可以开始回顾。'}
        </p>
        <button
          className="button primary"
          onClick={() => navigate({ view: 'lecture', id })}
        >
          {'打开课堂记录'}
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
    }, '录音已保存。');
  const target = languageName(data.course.assistanceLanguage);
  return (
    <div className="live-page">
      <header className="classroom-heading">
        <div>
          <div className="eyebrow">{data.course.code || '正在上课'}</div>
          <h1>{data.course.name}</h1>
          <p>{data.lecture.title}</p>
        </div>
        <span className="pill">
          <span className="status-dot" />
          {settings.quietMode ? '安静模式' : '全速模式'}
        </span>
      </header>
      <section className="classroom-status" aria-label="录音状态">
        <div className="recording-label">
          <span
            className={`record-dot ${recording.paused || recording.failed ? 'inactive' : ''}`}
          />
          {recording.failed
            ? '录音出现异常，请查看提示'
            : recording.paused
              ? '已暂停'
              : '正在录音'}
          <strong aria-label="录音时长">
            {clock(recording.durationSeconds)}
          </strong>
        </div>
        <span className="actual-device" title={recording.deviceName}>
          {recording.source === 'system' ? '系统声音' : '麦克风'} ·{' '}
          {recording.deviceName}
        </span>
        <div className="audio-health">
          <Icon name="mic" size={16} />
          <div
            className="level-track"
            role="meter"
            aria-label="声音电平"
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
              ? '英文字幕暂时不可用'
              : live.state === 'loading'
                ? '正在加载语音模型…'
                : live.backlogSeconds > 6
                  ? `英文识别落后 ${Math.round(live.backlogSeconds)} 秒`
                  : '英文识别进度正常'}
          </strong>
          {live.backlogSeconds > 6 && (
            <p>
              {
                '录音正在保存。应用会暂缓翻译，让英文识别先跟上；未完成的内容可以在课后补全。'
              }
            </p>
          )}
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
                {'切换到全速模式'}
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
                {live.translationPaused ? '恢复翻译' : '暂停翻译'}
              </button>
            )}
            {live.translationPaused && (
              <span>{'翻译已暂停，英文识别和录音继续'}</span>
            )}
          </div>
        </div>
      )}
      <StudyWorkspace
        primaryLabel="字幕"
        primary={
          <section className="live-caption-area">
            <div className="caption-heading">
              <div>
                <strong>{'实时字幕'}</strong>
                <span className="caption-language">
                  {'英文'}
                  <Icon name="arrow" size={13} /> {target}
                </span>
              </div>
              <span className="caption-state">
                {settings.speechProvider === 'none'
                  ? '仅录音'
                  : live?.state === 'unavailable'
                    ? '字幕暂时不可用'
                    : recording.paused
                      ? '已暂停'
                      : live?.state === 'loading'
                        ? '正在加载语音模型…'
                        : live?.draft
                          ? '正在识别…'
                          : '等待讲话'}
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
                      ? '实时翻译已关闭。'
                      : settings.translationMode === 'local'
                        ? `请先下载所选本地模型，以启用${target}翻译。`
                        : `请先配置文本 AI 服务，以启用${target}翻译。`}{' '}
                    {'英文转录和录音都会保留。'}
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
                    {'设置'}
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
                <span>{translation.pendingIds.length} 段译文待处理</span>
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
            {openingCaptions ? '正在打开字幕窗…' : '独立字幕窗'}
          </button>
          <button
            className="button secondary"
            disabled={busy || recording.failed}
            onClick={() =>
              void run(() => api.pauseLecture(id, !recording.paused))
            }
          >
            <Icon name={recording.paused ? 'play' : 'pause'} size={17} />
            {recording.paused ? '继续' : '暂停'}
          </button>
          <button className="button primary" disabled={busy} onClick={stop}>
            <Icon name="stop" size={17} />
            {busy ? '正在保存录音…' : '结束并保存'}
          </button>
        </div>
      </footer>
    </div>
  );
}
