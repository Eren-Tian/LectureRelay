import { LibraryPanel } from '../library/LibraryPanel';
import { ui } from '../../i18n';
import { Icon } from '../../components/Icon';
import { languageName, subjectName } from '../../lib/presentation';
import { useWorkspace } from '../../app/Workspace';

export function CoursesPage({ onCreate }: { onCreate: () => void }) {
  const { data, navigate } = useWorkspace();
  const count = data.courses.reduce(
    (sum, course) => sum + course.lectureCount,
    0,
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{ui.s080}</h1>
          <p>{ui.s085(data.courses.length, count)}</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Icon name="plus" />
          {ui.s082}
        </button>
      </header>
      {(!count || data.settings.speechProvider === 'none') && (
        <section className="notice setup-welcome">
          <div>
            <strong>{'开始使用 LectureRelay'}</strong>
            <p>{'先设置字幕并测试声音，再创建课程、开始录音。'}</p>
          </div>
          <button
            className="button secondary"
            onClick={() => navigate({ view: 'settings', entry: 'setup' })}
          >
            {'完成首次设置'}
          </button>
        </section>
      )}
      {data.courses.length ? (
        <div className="course-grid">
          {data.courses.map((course, index) => (
            <button
              className={`course-card tone-${index % 4}`}
              key={course.id}
              onClick={() => navigate({ view: 'course', id: course.id })}
            >
              <div className="course-card-top">
                <span className="course-symbol">
                  <Icon name="books" size={26} />
                </span>
                <span className="pill">
                  {'英文 →'}
                  {languageName(course.assistanceLanguage)}
                </span>
              </div>
              <span className="course-subject">
                {course.code || subjectName(course.subject)}
              </span>
              <h3>{course.name}</h3>
              {course.description && <p>{course.description}</p>}
              <div className="course-card-bottom">
                <span>
                  {course.lectureCount} {ui.s092}
                </span>
                <Icon name="arrow" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state inline-empty">
          <Icon name="books" size={30} />
          <h3>{ui.s093}</h3>
          <p>{ui.s094}</p>
        </div>
      )}
      <LibraryPanel />
    </>
  );
}
