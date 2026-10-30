import { ui } from '../../i18n';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useResource } from '../../hooks/useResource';
import { useAction } from '../../hooks/useAction';
import { clock, dateText, transcriptionLabel } from '../../lib/presentation';
import { ResourceState } from '../../components/ResourceState';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { fileName, fileStem, isMediaPath, useMediaDrop } from './useMediaDrop';

export function ImportMedia({
  courseId,
  onDone,
}: {
  courseId?: string;
  onDone?: () => void;
}) {
  const { data, navigate, notify, refresh, recording, job, live } =
    useWorkspace();
  const [open, setOpen] = useState(false),
    [course, setCourse] = useState(courseId ?? data.courses[0]?.id ?? ''),
    [title, setTitle] = useState(ui.mediaImportDefaultTitle),
    // The file name of a dropped file; the native side holds its path.
    [dropped, setDropped] = useState('');
  const { busy, run } = useAction();
  const unavailable =
    !data.courses.length || !!recording || !!job || !!live?.active;
  const close = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);
  const hovering = useMediaDrop(
    useCallback(
      (paths: string[]) => {
        if (unavailable || open) return;
        const media = paths.find(isMediaPath);
        if (!media) {
          notify(ui.mediaDropUnsupported, true);
          return;
        }
        setDropped(fileName(media));
        setTitle(fileStem(media) || ui.mediaImportDefaultTitle);
        setOpen(true);
      },
      [unavailable, open, notify],
    ),
  );
  return (
    <>
      {hovering && !unavailable && !open && (
        <div className="drop-overlay" aria-hidden="true">
          <Icon name="upload" size={34} />
          <strong>{ui.mediaDropHint}</strong>
        </div>
      )}
      <button
        className="button secondary"
        disabled={unavailable}
        onClick={() => {
          setDropped('');
          setOpen(true);
        }}
      >
        <Icon name="download" size={16} />
        {ui.importMedia}
      </button>
      {open && (
        <Modal title={ui.mediaImportTitle} onClose={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const lecture = dropped
                  ? await api.importDroppedMedia(course, title)
                  : await api.importMedia(course, title);
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
              {ui.mediaImportCourseLabel}
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
              {ui.lectureTitle}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
                disabled={busy}
              />
            </label>
            {dropped && (
              <p className="dropped-file">
                <Icon name="upload" size={16} />
                {dropped}
              </p>
            )}
            <p className="field-hint">{ui.mediaImportHint}</p>
            <div className="form-actions">
              {busy ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void api.cancelJob()}
                >
                  {ui.mediaImportCancel}
                </button>
              ) : (
                <button
                  type="button"
                  className="button secondary"
                  onClick={close}
                >
                  {ui.cancel}
                </button>
              )}
              <button className="button primary" disabled={busy || !course}>
                {busy
                  ? ui.mediaImportImporting
                  : dropped
                    ? ui.mediaImportStart
                    : ui.mediaImportChooseFile}
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
        <h2>{ui.libraryHeading}</h2>
        <ImportMedia />
      </div>
      <label className="library-search">
        <Icon name="search" size={17} />
        <input
          type="search"
          aria-label={ui.librarySearchLabel}
          placeholder={ui.librarySearchPlaceholder}
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
                  {transcriptionLabel(lecture) && (
                    <span className="pill quiet">
                      {transcriptionLabel(lecture)}
                    </span>
                  )}
                </span>
                {lecture.status === 'failed' && (
                  <span className="danger-text">
                    {lecture.audioSource === 'import'
                      ? ui.importFailed
                      : ui.recordingDidNotStart}
                  </span>
                )}
              </button>
              <button
                className={`icon-button pin-button ${pinned ? 'pinned' : ''}`}
                aria-label={pinned ? ui.libraryUnpinLabel : ui.libraryPinLabel}
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
          {query ? ui.libraryNoMatches : ui.libraryEmpty}
        </p>
      )}
    </section>
  );
}
