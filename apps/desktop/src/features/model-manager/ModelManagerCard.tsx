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
  const speech = !model || model.id === 'nemotron-streaming';
  const translation = model?.id === 'hy-mt2-1.8b';
  const title = speech
    ? 'English transcription'
    : translation
      ? 'English → Chinese / Japanese / Korean'
      : 'Summary & deep review';
  const hint = speech
    ? 'Nemotron runs during class. No speech API charges.'
    : translation
      ? 'Hy-MT2 translates finalized sentences on this computer. Classroom quality and latency depend on the material and hardware.'
      : 'Qwen is shared by summaries, full-class review and Q&A. Loaded only after recording and live processing finish.';
  return (
    <section className="settings-card">
      <div className="settings-title">
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <span className="pill">
          {!model
            ? 'Checking…'
            : model.downloading
              ? 'Downloading'
              : model.installed
                ? 'Downloaded'
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
            <p className="field-hint">
              Loads when needed; released when the task ends. Quiet Mode applies
              to all local AI. No login or API key required.
            </p>
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
                    body: 'Remove this downloaded model? Your recordings, transcripts and notes remain saved. You can download the model again.',
                    action: ui.removeModel,
                  }))
                )
                  return;
                if (speech) await api.removeModel();
                else await api.removeTextModel(model.id);
              } else if (speech) await api.downloadModel();
              else if (model) await api.downloadTextModel(model.id);
              const next = speech
                ? await api.localModel()
                : (await api.textModels()).find((m) => m.id === model?.id);
              if (next) setModel(next);
            })
          }
        >
          {model?.installed ? ui.removeModel : ui.download}
        </button>
      )}
    </section>
  );
}
