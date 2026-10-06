import { useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import type { ActionRunner } from '../../hooks/useAction';
import type { AppSettings, ModelStatus } from '../../types/domain';
import { LANGUAGES } from '../../lib/presentation';
import { ui } from '../../i18n';

export function SetupGuide({
  settings,
  setSettings,
  model,
  textModels,
  blocked,
  run,
  onModels,
  onAudio,
}: {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  model?: ModelStatus;
  textModels: ModelStatus[];
  blocked: boolean;
  run: ActionRunner;
  onModels: () => void;
  onAudio: () => void;
}) {
  const workspace = useWorkspace();
  const [bilingual, setBilingual] = useState(true);
  const speechReady = !!model?.installed;
  const translationReady = textModels.some(
    (m) => m.id === 'hy-mt2-1.8b' && m.installed,
  );
  const ready = speechReady && (!bilingual || translationReady);
  return (
    <div className="setup-guide">
      <section className="settings-card">
        <h3>{ui.setupStepCaptionsTitle}</h3>
        <p>{ui.setupStepCaptionsBody}</p>
        <label>
          {ui.setupCaptionModeLabel}
          <select
            value={bilingual ? 'bilingual' : 'english'}
            disabled={blocked}
            onChange={(e) => setBilingual(e.target.value === 'bilingual')}
          >
            <option value="bilingual">{ui.setupCaptionModeBilingual}</option>
            <option value="english">{ui.setupCaptionModeEnglishOnly}</option>
          </select>
        </label>
        <label>
          {ui.assistanceLanguage}
          <select
            value={settings.assistanceLanguage}
            disabled={blocked}
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
        <ul className="setup-checklist">
          <li>
            {ui.setupSpeechModelItem}{' '}
            <strong>
              {speechReady
                ? ui.downloaded
                : model
                  ? ui.setupDownloadRequired
                  : ui.checking}
            </strong>
          </li>
          {bilingual && (
            <li>
              {ui.setupTranslationModelItem}{' '}
              <strong>
                {translationReady ? ui.downloaded : ui.setupDownloadRequired}
              </strong>
            </li>
          )}
        </ul>
        <div className="button-row">
          {!ready && (
            <button className="button primary" onClick={onModels}>
              {ui.setupDownloadModels}
            </button>
          )}
          <button
            className={`button ${ready ? 'primary' : 'secondary'}`}
            disabled={blocked || !ready}
            onClick={() =>
              void run(async () => {
                const next: AppSettings = {
                  ...settings,
                  speechProvider: 'local',
                  localModel: 'nemotron-streaming',
                  translationMode: bilingual ? 'local' : 'none',
                  translationModel: 'hy-mt2-1.8b',
                  liveTranslation: bilingual,
                  showEnglish: true,
                  showTranslation: bilingual,
                };
                await api.saveSettings(next);
                setSettings(next);
                await workspace.refresh();
              }, ui.setupCaptionsSaved)
            }
          >
            {bilingual ? ui.setupEnableBilingual : ui.setupEnableEnglish}
          </button>
        </div>
        <p className="field-hint">{ui.setupQwenHint}</p>
      </section>
      <section className="settings-card">
        <h3>{ui.setupStepAudioTitle}</h3>
        <p>
          <strong>{ui.setupMicrophoneLabel}</strong>
          {ui.setupMicrophoneUse} <strong>{ui.setupSystemAudioLabel}</strong>
          {ui.setupSystemAudioUse}
        </p>
        <button className="button secondary" onClick={onAudio}>
          {ui.setupChooseDeviceAndTest}
        </button>
        <p className="field-hint">{ui.setupQuietModeHint}</p>
      </section>
      <section className="settings-card">
        <h3>{ui.setupStepFirstLectureTitle}</h3>
        <p>{ui.setupStepFirstLectureBody}</p>
        <button
          className="button primary"
          onClick={() => workspace.navigate({ view: 'courses' })}
        >
          {ui.setupGoToCourses}
        </button>
        <p className="field-hint">{ui.setupAfterLectureHint}</p>
      </section>
    </div>
  );
}
