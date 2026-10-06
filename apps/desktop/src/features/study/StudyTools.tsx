import { ui } from '../../i18n';
import { messageText } from '../../i18n/messages';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../../api/client';
import { useResource } from '../../hooks/useResource';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../app/Workspace';
import { ResourceState } from '../../components/ResourceState';
import { StudyNotes } from './StudyNotes';
import { DeepReview } from './DeepReview';
import { ClassroomSummary } from './ClassroomSummary';
import {
  clock,
  languageName,
  taskName,
  taskStateName,
} from '../../lib/presentation';
import type { LectureDetail } from '../../types/domain';
const PdfPanel = lazy(() => import('./PdfPanel'));

export function StudyTools({
  detail,
  position,
  onSeek,
  onReload,
  onAI,
  questions,
}: {
  detail: LectureDetail;
  position: number;
  onSeek?: (n: number) => void;
  onReload: () => Promise<void>;
  onAI?: (kind: 'transcription' | 'translation' | 'notes') => void;
  questions?: ReactNode;
}) {
  const { job, live, recording } = useWorkspace(),
    { busy, run } = useAction();
  const id = detail.lecture.id;
  const untranslatedCount = detail.segments.filter(
    (segment) => !segment.translatedText,
  ).length;
  const load = useCallback(() => api.study(id), [id]);
  const { data, error, reload } = useResource(load);
  const [tab, setTab] = useState('summary'),
    [label, setLabel] = useState(''),
    [kind, setKind] = useState<'bookmark' | 'chapter'>('bookmark');
  const [append, setAppend] = useState<{ key: string; body: string }>();
  useEffect(() => {
    void reload();
  }, [
    reload,
    job?.kind,
    job?.lectureId,
    detail.note,
    detail.course.assistanceLanguage,
  ]);
  useEffect(() => {
    if (!live?.active && job?.lectureId !== id) return;
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [live?.active, job?.lectureId, id, reload]);
  const refresh = async () => {
    await reload();
    await onReload();
  };
  return (
    <section className="study-tools">
      <div className="study-tabs" role="tablist" aria-label={ui.studyTools}>
        {[
          'summary',
          'notes',
          'index',
          'slides',
          ...(questions ? ['questions'] : []),
          'tasks',
        ].map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'active' : ''}
            onClick={() => setTab(name)}
          >
            {
              (
                {
                  summary: ui.studyTabSummary,
                  notes: ui.studyMyNotes,
                  index: ui.studyTabIndex,
                  slides: ui.studyTabSlides,
                  questions: ui.studyTabQuestions,
                  tasks: ui.studyTabTasks,
                } as Record<string, string>
              )[name]
            }
          </button>
        ))}
      </div>
      <div className="study-tool-content">
        {!data ? (
          <ResourceState error={error} reload={reload} />
        ) : (
          <>
            <div hidden={tab !== 'summary'}>
              <ClassroomSummary
                id={id}
                study={data}
                language={detail.course.assistanceLanguage}
                live={
                  recording?.lectureId === id ||
                  (live?.lectureId === id && live.active)
                }
                blocked={busy || !!job || !!live?.active || !!recording}
                canGenerate={!!onAI}
                onSeek={onSeek}
                onSaved={refresh}
                onAppend={(body) => {
                  setAppend({ key: crypto.randomUUID(), body });
                  setTab('notes');
                }}
              />
            </div>
            <div hidden={tab !== 'notes'}>
              <StudyNotes
                append={append}
                id={id}
                note={detail.note}
                study={data}
                position={position}
                onSeek={onSeek}
                onSaved={refresh}
                onGenerate={onAI ? () => onAI('notes') : undefined}
                blocked={busy || !!job || !!live?.active}
              />
              {onAI && (
                <DeepReview
                  id={id}
                  reviews={data.reviews}
                  blocked={
                    busy ||
                    !!job ||
                    !!live?.active ||
                    !!recording ||
                    !detail.segments.length
                  }
                  onSaved={refresh}
                />
              )}
            </div>
            {tab === 'index' && (
              <>
                <h2>{ui.studyMarksTitle}</h2>
                <form
                  className="mark-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api.saveMark(id, position, label, kind);
                      setLabel('');
                      await reload();
                    });
                  }}
                >
                  <span className="pill">{clock(position)}</span>
                  <select
                    aria-label={ui.studyMarkTypeLabel}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                  >
                    <option value="bookmark">{ui.studyMarkBookmark}</option>
                    <option value="chapter">{ui.studyMarkChapter}</option>
                  </select>
                  <input
                    aria-label={ui.studyMarkNameLabel}
                    placeholder={ui.studyMarkNamePlaceholder}
                    value={label}
                    maxLength={150}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                  />
                  <button className="button primary" disabled={busy}>
                    {ui.studyAddMark}
                  </button>
                </form>
                <div className="study-mark-list">
                  {data.marks.map((mark) => (
                    <div className="study-mark" key={mark.id}>
                      <button
                        className="text-button"
                        disabled={!onSeek}
                        onClick={() => onSeek?.(mark.seconds)}
                      >
                        {clock(mark.seconds)}
                      </button>
                      <div>
                        <small>
                          {mark.kind === 'chapter'
                            ? ui.studyMarkChapter
                            : ui.studyMarkBookmark}
                        </small>
                        <strong>{mark.label}</strong>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={ui.studyRemoveMarkLabel(mark.label)}
                        onClick={() =>
                          void run(async () => {
                            await api.deleteMark(id, mark.id);
                            await reload();
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {tab === 'slides' && (
              <Suspense fallback={<p>{ui.studyLoadingPdfReader}</p>}>
                <PdfPanel
                  courseId={detail.course.id}
                  documents={data.documents}
                  onAttach={() =>
                    void run(async () => {
                      await api.attachDocument(detail.course.id);
                      await reload();
                    })
                  }
                />
              </Suspense>
            )}
            {tab === 'questions' && questions}
            {tab === 'tasks' && (
              <>
                <h2>{ui.studyTasksTitle}</h2>
                <p className="notice">
                  {detail.lecture.status === 'recording'
                    ? ui.studyTasksRecordingInProgress
                    : detail.lecture.durationSeconds > 0
                      ? ui.studyTasksRecordingSaved
                      : ui.studyTasksNoRecording}
                </p>
                {detail.lecture.transcribedUntil <
                  detail.lecture.durationSeconds - 0.1 && (
                  <p className="notice warning">
                    {ui.studyTasksUntranscribedRange(
                      clock(detail.lecture.transcribedUntil),
                      clock(detail.lecture.durationSeconds),
                    )}
                  </p>
                )}
                {untranslatedCount > 0 && (
                  <p className="field-hint">
                    {ui.studyTasksUntranslatedCount(untranslatedCount)}
                  </p>
                )}
                {data.tasks.length ? (
                  data.tasks.map((task) => (
                    <article className="task-row" key={task.id}>
                      <div>
                        <strong>
                          {taskName(task.kind)} · {languageName(task.language)}
                        </strong>
                        <span className={'task-state ' + task.state}>
                          {taskStateName(task.state)}
                        </span>
                        <p>
                          {task.total
                            ? `${task.completed} / ${task.total}`
                            : ''}{' '}
                          {messageText(task.message)}
                        </p>
                      </div>
                      {['failed', 'cancelled', 'interrupted'].includes(
                        task.state,
                      ) &&
                        onAI &&
                        [
                          'transcription',
                          'translation',
                          'notes',
                          'live-captions',
                        ].includes(task.kind) && (
                          <button
                            className="button secondary"
                            disabled={busy || !!job || !!live?.active}
                            onClick={() =>
                              onAI(
                                task.kind === 'live-captions'
                                  ? 'transcription'
                                  : (task.kind as
                                      | 'transcription'
                                      | 'translation'
                                      | 'notes'),
                              )
                            }
                          >
                            {ui.tryAgain}
                          </button>
                        )}
                    </article>
                  ))
                ) : (
                  <p>{ui.studyTasksEmpty}</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
