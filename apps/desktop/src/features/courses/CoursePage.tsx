import { ImportMedia } from '../library/LibraryPanel';
import { CourseGlossaryEditor } from '../glossary/CourseGlossaryEditor';
import { ui } from '../../i18n';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { clock, dateText, languageName } from '../../lib/presentation';
import { Icon } from '../../components/Icon';
import { ResourceState } from '../../components/ResourceState';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { useWorkspace } from '../../app/Workspace';
import { CourseForm } from './CourseForm';
import { StartLecture } from '../live-lecture/StartLecture';

export function CoursePage({ id }: { id: string }) {
  const workspace = useWorkspace();
  const load = useCallback(() => api.course(id), [id]);
  const { data, error, reload } = useResource(load);
  const [edit, setEdit] = useState(false);
  const [start, setStart] = useState(false);
  const { busy, run } = useAction();
  useEffect(() => {
    void reload();
  }, [reload]);
  const closeEdit = useCallback(() => {
    setEdit(false);
    void reload();
  }, [reload]);
  const closeStart = useCallback(() => {
    setStart(false);
    void reload();
  }, [reload]);
  if (!data) return <ResourceState error={error} reload={reload} />;
  const course = data.course;
  const removeCourse = async () => {
    if (
      await workspace.confirm({
        title: ui.s050,
        body: ui.s051,
        action: ui.s052,
        danger: true,
      })
    ) {
      void run(async () => {
        await api.deleteCourse(id);
        await workspace.refresh();
        workspace.navigate({ view: 'courses' });
      }, ui.s053);
    }
  };
  return (
    <>
      <button
        className="breadcrumb"
        onClick={() => workspace.navigate({ view: 'courses' })}
      >
        <Icon name="back" size={16} />
        {ui.s054}
      </button>
      <header className="page-heading">
        <div>
          <div className="eyebrow">{course.code || course.subject}</div>
          <h1>{course.name}</h1>
          <div className="heading-meta">
            <span className="pill">
              English → {languageName(course.assistanceLanguage)}
            </span>
            <span>
              {data.lectures.length} {ui.s055}
            </span>
          </div>
        </div>
        <div className="button-row">
          <ImportMedia courseId={id} onDone={() => void reload()} />
          <button
            className="icon-button bordered"
            aria-label={ui.s056}
            onClick={() => setEdit(true)}
          >
            <Icon name="edit" />
          </button>
          <button
            className="button primary"
            disabled={
              !!workspace.recording ||
              !!workspace.job ||
              !!workspace.live?.active
            }
            onClick={() => setStart(true)}
          >
            <Icon name="mic" />
            {ui.s057}
          </button>
        </div>
      </header>
      {course.description && (
        <p className="course-description">{course.description}</p>
      )}
      <div className="course-detail-grid">
        <section>
          <div className="section-heading">
            <h2>{ui.s058}</h2>
          </div>
          {data.lectures.length ? (
            <div className="lecture-list">
              {data.lectures.map((lecture) => (
                <button
                  className="lecture-row"
                  key={lecture.id}
                  onClick={() =>
                    workspace.navigate({
                      view: lecture.status === 'recording' ? 'live' : 'lecture',
                      id: lecture.id,
                    })
                  }
                >
                  <span className="lecture-symbol">
                    <Icon name="mic" />
                  </span>
                  <div>
                    <h3>{lecture.title}</h3>
                    <p>
                      {dateText(lecture.startedAt)} ·{' '}
                      {clock(lecture.durationSeconds)}
                    </p>
                  </div>
                  <span
                    className={`pill ${lecture.status === 'interrupted' || lecture.status === 'failed' ? 'gold' : ''}`}
                  >
                    {lecture.status === 'completed'
                      ? ui.s060
                      : lecture.status === 'interrupted'
                        ? ui.s061
                        : lecture.status === 'failed'
                          ? lecture.audioSource === 'import'
                            ? 'Import failed'
                            : ui.s062
                          : ui.s063}
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state paper">
              <h3>{ui.s064}</h3>
              <p>{ui.s065}</p>
              <button
                className="button primary"
                disabled={
                  !!workspace.recording ||
                  !!workspace.job ||
                  !!workspace.live?.active
                }
                onClick={() => setStart(true)}
              >
                {ui.s066}
              </button>
            </div>
          )}
        </section>
        <CourseGlossaryEditor
          course={course}
          terms={data.glossary}
          reload={reload}
          busy={busy}
          run={run}
        />
      </div>
      <button
        className="text-button danger-text course-delete"
        onClick={() => void removeCourse()}
        disabled={busy || !!workspace.live?.active}
      >
        <Icon name="trash" size={16} />
        {ui.s079}
      </button>
      {edit && <CourseForm course={course} onClose={closeEdit} />}
      {start && <StartLecture course={course} onClose={closeStart} />}
    </>
  );
}
