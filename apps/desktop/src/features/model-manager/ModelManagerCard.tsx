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
    ? '英文转录'
    : translation
      ? '英文 → 中文 / 日语 / 韩语'
      : '课堂总结与深度复习';
  const hint = speech
    ? 'Nemotron 在上课时运行，英文识别无需支付 API 费用。'
    : translation
      ? 'Hy-MT2 在本机翻译已定稿的句子。翻译效果和速度受课程内容与电脑性能影响。'
      : '总结、整堂复习和问答共用 Qwen，待录音和实时处理结束后才会加载。';
  return (
    <section className="settings-card">
      <div className="settings-title">
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <span className="pill">
          {!model
            ? '正在检查…'
            : model.downloading
              ? model.downloadedBytes === 0
                ? '正在连接…'
                : '正在下载'
              : model.installed
                ? '已下载'
                : '未下载'}
        </span>
      </div>
      {model && (
        <>
          <p className="model-name">
            {model.name} · {Math.round(model.sizeBytes / 1048576)} MiB ·{' '}
            {model.license}
          </p>
          <details className="settings-advanced">
            <summary>{'模型信息'}</summary>
            <p className="field-hint">
              {model.runtimeVersion} · {model.revision.slice(0, 7)}
            </p>
            <p className="field-hint">
              {
                '模型按需加载，任务结束后释放。安静模式对所有本地 AI 生效，无需登录或 API Key。'
              }
            </p>
          </details>
        </>
      )}
      {model?.downloading && (
        <>
          <progress max={model.sizeBytes} value={model.downloadedBytes} />
          <p>
            {model.downloadedBytes === 0
              ? '正在连接下载服务，等待期间可以取消。'
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
                      body: '删除已下载的模型？录音、转录和笔记会保留，之后可以重新下载模型。',
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
