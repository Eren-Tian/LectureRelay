import { useEffect, useState } from 'react';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ui } from '../../i18n';
import { messageText } from '../../i18n/messages';
import { clock } from '../../lib/presentation';
import { LiveSummarySetup } from './LiveSummarySetup';
import { useSummaryState } from './useSummaryState';

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
  const {
    state,
    error,
    setError,
    busy,
    generate,
    reload: load,
  } = useSummaryState(id);
  const [setup, setSetup] = useState(false);
  const [clip, setClip] = useState('');
  useEffect(() => {
    setClip('');
  }, [id]);
  useEffect(
    () => () => {
      if (clip) URL.revokeObjectURL(clip);
    },
    [clip],
  );
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
  // During class the newest summary matters most, so it comes first.
  const ordered = live ? [...cards].reverse() : cards;
  const latest = live ? cards[cards.length - 1]?.id : undefined;
  const summarizing = !!(state?.busy || busy);
  // A summary starts once the new English spans one interval (see
  // select_sources in app/live_summaries.rs).
  const interval = preferences.intervalMinutes * 60;
  const collected = Math.min(state?.collectingSeconds ?? 0, interval);
  return (
    <div className={`live-summary-panel ${live ? 'live' : ''}`}>
      <header className="live-summary-heading">
        <div>
          <h2>{ui.liveSummaryTitle}</h2>
          {live && preferences.enabled && (
            <p>{ui.liveSummaryCadence(preferences.intervalMinutes)}</p>
          )}
        </div>
        <button className="text-button" onClick={() => setSetup(true)}>
          {ui.liveSummarySettingsButton}
        </button>
      </header>
      {preferences.enabled ? (
        <div className="summary-live-status" role="status">
          <span>
            {summarizing
              ? ui.summaryInProgress
              : !live && (state?.remaining ?? 0) > 0
                ? ui.liveSummaryRemainingPending
                : live
                  ? ui.liveSummaryProgress(clock(collected), clock(interval))
                  : ui.liveSummaryCollecting(
                      Math.floor(state?.collectingSeconds ?? 0),
                    )}
          </span>
          {live && (
            <div className="summary-progress" aria-hidden="true">
              <span
                className={summarizing ? 'working' : ''}
                style={{
                  transform: `scaleX(${summarizing ? 1 : collected / interval})`,
                }}
              />
            </div>
          )}
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
          <p>{ui.liveSummaryOffHint}</p>
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
      {ordered.map((card) => {
        const first = card.sources[0],
          last = card.sources[card.sources.length - 1];
        const outdated = card.state === 'stale';
        const newest = card.id === latest;
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
            className={`summary-card ${outdated ? 'summary-stale' : ''} ${newest ? 'summary-latest' : ''}`}
            key={card.id}
          >
            <header>
              <span className="summary-time">
                {clock(first.startSeconds)} – {clock(last.endSeconds)}
              </span>
              {card.state === 'completed' ? (
                newest && (
                  <span className="summary-badge">{ui.liveSummaryLatest}</span>
                )
              ) : (
                <span className="summary-state">
                  {
                    {
                      running: ui.liveSummaryStateRunning,
                      failed: ui.liveSummaryStateFailed,
                      deferred: ui.liveSummaryStateDeferred,
                      stale: ui.liveSummaryStateStale,
                    }[card.state]
                  }
                </span>
              )}
            </header>
            <h3 className="summary-title">
              {card.title || ui.liveSummaryCardFallbackTitle}
            </h3>
            {!!card.points.length && card.state !== 'running' && (
              <ul className="summary-points">
                {card.points.map((point, i) => (
                  <li key={i}>
                    <span>{point.text}</span>{' '}
                    <span className="summary-references">
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
                              <Icon name="play" size={10} />
                              {clock(source.startSeconds)}
                            </button>
                          )
                        );
                      })}
                    </span>
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
          <LiveSummarySetup onSaved={() => void load(true)} />
        </Modal>
      )}
    </div>
  );
}
