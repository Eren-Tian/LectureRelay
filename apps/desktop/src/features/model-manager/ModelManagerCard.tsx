import { messageText } from '../../i18n/messages';
import { ui } from '../../i18n';
import type { ModelStatus } from '../../types/domain';
import { api, errorText } from '../../api/client';
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
    ? ui.modelSpeechTitle
    : translation
      ? ui.modelTranslationTitle
      : ui.modelStudyTitle;
  const hint = speech
    ? ui.modelSpeechHint
    : translation
      ? ui.modelTranslationHint
      : ui.modelStudyHint;
  return (
    <section className="settings-card">
      <div className="settings-title">
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <span className="pill">
          {!model
            ? ui.checking
            : model.downloading
              ? model.downloadedBytes === 0
                ? ui.modelConnecting
                : ui.modelDownloading
              : model.installed
                ? ui.downloaded
                : ui.modelNotDownloaded}
        </span>
      </div>
      {model && (
        <>
          <p className="model-name">
            {model.name} · {Math.round(model.sizeBytes / 1048576)} MiB ·{' '}
            {model.license}
          </p>
          <details className="settings-advanced">
            <summary>{ui.modelDetailsSummary}</summary>
            <p className="field-hint">
              {model.runtimeVersion} · {model.revision.slice(0, 7)}
            </p>
            <p className="field-hint">{ui.modelLoadingHint}</p>
          </details>
        </>
      )}
      {model?.downloading && (
        <>
          <progress max={model.sizeBytes} value={model.downloadedBytes} />
          <p>
            {model.downloadedBytes === 0
              ? ui.modelConnectingHint
              : `${Math.round(model.downloadedBytes / 1048576)} / ${Math.round(model.sizeBytes / 1048576)} MiB`}
          </p>
          <button
            className="text-button"
            onClick={() =>
              void api
                .cancelModel()
                .catch((error) => workspace.notify(errorText(error), true))
            }
          >
            {ui.cancelDownload}
          </button>
        </>
      )}
      {model?.error && (
        <p role="alert" className="audio-warning">
          {messageText(model.error)}
        </p>
      )}
      {!model?.downloading && (
        <button
          className="button secondary"
          disabled={blocked || !model}
          onClick={() =>
            void run(async () => {
              if (!model) return;
              try {
                if (model.installed) {
                  if (
                    !(await workspace.confirm({
                      title: ui.removeModel,
                      body: ui.modelRemoveConfirmBody,
                      action: ui.removeModel,
                    }))
                  )
                    return;
                  if (speech) await api.removeModel();
                  else await api.removeTextModel(model.id);
                } else {
                  // Native announces Connecting after reserving the download slot.
                  // Offer cancellation only after that acknowledgement to avoid
                  // racing the manager's cancellation reset at startup.
                  setModel({ ...model, error: null });
                  if (speech) await api.downloadModel();
                  else await api.downloadTextModel(model.id);
                }
              } catch (error) {
                setModel({
                  ...model,
                  downloading: false,
                  error: errorText(error),
                });
                throw error;
              }
              // A failed refresh must not overwrite the native completion event
              // with the model state captured before downloading or removal.
              const next = speech
                ? await api.localModel()
                : (await api.textModels()).find((m) => m.id === model.id);
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
