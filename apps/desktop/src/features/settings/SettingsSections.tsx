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
        <h3>Your language</h3>
        <p>
          English is the lecture language. Choose a default translation language
          for new courses.
        </p>
        <label>
          Default translation language
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
          Existing courses keep their own language. Change it in course details.
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
      <h3>Audio input</h3>
      <p>
        Use a microphone in the classroom, or capture a lecture playing on your
        computer.
      </p>
      <label>
        Default audio source
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
          <option value="microphone">Microphone</option>
          <option value="system">System audio</option>
        </select>
      </label>
      {(['microphone', 'system'] as const).map((source) => {
        const key =
          source === 'microphone' ? 'microphoneDeviceId' : 'systemDeviceId';
        const selected = settings[key];
        return (
          <label key={source}>
            {source === 'microphone'
              ? 'Microphone device'
              : 'System playback device'}
            <select
              disabled={blocked || loading}
              value={selected}
              onChange={(e) =>
                setSettings({ ...settings, [key]: e.target.value })
              }
            >
              <option value="">Windows default</option>
              {selected && !devices[source].some((d) => d.id === selected) && (
                <option value={selected}>Saved device unavailable</option>
              )}
              {devices[source].map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.isDefault ? ' (default)' : ''}
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
        {loading ? 'Finding devices…' : 'Refresh devices'}
      </button>
      <p className="field-hint">
        You can change the source before every class. If a saved device is
        disconnected, the start dialog selects an available device for you to
        review.
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
        <h3>Reading preferences</h3>
        <div className="caption-toggles">
          {(
            [
              [
                'showEnglish',
                'Show English',
                'The original words, always easy to find.',
              ],
              [
                'showTranslation',
                'Show translation',
                'Your selected language, just below each sentence.',
              ],
              [
                'autoScroll',
                'Follow live captions',
                'Scroll up to read earlier text; Jump to Live brings you back.',
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
              ['englishFontSize', 'English size', 16, 44],
              ['translationFontSize', 'Translation size', 14, 36],
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
          CAPTION PREVIEW <span>Sample text</span>
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
          Live translation uses your cloud text provider. Choose it in AI
          Providers.
        </p>
        <button className="text-button" onClick={onProviders}>
          Set up
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
        <h3>English speech recognition</h3>
        <p>Turn spoken English into captions while audio is safely recorded.</p>
        <label>
          Speech recognition
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
            <option value="local">Local English · on this computer</option>
            <option value="none">Audio only · captions off</option>
            <option value="openai">OpenAI · cloud audio</option>
            <option value="groq">Groq · cloud audio</option>
          </select>
        </label>
        {settings.speechProvider === 'local' ? (
          <button className="button text" onClick={onLocal}>
            Manage the local model
            <Icon name="arrow" size={16} />
          </button>
        ) : (
          settings.speechProvider !== 'none' && (
            <p className="field-hint">
              {speechHasKey
                ? 'Provider key saved. Connection has not been verified here.'
                : 'Add a provider key in Security & Privacy before recording with cloud speech.'}
            </p>
          )
        )}
      </section>
      <section className="settings-card">
        <div className="settings-title">
          <div>
            <h3>Translation & study tools</h3>
            <p>One text provider for live translation, notes and Q&A.</p>
          </div>
          <span className={`pill ${!hasKey ? 'gold' : ''}`}>
            {settings.provider === 'none'
              ? 'Off'
              : hasKey
                ? 'Key saved'
                : 'Key needed'}
          </span>
        </div>
        <label>
          Cloud text provider
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
            <option value="none">Not connected</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
          </select>
        </label>
        <label className="toggle-row">
          <span>
            <strong>Translate during class</strong>
            <small>
              Finalized English sentences are translated into the course
              language.
            </small>
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
          <span>Live translation</span>
          <span>Lecture notes</span>
          <span>Q&A with sources</span>
        </div>
        {settings.provider !== 'none' && (
          <>
            <button className="button secondary" onClick={onSecurity}>
              <Icon name="shield" size={16} />
              {hasKey ? 'Manage provider keys' : 'Add provider key'}
            </button>
            <details className="settings-advanced">
              <summary>Advanced model settings</summary>
              <label>
                Text model
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
                Use a model available to your provider account. A saved key does
                not confirm model access.
              </p>
            </details>
          </>
        )}
        <p className="field-hint">
          Cloud features require your own key and may incur provider charges.
          When unavailable, English and recorded audio remain saved.
        </p>
      </section>
    </>
  );
}
