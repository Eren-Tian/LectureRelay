import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { Modal } from '../../components/Modal';
import { ui } from '../../i18n';
import { messageText } from '../../i18n/messages';
import { clock } from '../../lib/presentation';
import type { SummaryState } from '../../types/domain';
import { LiveSummarySetup } from './LiveSummarySetup';

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
  const preferences = workspace.data.settings.liveSummaries;
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
          <h2>{ui.liveSummaryTitle}</h2>
        </div>
        <button className="text-button" onClick={() => setSetup(true)}>
          {ui.liveSummarySettingsButton}
        </button>
      </header>
      {preferences.enabled ? (
        <div className="summary-live-status" role="status">
          <span>
            {state?.busy || busy
              ? ui.summaryInProgress
              : !live && (state?.remaining ?? 0) > 0
                ? ui.liveSummaryRemainingPending
                : ui.liveSummaryCollecting(
                    Math.floor(state?.collectingSeconds ?? 0),
                  )}
          </span>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy || state?.busy || !state?.remaining}
              onClick={() => void generate()}
            >
              {live
                ? ui.liveSummarySummarizeNow
                : ui.liveSummarySummarizeRemaining}
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
              {ui.liveSummaryTurnOffAuto}
            </button>
          </div>
        </div>
      ) : (
        <div className="summary-empty">
          <button className="button primary" onClick={() => setSetup(true)}>
            {ui.liveSummarySetUp}
          </button>
        </div>
      )}
      {(error || state?.message) && (
        <p className="notice warning" role="alert">
          {error || messageText(state?.message)}
        </p>
      )}
      {cards.map((card) => {
        const first = card.sources[0],
          last = card.sources[card.sources.length - 1];
        const outdated = card.state === 'stale';
        const body = `\n\n### ${card.title || ui.liveSummaryNoteHeadingFallback} [${clock(first.startSeconds)}](#t=${first.startSeconds})\n\n${card.points
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
              <strong>{card.title || ui.liveSummaryCardFallbackTitle}</strong>
              <span className="summary-state">
                {
                  {
                    running: ui.liveSummaryStateRunning,
                    completed: ui.summaryAiPoints,
                    failed: ui.liveSummaryStateFailed,
                    deferred: ui.liveSummaryStateDeferred,
                    stale: ui.liveSummaryStateStale,
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
                              aria-label={ui.liveSummaryReplaySourceAt(
                                clock(source.startSeconds),
                              )}
                              onClick={() =>
                                void replay(
                                  card.id,
                                  source.id,
                                  source.startSeconds,
                                )
                              }
                            >
                              {clock(source.startSeconds)}
                              {ui.summaryReplaySuffix}
                            </button>
                          )
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {card.message && (
              <p className="notice warning">{messageText(card.message)}</p>
            )}
            <details>
              <summary>{ui.liveSummaryViewEnglishSource}</summary>
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
                  {ui.summaryAddToNotes}
                </button>
              )}
              {card.state !== 'completed' && card.state !== 'running' && (
                <button
                  className="button secondary"
                  disabled={busy || state?.busy || !preferences.enabled}
                  onClick={() => void generate(card.id)}
                >
                  {outdated ? ui.summaryRegenerate : ui.liveSummaryRetrySegment}
                </button>
              )}
            </div>
          </article>
        );
      })}
      {clip && (
        <div className="summary-audio">
          <p className="field-hint">{ui.liveSummaryClipHint}</p>
          <audio controls autoPlay src={clip} />
        </div>
      )}
      {setup && (
        <Modal title={ui.liveSummarySetUp} onClose={() => setSetup(false)}>
          <LiveSummarySetup onSaved={() => void load()} />
        </Modal>
      )}
    </div>
  );
}
