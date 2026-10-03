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
    [title, setTitle] = useState('Imported lecture');
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
        Import media
      </button>
      {open && (
        <Modal title="Import a lecture" onClose={close}>
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
              Course
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
              Lecture title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
                disabled={busy}
              />
            </label>
            <p className="field-hint">
              WAV, MP3, M4A, MP4 audio, FLAC or OGG · up to 2 GiB / 5 hours. A
              local audio copy is created. Your original stays unchanged.
              Transcription is a separate step.
            </p>
            <div className="form-actions">
              {busy ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void api.cancelJob()}
                >
                  Cancel import
                </button>
              ) : (
                <button
                  type="button"
                  className="button secondary"
                  onClick={close}
                >
                  Cancel
                </button>
              )}
              <button className="button primary" disabled={busy || !course}>
                {busy ? 'Importing…' : 'Choose file'}
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
        <h2>Lecture library</h2>
        <ImportMedia />
      </div>
      <label className="library-search">
        <Icon name="search" size={17} />
        <input
          type="search"
          aria-label="Search all lectures"
          placeholder="Search courses, lectures or transcript text"
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
                      ? 'Import failed'
                      : 'Recording did not start'}
                  </span>
                )}
              </button>
              <button
                className={`icon-button pin-button ${pinned ? 'pinned' : ''}`}
                aria-label={pinned ? 'Unpin lecture' : 'Pin lecture'}
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
            ? 'No matching lectures.'
            : 'Record or import your first lecture.'}
        </p>
      )}
    </section>
  );
}
