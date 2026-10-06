import { useState } from 'react';
import { api, pruneDeletedDrafts } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { Icon } from '../../components/Icon';
import { ui } from '../../i18n';
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
        ? ui.storageRefreshWarning
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
        <h3>{ui.storageLectureDataTitle}</h3>
        <StorageUsage key={storageRevision} />
        <dl className="storage-list">
          <div>
            <dt>{ui.storageLibraryLabel}</dt>
            <dd>{workspace.data.storage.library}</dd>
          </div>
          <div>
            <dt>{ui.storageExportsLabel}</dt>
            <dd>{workspace.data.storage.exports}</dd>
          </div>
        </dl>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => void run(() => api.openFolder('library'))}
          >
            <Icon name="folder" size={16} />
            {ui.storageOpenLibraryFolder}
          </button>
          <button
            className="button text"
            onClick={() => void run(() => api.openFolder('exports'))}
          >
            {ui.storageOpenExportsFolder}
          </button>
        </div>
        <details className="settings-advanced">
          <summary>{ui.storageLocationsSummary}</summary>
          <dl className="storage-list">
            <div>
              <dt>{ui.storageDatabaseLabel}</dt>
              <dd>{workspace.data.storage.database}</dd>
            </div>
            <div>
              <dt>{ui.storageAppDataLabel}</dt>
              <dd>{workspace.data.storage.state}</dd>
            </div>
          </dl>
          <p className="field-hint">{ui.storageBackupHint}</p>
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
        <h2>{ui.storageFreeAllTitle}</h2>
        <p>{ui.storageFreeAllBody}</p>
        <p className="field-hint">{ui.storageFreeAllKeepsHint}</p>
        <button
          className="button danger"
          disabled={blocked}
          onClick={() =>
            void run(async () => {
              if (
                !(await workspace.confirm({
                  title: ui.storageFreeAllConfirmTitle,
                  body: ui.storageFreeAllConfirmBody,
                  action: ui.storageFreeAllConfirmAction,
                  danger: true,
                  confirmationText: ui.storageFreeAllConfirmationPhrase,
                }))
              )
                return;
              try {
                await api.freeAllStorage('DELETE ALL');
              } finally {
                await refreshAfterCleanup();
              }
              workspace.notify(ui.storageFreeAllDone);
            })
          }
        >
          {ui.storageFreeAllButton}
        </button>
      </section>
    </>
  );
}
