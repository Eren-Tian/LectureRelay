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
import { clock } from '../../lib/presentation';
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
  const { job, live } = useWorkspace(),
    { busy, run } = useAction();
  const id = detail.lecture.id;
  const load = useCallback(() => api.study(id), [id]);
  const { data, error, reload } = useResource(load);
  const [tab, setTab] = useState('notes'),
    [label, setLabel] = useState(''),
    [kind, setKind] = useState<'bookmark' | 'chapter'>('bookmark');
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
    if (!live?.active) return;
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [live?.active, reload]);
  const refresh = async () => {
    await reload();
    await onReload();
  };
  return (
    <section className="study-tools">
      <div className="study-tabs" role="tablist" aria-label="Study tools">
        {[
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
                  notes: 'Notes',
                  index: 'Index',
                  slides: 'Slides',
                  questions: 'Q&A',
                  tasks: 'Processing',
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
            <div hidden={tab !== 'notes'}>
              <StudyNotes
                id={id}
                note={detail.note}
                study={data}
                position={position}
                onSeek={onSeek}
                onSaved={refresh}
                onGenerate={onAI ? () => onAI('notes') : undefined}
                blocked={busy || !!job || !!live?.active}
              />
            </div>
            {tab === 'index' && (
              <>
                <h2>Moments to return to</h2>
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
                    aria-label="Index type"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                  >
                    <option value="bookmark">Bookmark</option>
                    <option value="chapter">Chapter</option>
                  </select>
                  <input
                    aria-label="Bookmark label"
                    placeholder="What matters here?"
                    value={label}
                    maxLength={150}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                  />
                  <button className="button primary" disabled={busy}>
                    Add
                  </button>
                </form>
                <p className="field-hint">
                  Chapters are your own labels for recorded moments.
                </p>
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
                        <small>{mark.kind}</small>
                        <strong>{mark.label}</strong>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={'Remove ' + mark.label}
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
              <Suspense fallback={<p>Loading PDF reader…</p>}>
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
                <h2>Recording & processing</h2>
                <p className="notice">
                  {detail.lecture.status === 'recording'
                    ? 'Audio is being saved on this device.'
                    : detail.lecture.durationSeconds > 0
                      ? 'Audio saved. AI processing can be retried separately.'
                      : 'No completed audio is available for this attempt.'}
                </p>
                {detail.lecture.transcribedUntil <
                  detail.lecture.durationSeconds - 0.1 && (
                  <p className="notice warning">
                    Transcription is incomplete from{' '}
                    {clock(detail.lecture.transcribedUntil)} to{' '}
                    {clock(detail.lecture.durationSeconds)}.
                  </p>
                )}
                <p className="field-hint">
                  {detail.segments.filter((s) => !s.translatedText).length}{' '}
                  segments need translation. Restarting the app never
                  automatically sends a paid request.
                </p>
                {data.tasks.length ? (
                  data.tasks.map((task) => (
                    <article className="task-row" key={task.id}>
                      <div>
                        <strong>
                          {task.kind.replaceAll('-', ' ')} ·{' '}
                          {task.language.toUpperCase()}
                        </strong>
                        <span className={'task-state ' + task.state}>
                          {task.state}
                        </span>
                        <p>
                          {task.total
                            ? `${task.completed} / ${task.total}`
                            : ''}{' '}
                          {task.message}
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
                            Retry
                          </button>
                        )}
                    </article>
                  ))
                ) : (
                  <p>No background processing yet.</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
