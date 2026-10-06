import { useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useAction } from '../../hooks/useAction';
import { MarkdownBody } from '../../components/MarkdownBody';
import { ui } from '../../i18n';
import { clock } from '../../lib/presentation';
import { messageText } from '../../i18n/messages';
import type { StudyState } from '../../types/domain';
import { LiveSummaryPanel } from './LiveSummaryPanel';

const PAGE_SIZE = 8;

export function ClassroomSummary({
  id,
  study,
  language,
  live,
  blocked,
  canGenerate,
  onSeek,
  onSaved,
  onAppend,
}: {
  id: string;
  study: StudyState;
  language: string;
  live: boolean;
  blocked: boolean;
  canGenerate: boolean;
  onSeek?: (seconds: number) => void;
  onSaved: () => Promise<void>;
  onAppend: (body: string) => void;
}) {
  const workspace = useWorkspace();
  const { busy, run } = useAction();
  const [page, setPage] = useState(0),
    [follow, setFollow] = useState(true);
  const review = study.reviews.find(
    (r) => !r.request.trim() && r.parts.some((p) => p.startSeconds != null),
  );
  const stale =
    !!review &&
    (review.sourceVersion !== study.sourceVersion ||
      review.language !== language ||
      review.state === 'stale');
  const cards =
    review && !live
      ? review.parts.map((p) => ({
          startSeconds: p.startSeconds ?? 0,
          endSeconds: p.endSeconds ?? p.startSeconds ?? 0,
          source: p.source,
          translation: '',
          body: p.body,
        }))
      : study.sections.map((s) => ({ ...s, body: null }));
  const lastPage = Math.max(0, Math.ceil(cards.length / PAGE_SIZE) - 1);
  const current = live && follow ? lastPage : Math.min(page, lastPage);
  const done = cards.filter((c) => c.body !== null).length;
  const local = workspace.data.settings.studyMode === 'local';
  const resume =
    !!review && !stale && !review.publishedVersion && review.origin === 'local';
  const generate = () =>
    void run(async () => {
      try {
        if (resume) await api.resumeReview(id, review.id);
        else await api.generateNotes(id);
        workspace.notify(ui.classroomSummarySavedLocally);
      } finally {
        await onSaved();
        await workspace.refresh();
      }
    });
  return (
    <div className="classroom-summary">
      <LiveSummaryPanel
        id={id}
        live={live}
        onSeek={onSeek}
        onAppend={onAppend}
      />
      {!live && (
        <details className="summary-archive">
          <summary>{ui.classroomSummaryArchiveTitle}</summary>
          <header className="summary-heading">
            <div>
              <h2>{ui.classroomSummaryHeading}</h2>
              <p className="field-hint">
                {live
                  ? ui.classroomSummaryLiveHint
                  : ui.classroomSummaryProgress(cards.length, done)}
              </p>
            </div>
            {!live && canGenerate && local && (
              <button
                className="button primary"
                disabled={blocked || busy || !study.sections.length}
                onClick={generate}
              >
                {busy
                  ? ui.summaryInProgress
                  : resume
                    ? ui.classroomSummaryResume
                    : review && !stale
                      ? ui.summaryRegenerate
                      : ui.classroomSummaryGenerate}
              </button>
            )}
          </header>
          {live ? (
            <p className="notice">{ui.classroomSummaryLiveNotice}</p>
          ) : (
            !local && (
              <p className="notice">
                {ui.classroomSummaryLocalModelNotice}
                <button
                  className="text-button"
                  onClick={() =>
                    workspace.navigate({ view: 'settings', entry: 'services' })
                  }
                >
                  {ui.classroomSummaryStudyModelSettings}
                </button>
              </p>
            )
          )}
          {!live && stale && (
            <p className="notice warning">{ui.classroomSummaryStaleWarning}</p>
          )}
          {!live && review && !review.publishedVersion && (
            <p className="notice" role="status">
              {ui.classroomSummarySavedProgress(done, cards.length)}
              {messageText(review.message) || ui.classroomSummaryResumeHint}
            </p>
          )}
          {!cards.length && (
            <p className="summary-empty">{ui.classroomSummaryEmpty}</p>
          )}
          {cards
            .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
            .map((card, offset) => {
              const index = current * PAGE_SIZE + offset;
              const chapter = study.marks.filter(
                (m) =>
                  m.kind === 'chapter' &&
                  m.seconds >= card.startSeconds &&
                  m.seconds <= card.endSeconds,
              )[0];
              const stamp = `[${clock(card.startSeconds)}](#t=${card.startSeconds})`;
              return (
                <article
                  className="summary-card"
                  key={`${index}:${card.startSeconds}`}
                >
                  <header>
                    <strong>
                      {chapter?.label ||
                        ui.classroomSummarySegmentLabel(index + 1)}
                    </strong>
                    <span className="summary-state">
                      {card.body
                        ? ui.summaryAiPoints
                        : live
                          ? ui.classroomSummarySourceCollected
                          : ui.classroomSummaryPending}
                    </span>
                  </header>
                  <button
                    className="text-button summary-time"
                    disabled={!onSeek}
                    aria-label={ui.classroomSummaryReplaySegment(index + 1)}
                    onClick={() => onSeek?.(card.startSeconds)}
                  >
                    {clock(card.startSeconds)} — {clock(card.endSeconds)}
                    {onSeek ? ui.summaryReplaySuffix : ''}
                  </button>
                  {card.body ? (
                    <MarkdownBody body={card.body} onSeek={onSeek} />
                  ) : (
                    <p className="summary-excerpt">
                      {(card.translation || card.source).slice(0, 260)}
                      {(card.translation || card.source).length > 260
                        ? '…'
                        : ''}
                    </p>
                  )}
                  <details>
                    <summary>{ui.classroomSummaryViewSource}</summary>
                    <p className="summary-source">{card.source}</p>
                    {card.translation && (
                      <p className="summary-source">{card.translation}</p>
                    )}
                  </details>
                  <button
                    className="text-button"
                    onClick={() =>
                      onAppend(
                        `\n\n### ${ui.classroomSummarySegmentLabel(index + 1)} ${stamp}\n\n${card.body || card.translation || card.source}\n\n${ui.classroomSummaryNoteAddendumLabel}`,
                      )
                    }
                  >
                    {card.body
                      ? ui.summaryAddToNotes
                      : ui.classroomSummaryAddNoteForSegment}
                  </button>
                </article>
              );
            })}
          {cards.length > PAGE_SIZE && (
            <nav
              className="summary-pages"
              aria-label={ui.classroomSummaryPagination}
            >
              <button
                className="button secondary"
                disabled={current === 0}
                onClick={() => {
                  setFollow(false);
                  setPage(current - 1);
                }}
              >
                {ui.previousPage}
              </button>
              <span>
                {current + 1} / {lastPage + 1}
              </span>
              <button
                className="button secondary"
                disabled={current === lastPage}
                onClick={() => {
                  setFollow(false);
                  setPage(current + 1);
                }}
              >
                {ui.nextPage}
              </button>
              {live && (
                <button className="text-button" onClick={() => setFollow(true)}>
                  {ui.classroomSummaryJumpToLatest}
                </button>
              )}
            </nav>
          )}
          {!live && (
            <p className="field-hint">{ui.classroomSummaryAccuracyHint}</p>
          )}
        </details>
      )}
    </div>
  );
}
