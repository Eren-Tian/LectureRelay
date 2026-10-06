import { Icon } from '../../components/Icon';
import { ui } from '../../i18n';
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
        <h3>{ui.servicesSpeechTitle}</h3>
        <label>
          {ui.speechRecognition}
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
            <option value="local">{ui.servicesSpeechLocalOption}</option>
            <option value="none">{ui.servicesSpeechNoneOption}</option>
            <option value="openai">{ui.servicesSpeechOpenAIOption}</option>
            <option value="groq">{ui.servicesSpeechGroqOption}</option>
          </select>
        </label>
        {settings.speechProvider === 'local' ? (
          <button className="button text" onClick={onLocal}>
            {ui.servicesManageLocalModels}
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
              {speechHasKey ? ui.servicesManageApiKey : ui.addApiKey}
            </button>
          )
        )}
      </section>
      <section className="settings-card">
        <h3>{ui.servicesTranslationTitle}</h3>
        <label>
          {ui.servicesTranslationLabel}
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
            <option value="local">{ui.servicesLocalOnDeviceOption}</option>
            <option value="cloud">{ui.servicesCloudSelectedBelowOption}</option>
            <option value="none">{ui.off}</option>
          </select>
        </label>
        {settings.translationMode === 'local' && (
          <label>
            {ui.servicesLocalTranslationModel}
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
                {ui.servicesTranslationHyMtOption}
              </option>
              <option value="qwen3.5-4b">
                {ui.servicesTranslationQwenOption}
              </option>
            </select>
          </label>
        )}
        {settings.translationMode !== 'none' && (
          <label className="toggle-row">
            <span>
              <strong>{ui.servicesLiveTranslationToggle}</strong>
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
        <h3>{ui.servicesStudyTitle}</h3>
        <label>
          {ui.servicesStudyLabel}
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
            <option value="local">{ui.servicesStudyLocalOption}</option>
            <option value="cloud">{ui.servicesCloudSelectedBelowOption}</option>
            <option value="none">{ui.off}</option>
          </select>
        </label>
        {settings.studyMode === 'local' && (
          <button className="button text" onClick={onLocal}>
            {ui.servicesDownloadManageModels}
            <Icon name="arrow" size={16} />
          </button>
        )}
      </section>
      {(settings.translationMode === 'cloud' ||
        settings.studyMode === 'cloud') && (
        <section className="settings-card">
          <h3>{ui.servicesCloudTextTitle}</h3>
          <label>
            {ui.servicesCloudTextLabel}
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
              <option value="none">{ui.servicesProviderNotConnected}</option>
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
                {hasKey ? ui.servicesManageApiKey : ui.addApiKey}
              </button>
              <details className="settings-advanced">
                <summary>{ui.advancedModelSettings}</summary>
                <label>
                  {ui.servicesTextModel}
                  <input
                    disabled={blocked}
                    maxLength={100}
                    value={settings.chatModel}
                    onChange={(e) =>
                      setSettings({ ...settings, chatModel: e.target.value })
                    }
                  />
                </label>
                <p className="field-hint">{ui.servicesTextModelHint}</p>
              </details>
            </>
          )}
          <p className="field-hint">{ui.servicesOwnApiKeyHint}</p>
        </section>
      )}
    </>
  );
}
