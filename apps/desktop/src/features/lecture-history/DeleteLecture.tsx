import { api, pruneDeletedDrafts } from '../../api/client';
import { ui } from '../../i18n';
import { useWorkspace } from '../../app/Workspace';
import { Icon } from '../../components/Icon';
import { useAction } from '../../hooks/useAction';
import type { Lecture } from '../../types/domain';

export function DeleteLecture({
  lecture,
  onDeleted,
  beforeDelete,
}: {
  lecture: Lecture;
  onDeleted?: () => void | Promise<void>;
  beforeDelete?: () => void | (() => void);
}) {
  const workspace = useWorkspace();
  const { busy, run } = useAction();
  const blocked =
    busy ||
    !!workspace.recording ||
    !!workspace.job ||
    !!workspace.live?.active;
  return (
    <button
      className="button text danger-text"
      disabled={blocked}
      aria-label={ui.deleteLectureLabel(lecture.title)}
      title={blocked ? ui.deleteLectureBlockedHint : ui.deleteLectureHint}
      onClick={() =>
        void run(async () => {
          if (
            !(await workspace.confirm({
              title: ui.deleteLectureTitle,
              body: ui.deleteLectureBody(lecture.title),
              action: ui.deleteLecture,
              danger: true,
              confirmationText: ui.deleteConfirmationPhrase,
            }))
          )
            return;
          const restorePlayback = beforeDelete?.();
          try {
            await api.permanentlyDeleteLecture(lecture.id, 'DELETE');
          } catch (error) {
            restorePlayback?.();
            throw error;
          } finally {
            await pruneDeletedDrafts();
            await workspace.refresh();
          }
          await onDeleted?.();
          workspace.notify(ui.lectureDeleted);
        })
      }
    >
      <Icon name="trash" size={16} />
      {busy ? ui.deleting : ui.deleteLecture}
    </button>
  );
}
