import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api, errorText } from '../../api/client';
import { Icon } from '../../components/Icon';
import { RuntimePreferences } from './RuntimePreferences';
import { AudioInputTest } from './AudioInputTest';
import { LANGUAGES } from '../../lib/presentation';
import type {
  AppSettings,
  InputDevice,
  ProviderStatus,
} from '../../types/domain';

interface Props {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  blocked: boolean;
}
export function GeneralSettings({ settings, setSettings, blocked }: Props) {
  return (
    <>
      <section className="settings-card">
        <h3>{'译文语言'}</h3>
        <p>{'当前支持英文课堂。请选择新建课程默认使用的译文语言。'}</p>
        <label>
          {'默认译文语言'}
          <select
            disabled={blocked}
            value={settings.assistanceLanguage}
            onChange={(e) =>
              setSettings({
                ...settings,
                assistanceLanguage: e.target
                  .value as AppSettings['assistanceLanguage'],
              })
            }
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <p className="field-hint">
          {'不会更改已有课程的语言；如需调整，请编辑课程。'}
        </p>
      </section>
      <RuntimePreferences />
    </>
  );
}
export function AudioSettings({ settings, setSettings, blocked }: Props) {
  const [testing, setTesting] = useState(false);
  blocked = blocked || testing;
  const [devices, setDevices] = useState<{
    microphone: InputDevice[];
    system: InputDevice[];
  }>({ microphone: [], system: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError('');
    void Promise.all([
      api.audioDevices('microphone'),
      api.audioDevices('system'),
    ])
      .then(([microphone, system]) => {
        if (!disposed) setDevices({ microphone, system });
      })
      .catch((e) => {
        if (!disposed) setError(errorText(e));
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [revision]);
  return (
    <section className="settings-card">
      <h3>{'声音来源'}</h3>
      <p>{'线下课堂可使用麦克风；电脑播放的课程可选择系统声音。'}</p>
      <label>
        {'默认声音来源'}
        <select
          disabled={blocked}
          value={settings.audioSource}
          onChange={(e) =>
            setSettings({
              ...settings,
              audioSource: e.target.value as AppSettings['audioSource'],
            })
          }
        >
          <option value="microphone">{'麦克风'}</option>
          <option value="system">{'系统声音'}</option>
        </select>
      </label>
      {(['microphone', 'system'] as const).map((source) => {
        const key =
          source === 'microphone' ? 'microphoneDeviceId' : 'systemDeviceId';
        const selected = settings[key];
        return (
          <label key={source}>
            {source === 'microphone' ? '麦克风设备' : '系统播放设备'}
            <select
              disabled={blocked || loading}
              value={selected}
              onChange={(e) =>
                setSettings({ ...settings, [key]: e.target.value })
              }
            >
              <option value="">{'使用 Windows 默认设备'}</option>
              {selected && !devices[source].some((d) => d.id === selected) && (
                <option value={selected}>{'此前选择的设备不可用'}</option>
              )}
              {devices[source].map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.isDefault ? '（默认）' : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {error && (
        <p role="alert" className="audio-warning">
          {error}
        </p>
      )}
      <button
        className="button secondary"
        disabled={loading || blocked}
        onClick={() => refresh((n) => n + 1)}
      >
        {loading ? '正在查找设备…' : '刷新设备列表'}
      </button>
      <p className="field-hint">
        {
          '每次录音前都可以更换声音来源。如果原设备已断开，开始录音时会提示你确认可用设备。'
        }
      </p>
      <AudioInputTest
        source={settings.audioSource}
        deviceId={
          settings.audioSource === 'microphone'
            ? settings.microphoneDeviceId
            : settings.systemDeviceId
        }
        disabled={loading || blocked}
        onTesting={setTesting}
      />
    </section>
  );
}
const samples = {
  zh: '把新知识与已知的事物联系起来，会让学习更轻松。',
  ja: '新しい知識を知っていることと結びつけると、学びやすくなります。',
  ko: '새로운 지식을 이미 아는 것과 연결하면 더 쉽게 배울 수 있습니다.',
};
export function CaptionSettings({
  settings,
  setSettings,
  blocked,
  onProviders,
}: Props & { onProviders: () => void }) {
  const toggle = (
    key: 'showEnglish' | 'showTranslation' | 'autoScroll',
    checked: boolean,
  ) =>
    setSettings({
      ...settings,
      [key]: checked,
      ...(!checked && key === 'showEnglish' ? { showTranslation: true } : {}),
      ...(!checked && key === 'showTranslation' ? { showEnglish: true } : {}),
    });
  return (
    <>
      <section className="settings-card">
        <h3>{'阅读偏好'}</h3>
        <div className="caption-toggles">
          {(
            [
              ['showEnglish', '显示英文原文', '保留原文，便于核对课堂内容。'],
              ['showTranslation', '显示译文', '译文显示在对应英文下方。'],
              [
                'autoScroll',
                '自动跟随最新字幕',
                '向上滚动可查看前文，点击“回到最新字幕”继续跟随。',
              ],
            ] as const
          ).map(([key, title, hint]) => (
            <label className="toggle-row" key={key}>
              <span>
                <strong>{title}</strong>
                <small>{hint}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={settings[key]}
                disabled={blocked}
                onChange={(e) => toggle(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
        <div className="settings-two-columns">
          {(
            [
              ['englishFontSize', '英文字号', 16, 44],
              ['translationFontSize', '译文字号', 14, 36],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <span className="range-control">
                <input
                  type="range"
                  aria-label={label}
                  min={min}
                  max={max}
                  value={settings[key]}
                  disabled={blocked}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: Number(e.target.value) })
                  }
                />
                <output>{settings[key]} px</output>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="settings-card caption-preview">
        <div className="preview-label">
          {'字幕预览'}
          <span>{'示例字幕'}</span>
        </div>
        {settings.showEnglish && (
          <p
            className="caption-english"
            style={{ fontSize: settings.englishFontSize }}
          >
            Learning becomes easier when we connect new ideas to what we already
            know.
          </p>
        )}
        {settings.showTranslation && (
          <p
            className="caption-translation"
            lang={settings.assistanceLanguage}
            style={{ fontSize: settings.translationFontSize }}
          >
            {samples[settings.assistanceLanguage]}
          </p>
        )}
      </section>
      <div className="settings-inline-note">
        <Icon name="cloud" size={18} />
        <p>
          {'可在“AI 服务”中选择本地 Hy-MT2，或配置自己的云端服务来翻译字幕。'}
        </p>
        <button className="text-button" onClick={onProviders}>
          {'前往设置'}
          <Icon name="arrow" size={14} />
        </button>
      </div>
    </>
  );
}
export function ProviderSettings({
  settings,
  setSettings,
  blocked,
  providers,
  onSecurity,
  onLocal,
}: Props & {
  providers: ProviderStatus[];
  onSecurity: () => void;
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
        <p>{'将英文讲话转成字幕，录音会独立保存。'}</p>
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
            <p className="field-hint">
              {speechHasKey
                ? 'API Key 已保存，尚未验证连接和模型权限。'
                : '使用云端识别前，请先在“安全与隐私”中添加服务商的 API Key。'}
            </p>
          )
        )}
      </section>
      <section className="settings-card">
        <div className="settings-title">
          <div>
            <h3>{'翻译与学习工具'}</h3>
            <p>{'翻译使用专用模型，总结和复习共用另一个模型。'}</p>
          </div>
          <span className="pill">
            {settings.translationMode === 'local' &&
            settings.studyMode === 'local'
              ? '在本机运行'
              : '分别选择服务'}
          </span>
        </div>
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
            <span className="field-hint">
              {
                '当前模型仍在评测中。专业术语、数字和否定表达请结合英文原文核对。'
              }
            </span>
          </label>
        )}
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
        <button className="button text" onClick={onLocal}>
          {'下载与管理本地模型'}
          <Icon name="arrow" size={16} />
        </button>
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
        <label className="toggle-row">
          <span>
            <strong>{'上课时自动翻译'}</strong>
            <small>{'英文句子定稿后，自动翻译为该课程所选的语言。'}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            disabled={blocked}
            checked={settings.liveTranslation}
            onChange={(e) =>
              setSettings({ ...settings, liveTranslation: e.target.checked })
            }
          />
        </label>
        <div className="provider-features">
          <span>{'实时翻译'}</span>
          <span>{'课堂笔记'}</span>
          <span>{'带原文引用的问答'}</span>
        </div>
        {settings.provider !== 'none' && (
          <>
            <button className="button secondary" onClick={onSecurity}>
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
          {
            '云端功能使用你自己的 API Key，服务商可能收费。云端不可用时，已保存的英文转录和录音仍会保留。'
          }
        </p>
      </section>
    </>
  );
}
