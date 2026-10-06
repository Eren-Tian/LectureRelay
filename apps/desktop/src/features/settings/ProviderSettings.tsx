import { Icon } from '../../components/Icon';
import type { AppSettings, ProviderStatus } from '../../types/domain';
import type { SettingsSectionProps } from './settings-types';
export function ProviderSettings({
  settings,
  setSettings,
  blocked,
  providers,
  onKeys,
  onLocal,
}: SettingsSectionProps & {
  providers: ProviderStatus[];
  onKeys: (provider: 'openai' | 'groq') => void;
  onLocal: () => void;
}) {
  const hasKey = providers.some(
    (p) => p.provider === settings.provider && p.hasKey,
  );
  const speechHasKey = providers.some(
    (p) => p.provider === settings.speechProvider && p.hasKey,
  );
  return (
    <>
      <section className="settings-card">
        <h3>{'英文语音识别'}</h3>
        <label>
          {'语音识别'}
          <select
            disabled={blocked}
            value={settings.speechProvider}
            onChange={(e) =>
              setSettings({
                ...settings,
                speechProvider: e.target.value as AppSettings['speechProvider'],
              })
            }
          >
            <option value="local">{'本地英文识别 · 在本机运行'}</option>
            <option value="none">{'仅录音 · 不生成字幕'}</option>
            <option value="openai">{'OpenAI · 云端识别'}</option>
            <option value="groq">{'Groq · 云端识别'}</option>
          </select>
        </label>
        {settings.speechProvider === 'local' ? (
          <button className="button text" onClick={onLocal}>
            {'管理本地模型'}
            <Icon name="arrow" size={16} />
          </button>
        ) : (
          settings.speechProvider !== 'none' && (
            <button
              className="button text"
              onClick={() =>
                onKeys(settings.speechProvider as 'openai' | 'groq')
              }
            >
              {speechHasKey ? '管理 API Key' : '添加 API Key'}
            </button>
          )
        )}
      </section>
      <section className="settings-card">
        <h3>课堂翻译</h3>
        <label>
          {'翻译'}
          <select
            disabled={blocked}
            value={settings.translationMode}
            onChange={(e) =>
              setSettings({
                ...settings,
                translationMode: e.target
                  .value as AppSettings['translationMode'],
              })
            }
          >
            <option value="local">{'本地 · 在本机运行'}</option>
            <option value="cloud">{'云端 · 使用下方所选服务'}</option>
            <option value="none">{'关闭'}</option>
          </select>
        </label>
        {settings.translationMode === 'local' && (
          <label>
            {'本地翻译模型'}
            <select
              disabled={blocked}
              value={settings.translationModel}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  translationModel: e.target
                    .value as AppSettings['translationModel'],
                })
              }
            >
              <option value="hy-mt2-1.8b">
                {'Hy-MT2-1.8B · 体积较小，速度优先'}
              </option>
              <option value="qwen3.5-4b">
                {'Qwen3.5-4B · 备选，与学习工具共用模型'}
              </option>
            </select>
          </label>
        )}
        {settings.translationMode !== 'none' && (
          <label className="toggle-row">
            <span>
              <strong>上课时自动翻译</strong>
            </span>
            <input
              type="checkbox"
              role="switch"
              disabled={blocked}
              checked={settings.liveTranslation}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  liveTranslation: event.target.checked,
                })
              }
            />
          </label>
        )}
      </section>
      <section className="settings-card">
        <h3>课后学习</h3>
        <label>
          {'总结、深度复习与问答'}
          <select
            disabled={blocked}
            value={settings.studyMode}
            onChange={(e) =>
              setSettings({
                ...settings,
                studyMode: e.target.value as AppSettings['studyMode'],
              })
            }
          >
            <option value="local">{'本地 · Qwen3.5-4B'}</option>
            <option value="cloud">{'云端 · 使用下方所选服务'}</option>
            <option value="none">{'关闭'}</option>
          </select>
        </label>
        {settings.studyMode === 'local' && (
          <button className="button text" onClick={onLocal}>
            {'下载与管理本地模型'}
            <Icon name="arrow" size={16} />
          </button>
        )}
      </section>
      {(settings.translationMode === 'cloud' ||
        settings.studyMode === 'cloud') && (
        <section className="settings-card">
          <h3>云端文本服务</h3>
          <label>
            {'可选云端文本服务'}
            <select
              disabled={blocked}
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value as AppSettings['provider'];
                setSettings({
                  ...settings,
                  provider,
                  chatModel:
                    provider === 'groq'
                      ? 'llama-3.3-70b-versatile'
                      : 'gpt-4o-mini',
                });
              }}
            >
              <option value="none">{'未连接'}</option>
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
            </select>
          </label>
          {settings.provider !== 'none' && (
            <>
              <button
                className="button secondary"
                onClick={() => onKeys(settings.provider as 'openai' | 'groq')}
              >
                <Icon name="shield" size={16} />
                {hasKey ? '管理 API Key' : '添加 API Key'}
              </button>
              <details className="settings-advanced">
                <summary>{'模型高级设置'}</summary>
                <label>
                  {'文本模型'}
                  <input
                    disabled={blocked}
                    maxLength={100}
                    value={settings.chatModel}
                    onChange={(e) =>
                      setSettings({ ...settings, chatModel: e.target.value })
                    }
                  />
                </label>
                <p className="field-hint">
                  {
                    '请填写你的服务商账号可用的模型名。保存 API Key 并不代表已获得该模型的访问权限。'
                  }
                </p>
              </details>
            </>
          )}
          <p className="field-hint">
            使用自己的 API Key，费用与额度由服务商账户承担。
          </p>
        </section>
      )}
    </>
  );
}
