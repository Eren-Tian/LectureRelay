import { LibraryPanel } from '../library/LibraryPanel';
import { ui } from '../../i18n';
import { Icon } from '../../components/Icon';
import { languageName, subjectName } from '../../lib/presentation';
import { useWorkspace } from '../../app/Workspace';
import type { Course } from '../../types/domain';

export function CoursesPage({ onCreate }: { onCreate: () => void }) {
  const { data, navigate } = useWorkspace();
  const active = data.courses.filter((course) => !course.archived),
    archived = data.courses.filter((course) => course.archived);
  const lectures = (courses: typeof data.courses) =>
      courses.reduce((sum, course) => sum + course.lectureCount, 0),
    count = lectures(data.courses);
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{ui.courses}</h1>
          <p>{ui.courseLibrarySummary(active.length, lectures(active))}</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Icon name="plus" />
          {ui.newCourse}
        </button>
      </header>
      {(!count || data.settings.speechProvider === 'none') && (
        <section className="notice setup-welcome">
          <div>
            <strong>{ui.welcomeTitle}</strong>
            <p>{ui.welcomeBody}</p>
          </div>
          <button
            className="button secondary"
            onClick={() => navigate({ view: 'settings', entry: 'setup' })}
          >
            {ui.completeFirstTimeSetup}
          </button>
        </section>
      )}
      {active.length ? (
        <div className="course-grid">
          {active.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              tone={index % 4}
              open={() => navigate({ view: 'course', id: course.id })}
            />
          ))}
        </div>
      ) : (
        !archived.length && (
          <div className="empty-state inline-empty">
            <Icon name="books" size={30} />
            <h3>{ui.noCoursesTitle}</h3>
            <p>{ui.noCoursesBody}</p>
          </div>
        )
      )}
      {archived.length > 0 && (
        <details className="archived-courses">
          <summary>{ui.archivedCourses(archived.length)}</summary>
          <div className="course-grid">
            {archived.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                open={() => navigate({ view: 'course', id: course.id })}
              />
            ))}
          </div>
        </details>
      )}
      <LibraryPanel />
    </>
  );
}

function CourseCard({
  course,
  tone,
  open,
}: {
  course: Course;
  /** Colour band of an active course; archived courses have none. */
  tone?: number;
  open: () => void;
}) {
  return (
    <button
      className={`course-card ${tone === undefined ? 'archived' : `tone-${tone}`}`}
      onClick={open}
    >
      <div className="course-card-top">
        <span className="course-symbol">
          <Icon name="books" size={26} />
        </span>
        <span className="pill">
          {ui.englishTo}
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
          {course.lectureCount} {ui.lectureCountSuffix}
        </span>
        <Icon name="arrow" />
      </div>
    </button>
  );
}
