import { useState } from 'react';
import { api, pruneDeletedDrafts } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { Icon } from '../../components/Icon';
import type { ActionRunner } from '../../hooks/useAction';
import { TrashCard } from '../trash/TrashCard';
import { StorageUsage } from './StorageUsage';
import type { SettingsResources } from './useSettingsResources';

export function StorageSettings({
  resources,
  blocked,
  run,
}: {
  resources: Pick<
    SettingsResources,
    'trash' | 'setTrash' | 'setModel' | 'setTextModels'
  >;
  blocked: boolean;
  run: ActionRunner;
}) {
  const workspace = useWorkspace();
  const { trash, setTrash, setModel, setTextModels } = resources;
  const [storageRevision, setStorageRevision] = useState(0);
  const [refreshWarning, setRefreshWarning] = useState('');
  const refreshAfterCleanup = async () => {
    // Report refresh failures separately without replacing the cleanup error.
    const results = await Promise.allSettled([
      pruneDeletedDrafts(),
      api.trash().then(setTrash),
      api.localModel().then(setModel),
      api.textModels().then(setTextModels),
      workspace.refresh(),
    ]);
    setStorageRevision((current) => current + 1);
    setRefreshWarning(
      results.some((result) => result.status === 'rejected')
        ? '部分状态未能刷新，请重新打开设置核对。'
        : '',
    );
  };
  return (
    <>
      {refreshWarning && (
        <p role="alert" className="notice warning">
          {refreshWarning}
        </p>
      )}
      <section className="settings-card">
        <h3>{'课堂资料'}</h3>
        <StorageUsage key={storageRevision} />
        <dl className="storage-list">
          <div>
            <dt>{'资料库'}</dt>
            <dd>{workspace.data.storage.library}</dd>
          </div>
          <div>
            <dt>{'导出文件'}</dt>
            <dd>{workspace.data.storage.exports}</dd>
          </div>
        </dl>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => void run(() => api.openFolder('library'))}
          >
            <Icon name="folder" size={16} />
            {'打开资料库文件夹'}
          </button>
          <button
            className="button text"
            onClick={() => void run(() => api.openFolder('exports'))}
          >
            {'打开导出文件夹'}
          </button>
        </div>
        <details className="settings-advanced">
          <summary>{'存储位置'}</summary>
          <dl className="storage-list">
            <div>
              <dt>{'数据库'}</dt>
              <dd>{workspace.data.storage.database}</dd>
            </div>
            <div>
              <dt>{'应用数据'}</dt>
              <dd>{workspace.data.storage.state}</dd>
            </div>
          </dl>
          <p className="field-hint">
            {'备份时请同时保存资料库和数据库。转录与笔记可在课堂回放页导出。'}
          </p>
        </details>
      </section>
      <TrashCard
        trash={trash}
        blocked={blocked}
        run={run}
        setTrash={setTrash}
        onDeleted={async () => setStorageRevision((n) => n + 1)}
      />
      <section className="settings-card">
        <h2>{'清空课堂数据与模型'}</h2>
        <p>
          {
            '永久删除所有课程（含回收站）、录音、转录、笔记、复习指南、PDF、应用内导出文件、已下载模型及处理缓存。再次使用本地 AI 前需重新下载模型。'
          }
        </p>
        <p className="field-hint">
          {
            '应用、偏好设置和 Windows 凭据管理器中的 API Key 会保留，也会保留少量数据库和界面设置文件。应用之外的文件副本不会删除。'
          }
        </p>
        <button
          className="button danger"
          disabled={blocked}
          onClick={() =>
            void run(async () => {
              if (
                !(await workspace.confirm({
                  title: '清空全部课堂数据和模型？',
                  body: '所有课程（含回收站）、录音、转录、笔记、复习指南、PDF、应用内导出文件、本地模型和处理缓存都会永久删除，无法恢复。请先导出需要保留的内容。偏好设置和 API Key 会保留。',
                  action: '清空数据与模型',
                  danger: true,
                  confirmationText: '清空全部数据',
                }))
              )
                return;
              try {
                await api.freeAllStorage('DELETE ALL');
              } finally {
                await refreshAfterCleanup();
              }
              workspace.notify('课堂数据和模型已清空，存储空间已释放。');
            })
          }
        >
          {'清空课堂数据与模型…'}
        </button>
      </section>
    </>
  );
}
