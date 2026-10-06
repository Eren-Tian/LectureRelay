import { api, pruneDeletedDrafts } from '../../api/client';
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
      aria-label={`删除课堂记录：${lecture.title}`}
      title={
        blocked
          ? '请先结束录音和 AI 处理，再删除课堂记录。'
          : '永久删除这节课堂记录'
      }
      onClick={() =>
        void run(async () => {
          if (
            !(await workspace.confirm({
              title: '永久删除这节课堂记录？',
              body: `将永久删除“${lecture.title}”及其录音、转录、笔记、复习指南和应用内导出文件。课程、术语表、PDF 及其他课堂记录会保留。删除后无法恢复。`,
              action: '删除课堂记录',
              danger: true,
              confirmationText: '删除',
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
          workspace.notify('课堂记录已删除。');
        })
      }
    >
      <Icon name="trash" size={16} />
      {busy ? '正在删除…' : '删除课堂记录'}
    </button>
  );
}
