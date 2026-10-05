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
      <div className="study-tabs" role="tablist" aria-label="学习工具">
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
                  summary: '课堂要点',
                  notes: '我的笔记',
                  index: '时间索引',
                  slides: '讲义',
                  questions: '问答',
                  tasks: '处理进度',
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
                <h2>{'标记值得回顾的片段'}</h2>
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
                    aria-label="标记类型"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                  >
                    <option value="bookmark">{'书签'}</option>
                    <option value="chapter">{'章节'}</option>
                  </select>
                  <input
                    aria-label="标记名称"
                    placeholder="这个片段讲了什么？"
                    value={label}
                    maxLength={150}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                  />
                  <button className="button primary" disabled={busy}>
                    {'添加'}
                  </button>
                </form>
                <p className="field-hint">
                  {'用章节为课堂片段命名，方便之后回顾。'}
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
                        <small>
                          {mark.kind === 'chapter' ? '章节' : '书签'}
                        </small>
                        <strong>{mark.label}</strong>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={'移除 ' + mark.label}
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
              <Suspense fallback={<p>{'正在加载 PDF 阅读器…'}</p>}>
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
                <h2>{'录音与处理进度'}</h2>
                <p className="notice">
                  {detail.lecture.status === 'recording'
                    ? '录音正在保存到本机。'
                    : detail.lecture.durationSeconds > 0
                      ? '录音已保存，AI 处理可以单独重试。'
                      : '本次操作没有生成可用录音。'}
                </p>
                {detail.lecture.transcribedUntil <
                  detail.lecture.durationSeconds - 0.1 && (
                  <p className="notice warning">
                    {'尚未转录的时间范围：'}{' '}
                    {clock(detail.lecture.transcribedUntil)} 至{' '}
                    {clock(detail.lecture.durationSeconds)}
                  </p>
                )}
                <p className="field-hint">
                  {detail.segments.filter((s) => !s.translatedText).length}{' '}
                  {'段尚未翻译。重启应用不会自动发起付费请求。'}
                </p>
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
                            {'重试'}
                          </button>
                        )}
                    </article>
                  ))
                ) : (
                  <p>{'暂无后台处理任务。'}</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
