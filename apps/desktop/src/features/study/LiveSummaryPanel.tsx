import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { Modal } from '../../components/Modal';
import { clock } from '../../lib/presentation';
import type { SummaryState } from '../../types/domain';
import {
  LiveSummarySetup,
  availableSummaryPreferences,
} from './LiveSummarySetup';

export function LiveSummaryPanel({
  id,
  live,
  onSeek,
  onAppend,
}: {
  id: string;
  live: boolean;
  onSeek?: (seconds: number) => void;
  onAppend: (body: string) => void;
}) {
  const workspace = useWorkspace();
  const preferences = availableSummaryPreferences(
    workspace.data.settings.liveSummaries,
  );
  const [state, setState] = useState<SummaryState>();
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clip, setClip] = useState('');
  const currentId = useRef(id);
  currentId.current = id;
  const activeAction = useRef(false);
  const mounted = useRef(true);
  const load = async () => {
    try {
      const result = await api.summaryState(id);
      if (mounted.current && currentId.current === id) setState(result);
    } catch (e) {
      if (mounted.current && currentId.current === id) setError(errorText(e));
    }
  };
  useEffect(() => {
    mounted.current = true;
    setState(undefined);
    setError('');
    setClip('');
    let active = true;
    const refresh = () => {
      if (active) void load();
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    const subscription = listen<string>('summary-updated', (e) => {
      if (e.payload === id) refresh();
    }).catch(() => () => {});
    return () => {
      active = false;
      mounted.current = false;
      clearInterval(timer);
      void subscription.then((off) => off());
    };
  }, [id]);
  useEffect(
    () => () => {
      if (clip) URL.revokeObjectURL(clip);
    },
    [clip],
  );
  const generate = async (cardId: string | null = null) => {
    if (activeAction.current) return;
    activeAction.current = true;
    setBusy(true);
    setError('');
    try {
      await api.summarizeNow(id, cardId);
    } catch (e) {
      setError(errorText(e));
    } finally {
      activeAction.current = false;
      setBusy(false);
      await load();
    }
  };
  const replay = async (cardId: string, sourceId: string, seconds: number) => {
    if (onSeek) {
      onSeek(seconds);
      return;
    }
    try {
      const bytes = await api.summaryAudio(id, cardId, sourceId);
      setClip(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
    } catch (e) {
      setError(errorText(e));
    }
  };
  const cards = state?.cards ?? [];
  return (
    <div className="live-summary-panel">
      <header className="live-summary-heading">
        <div>
          <h2>实时课堂要点</h2>
          <p className="field-hint">
            {preferences.enabled
              ? `${preferences.provider === 'groq' ? 'Groq' : 'OpenAI'} · 每 ${preferences.intervalMinutes} 分钟整理新英文`
              : '尚未启用自动总结'}
          </p>
        </div>
        <button className="text-button" onClick={() => setSetup(true)}>
          设置总结
        </button>
      </header>
      {preferences.enabled ? (
        <div className="summary-live-status" role="status">
          <span>
            {state?.busy || busy
              ? '正在整理，录音与字幕继续…'
              : !live && (state?.remaining ?? 0) > 0
                ? '录音已保存，还有末尾英文可以整理。'
                : `正在收集新英文 · ${Math.floor(state?.collectingSeconds ?? 0)} 秒`}
          </span>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy || state?.busy || !state?.remaining}
              onClick={() => void generate()}
            >
              {live ? '立即总结' : '整理剩余片段'}
            </button>
            <button
              className="text-button"
              onClick={() =>
                void api
                  .saveSummarySettings({ ...preferences, enabled: false })
                  .then(workspace.refresh)
                  .catch((e) => setError(errorText(e)))
              }
            >
              关闭自动总结
            </button>
          </div>
        </div>
      ) : (
        <div className="summary-empty">
          <p>把刚讲过的内容整理成短卡片，保留对应原文和回听入口。</p>
          <button className="button primary" onClick={() => setSetup(true)}>
            设置实时总结
          </button>
        </div>
      )}
      {(error || state?.message) && (
        <p className="notice warning" role="alert">
          {error || state?.message}
        </p>
      )}
      {cards.map((card) => {
        const first = card.sources[0],
          last = card.sources[card.sources.length - 1];
        const outdated = card.state === 'stale';
        const body = `\n\n### ${card.title || '课堂要点'} [${clock(first.startSeconds)}](#t=${first.startSeconds})\n\n${card.points
          .map(
            (p) =>
              `- ${p.text} ${p.sourceIds
                .map((id) => {
                  const s = card.sources.find((s) => s.id === id)!;
                  return `[${clock(s.startSeconds)}](#t=${s.startSeconds})`;
                })
                .join(' ')}`,
          )
          .join('\n')}\n`;
        return (
          <article
            className={`summary-card ${outdated ? 'summary-stale' : ''}`}
            key={card.id}
          >
            <header>
              <strong>{card.title || '这一段课堂内容'}</strong>
              <span className="summary-state">
                {
                  {
                    running: '整理中',
                    completed: 'AI 要点',
                    failed: '未完成',
                    deferred: '已暂缓',
                    stale: '原文已更改',
                  }[card.state]
                }
              </span>
            </header>
            <span className="summary-time">
              {clock(first.startSeconds)} — {clock(last.endSeconds)}
            </span>
            {!!card.points.length && card.state !== 'running' && (
              <ul className="summary-points">
                {card.points.map((point, i) => (
                  <li key={i}>
                    <span>{point.text}</span>
                    <div className="summary-references">
                      {point.sourceIds.map((sourceId) => {
                        const source = card.sources.find(
                          (s) => s.id === sourceId,
                        );
                        return (
                          source && (
                            <button
                              key={sourceId}
                              className="text-button"
                              aria-label={`回听原文 ${clock(source.startSeconds)}`}
                              onClick={() =>
                                void replay(
                                  card.id,
                                  source.id,
                                  source.startSeconds,
                                )
                              }
                            >
                              {clock(source.startSeconds)} · 回听
                            </button>
                          )
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {card.message && <p className="notice warning">{card.message}</p>}
            <details>
              <summary>查看对应英文原文</summary>
              {card.sources.map((source) => (
                <p className="summary-source" key={source.id}>
                  <button
                    className="text-button"
                    onClick={() =>
                      void replay(card.id, source.id, source.startSeconds)
                    }
                  >
                    {clock(source.startSeconds)}
                  </button>{' '}
                  {source.text}
                </p>
              ))}
            </details>
            <div className="button-row">
              {!!card.points.length && (
                <button
                  className="text-button"
                  disabled={outdated || card.state !== 'completed'}
                  onClick={() => onAppend(body)}
                >
                  加入我的笔记
                </button>
              )}
              {card.state !== 'completed' && card.state !== 'running' && (
                <button
                  className="button secondary"
                  disabled={busy || state?.busy || !preferences.enabled}
                  onClick={() => void generate(card.id)}
                >
                  {outdated ? '重新整理' : '重试这一段'}
                </button>
              )}
            </div>
          </article>
        );
      })}
      {clip && (
        <div className="summary-audio">
          <p className="field-hint">回听所选原文，最多 60 秒</p>
          <audio controls autoPlay src={clip} />
        </div>
      )}
      {!!cards.length && (
        <p className="field-hint">
          AI
          要点可能有误，可展开原文核对。仅点击“加入我的笔记”才会写入你的笔记草稿。
        </p>
      )}
      {setup && (
        <Modal title="设置实时总结" onClose={() => setSetup(false)}>
          <LiveSummarySetup onSaved={() => void load()} />
        </Modal>
      )}
    </div>
  );
}
