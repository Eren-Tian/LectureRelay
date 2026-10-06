import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import type { SettingsEntry } from '../../app/routes';
import { Icon } from '../../components/Icon';
import { useAction } from '../../hooks/useAction';
import { ui } from '../../i18n';
import { AISettings } from './AISettings';
import { AboutSettings, PrivacySettings } from './ApplicationInfo';
import { AudioSettings } from './AudioSettings';
import { CaptionSettings } from './CaptionSettings';
import { GeneralSettings } from './GeneralSettings';
import {
  SettingsNavigation,
  settingsTitles,
  type AISection,
  type SettingsCategory,
} from './SettingsNavigation';
import { SetupGuide } from './SetupGuide';
import { StorageSettings } from './StorageSettings';
import { useSettingsDraft } from './useSettingsDraft';
import { useSettingsResources } from './useSettingsResources';

export function SettingsPage({
  initialEntry,
}: {
  initialEntry?: SettingsEntry;
}) {
  const workspace = useWorkspace();
  const draft = useSettingsDraft(workspace.data.settings);
  const resources = useSettingsResources();
  const { settings, setSettings, dirty } = draft;
  const { model, textModels } = resources;
  const [category, setCategory] = useState<SettingsCategory>(
    initialEntry === 'setup'
      ? 'setup'
      : initialEntry === 'audio'
        ? 'classroom'
        : initialEntry
          ? 'ai'
          : workspace.data.settings.speechProvider === 'none'
            ? 'setup'
            : 'general',
  );
  const [aiSection, setAISection] = useState<AISection>(
    initialEntry === 'models'
      ? 'models'
      : initialEntry === 'summaries'
        ? 'summaries'
        : 'services',
  );
  const [classroomSection, setClassroomSection] = useState<
    'audio' | 'captions'
  >('audio');
  const { busy, run } = useAction();
  const page = useRef<HTMLDivElement>(null);
  const blocked =
    busy ||
    !!workspace.recording ||
    !!workspace.job ||
    !!workspace.live?.active ||
    !!model?.downloading ||
    textModels.some((item) => item.downloading);
  const modelBlockedReason = workspace.recording
    ? ui.settingsPageModelBlockedRecording
    : workspace.job
      ? ui.settingsPageModelBlockedJob
      : workspace.live?.active
        ? ui.settingsPageModelBlockedLive
        : model?.downloading || textModels.some((item) => item.downloading)
          ? ui.settingsPageModelBlockedDownload
          : busy
            ? ui.settingsPageModelBlockedBusy
            : '';
  const relevantResources: (keyof typeof resources.errors)[] =
    category === 'setup' || (category === 'ai' && aiSection === 'models')
      ? ['speech', 'text', 'events']
      : category === 'storage'
        ? ['trash']
        : [];
  const loadError = relevantResources
    .map((key) => resources.errors[key])
    .filter(Boolean)
    .join(' ');
  const scrollToTop = () => {
    const scroller = page.current?.closest('main');
    if (scroller) scroller.scrollTop = 0;
  };
  const select = (next: SettingsCategory) => {
    setCategory(next);
    scrollToTop();
  };
  const selectAI = (next: AISection) => {
    setAISection(next);
    select('ai');
  };
  const props = { settings, setSettings, blocked };
  return (
    <div className="settings-page" ref={page}>
      <header className="page-heading settings-heading">
        <h1>{ui.settings}</h1>
      </header>
      <div className="settings-layout">
        <SettingsNavigation category={category} onSelect={select} />
        <div className="settings-detail" id="settings-detail">
          <header className="settings-section-heading">
            <h2>{settingsTitles[category]}</h2>
          </header>
          {loadError && (
            <div role="alert" className="audio-warning">
              <p>{loadError}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={resources.retry}
              >
                {ui.settingsPageReload}
              </button>
            </div>
          )}
          {category === 'setup' && (
            <SetupGuide
              {...props}
              model={model}
              textModels={textModels}
              run={run}
              onModels={() => selectAI('models')}
              onAudio={() => select('classroom')}
            />
          )}
          {category === 'general' && <GeneralSettings {...props} />}
          {category === 'classroom' && (
            <>
              <div
                className="settings-subnav"
                role="group"
                aria-label={ui.settingsPageClassroomAriaLabel}
              >
                {(
                  [
                    ['audio', ui.settingsPageAudioDevicesTab],
                    ['captions', ui.settingsPageCaptionStyleTab],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={classroomSection === id}
                    onClick={() => setClassroomSection(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {classroomSection === 'audio' ? (
                <AudioSettings {...props} />
              ) : (
                <CaptionSettings
                  {...props}
                  onProviders={() => selectAI('services')}
                />
              )}
            </>
          )}
          {category === 'ai' && (
            <AISettings
              {...props}
              section={aiSection}
              onSection={selectAI}
              resources={resources}
              run={run}
              providers={workspace.data.providers}
              modelBlockedReason={modelBlockedReason}
            />
          )}
          {category === 'storage' && (
            <StorageSettings
              resources={resources}
              blocked={blocked}
              run={run}
            />
          )}
          {category === 'privacy' && <PrivacySettings />}
          {category === 'about' && <AboutSettings />}
          {dirty && !(category === 'ai' && aiSection === 'summaries') && (
            <div className="settings-savebar">
              <span role="status">
                {blocked
                  ? ui.settingsPageSaveAfterTask
                  : ui.settingsPageUnsavedChanges}
              </span>
              <div className="button-row">
                <button
                  className="button text"
                  disabled={busy}
                  onClick={draft.reset}
                >
                  {ui.settingsPageRevertChanges}
                </button>
                <button
                  className="button primary"
                  disabled={blocked}
                  onClick={() =>
                    void run(async () => {
                      await api.saveSettings(settings);
                      await workspace.refresh();
                    }, ui.settingsPageSaved)
                  }
                >
                  <Icon name="check" size={16} />
                  {ui.saveChanges}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
