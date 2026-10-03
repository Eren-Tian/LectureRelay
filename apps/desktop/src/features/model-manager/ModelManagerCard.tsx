import { ui } from '../../i18n';
import type { ModelStatus } from '../../types/domain';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import type { ActionRunner } from '../../hooks/useAction';

export function ModelManagerCard({
  model,
  blocked,
  run,
  setModel,
}: {
  model: ModelStatus | undefined;
  blocked: boolean | undefined;
  run: ActionRunner;
  setModel: (model: ModelStatus) => void;
}) {
  const workspace = useWorkspace();
  return (
    <section className="settings-card">
      <div className="settings-title">
        <div>
          <h3>Local English speech</h3>
          <p>Private recognition. No per-minute speech charges.</p>
        </div>
        <span className="pill">
          {!model
            ? 'Checking…'
            : model.downloading
              ? 'Downloading'
              : model.installed
                ? 'Ready'
                : 'Not downloaded'}
        </span>
      </div>
      {model && (
        <>
          <p className="model-name">
            {model.name} · {Math.round(model.sizeBytes / 1048576)} MiB ·{' '}
            {model.license}
          </p>
          <details className="settings-advanced">
            <summary>Model details</summary>
            <p className="field-hint">
              {model.runtimeVersion} · {model.revision.slice(0, 7)}
            </p>
            <p className="field-hint">{ui.modelHint}</p>
          </details>
        </>
      )}
      {model?.downloading && (
        <>
          <progress max={model.sizeBytes} value={model.downloadedBytes} />
          <p>
            {Math.round(model.downloadedBytes / 1048576)} /{' '}
            {Math.round(model.sizeBytes / 1048576)} MiB
          </p>
          <button
            className="text-button"
            onClick={() => void api.cancelModel()}
          >
            {ui.cancelDownload}
          </button>
        </>
      )}
      {model?.error && (
        <p role="alert" className="audio-warning">
          {model.error}
        </p>
      )}
      {!model?.downloading && (
        <button
          className="button secondary"
          disabled={blocked || !model}
          onClick={() =>
            void run(async () => {
              if (model?.installed) {
                if (
                  !(await workspace.confirm({
                    title: ui.removeModel,
                    body: ui.modelHint,
                    action: ui.removeModel,
                  }))
                )
                  return;
                await api.removeModel();
              } else await api.downloadModel();
              setModel(await api.localModel());
            })
          }
        >
          {model?.installed ? ui.removeModel : ui.download}
        </button>
      )}
    </section>
  );
}
