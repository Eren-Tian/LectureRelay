import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useResource } from '../../hooks/useResource';
import { useAction } from '../../hooks/useAction';
import { clock, dateText } from '../../lib/presentation';
import { ResourceState } from '../../components/ResourceState';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';

export function ImportMedia({
  courseId,
  onDone,
}: {
  courseId?: string;
  onDone?: () => void;
}) {
  const { data, navigate, refresh, recording, job, live } = useWorkspace();
  const [open, setOpen] = useState(false),
    [course, setCourse] = useState(courseId ?? data.courses[0]?.id ?? ''),
    [title, setTitle] = useState('导入的课堂记录');
  const { busy, run } = useAction();
  const close = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);
  return (
    <>
      <button
        className="button secondary"
        disabled={
          !data.courses.length || !!recording || !!job || !!live?.active
        }
        onClick={() => setOpen(true)}
      >
        <Icon name="download" size={16} />
        {'导入音视频'}
      </button>
      {open && (
        <Modal title="导入课堂录音" onClose={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const lecture = await api.importMedia(course, title);
                if (lecture) {
                  await refresh();
                  setOpen(false);
                  onDone?.();
                  navigate({ view: 'lecture', id: lecture.id });
                }
              });
            }}
          >
            <label>
              {'课程'}
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                disabled={busy}
              >
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {'本节课标题'}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
                disabled={busy}
              />
            </label>
            <p className="field-hint">
              {
                '支持 WAV、MP3、M4A、MP4、FLAC 和 OGG，最大 2 GiB、最长 5 小时。应用会保存一份音频副本，保留原文件；导入后可另行转录。'
              }
            </p>
            <div className="form-actions">
              {busy ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void api.cancelJob()}
                >
                  {'取消导入'}
                </button>
              ) : (
                <button
                  type="button"
                  className="button secondary"
                  onClick={close}
                >
                  {'取消'}
                </button>
              )}
              <button className="button primary" disabled={busy || !course}>
                {busy ? '正在导入…' : '选择文件'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function LibraryPanel() {
  const workspace = useWorkspace();
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState('');
  const { run } = useAction();
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 220);
    return () => clearTimeout(timer);
  }, [query]);
  const load = useCallback(() => api.library(search), [search]);
  const { data, error, reload } = useResource(load);
  useEffect(() => {
    void reload();
  }, [reload, workspace.data.courses]);
  return (
    <section className="library-panel">
      <div className="section-heading">
        <h2>{'课堂记录'}</h2>
        <ImportMedia />
      </div>
      <label className="library-search">
        <Icon name="search" size={17} />
        <input
          type="search"
          aria-label="搜索全部课堂记录"
          placeholder="搜索课程、课堂标题或转录内容"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {!data ? (
        <ResourceState error={error} reload={reload} />
      ) : data.length ? (
        <div className="library-grid">
          {data.map(({ lecture, courseName, pinned }) => (
            <article className="library-card" key={lecture.id}>
              <button
                className="library-open"
                onClick={() =>
                  workspace.navigate({
                    view: lecture.status === 'recording' ? 'live' : 'lecture',
                    id: lecture.id,
                  })
                }
              >
                <span className="course-subject">{courseName}</span>
                <h3>{lecture.title}</h3>
                <span className="library-meta">
                  {clock(lecture.durationSeconds)}
                  <span>{dateText(lecture.startedAt)}</span>
                </span>
                {lecture.status === 'failed' && (
                  <span className="danger-text">
                    {lecture.audioSource === 'import'
                      ? '导入失败'
                      : '录音未能开始'}
                  </span>
                )}
              </button>
              <button
                className={`icon-button pin-button ${pinned ? 'pinned' : ''}`}
                aria-label={pinned ? '取消置顶' : '置顶课堂记录'}
                aria-pressed={pinned}
                onClick={() =>
                  void run(async () => {
                    await api.pin(lecture.id, !pinned);
                    await reload();
                  })
                }
              >
                {pinned ? '★' : '☆'}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          {query
            ? '没有找到匹配的课堂记录。'
            : '录制或导入一节课，开始积累你的课堂记录。'}
        </p>
      )}
    </section>
  );
}
