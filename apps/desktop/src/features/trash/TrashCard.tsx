import { ui } from '../../i18n';
import type { Course } from '../../types/domain';
import { api, pruneDeletedDrafts } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import type { ActionRunner } from '../../hooks/useAction';

export function TrashCard({
  trash,
  blocked,
  run,
  setTrash,
  onDeleted,
}: {
  trash: Course[];
  blocked: boolean | undefined;
  run: ActionRunner;
  setTrash: (courses: Course[]) => void;
  onDeleted: () => Promise<void>;
}) {
  const workspace = useWorkspace();
  return (
    <section className="settings-card">
      <div className="settings-title">
        <div>
          <h2>{ui.trash}</h2>
          <p>{ui.trashHint}</p>
        </div>
      </div>
      {trash.length ? (
        trash.map((course) => (
          <div className="credential-row" key={course.id}>
            <span>{course.name}</span>
            <button
              className="button secondary"
              disabled={blocked}
              onClick={() =>
                void run(async () => {
                  await api.restoreCourse(course.id);
                  setTrash(await api.trash());
                  await workspace.refresh();
                })
              }
            >
              {ui.restore}
            </button>
            <button
              className="button danger"
              disabled={blocked}
              onClick={() =>
                void run(async () => {
                  if (
                    !(await workspace.confirm({
                      title: ui.trashDeleteCourseTitle,
                      body: ui.trashDeleteCourseBody(
                        course.name,
                        course.lectureCount,
                      ),
                      action: ui.trashDeletePermanently,
                      danger: true,
                      confirmationText: ui.deleteConfirmationPhrase,
                    }))
                  )
                    return;
                  try {
                    await api.permanentlyDeleteCourse(course.id, 'DELETE');
                  } finally {
                    await pruneDeletedDrafts();
                    setTrash(await api.trash());
                    await workspace.refresh();
                    await onDeleted();
                  }
                  workspace.notify(ui.trashCourseDeleted);
                })
              }
            >
              {ui.trashDeletePermanently}
            </button>
          </div>
        ))
      ) : (
        <p>{ui.trashEmpty}</p>
      )}
    </section>
  );
}
