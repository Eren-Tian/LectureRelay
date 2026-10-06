import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import type { SettingsEntry } from '../../app/routes';
import { Icon } from '../../components/Icon';
import { useAction } from '../../hooks/useAction';
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
    ? '请先结束并保存录音，再下载或删除模型。'
    : workspace.job
      ? '请先等待当前 AI 任务完成，或取消任务，再管理模型。'
      : workspace.live?.active
        ? '字幕或翻译仍在处理，请等待完成，或在课堂记录中停止处理。'
        : model?.downloading || textModels.some((item) => item.downloading)
          ? '一次只能下载一个模型。请等待下载完成，或取消当前下载。'
          : busy
            ? '请等待当前操作完成。'
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
        <h1>设置</h1>
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
                重新加载
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
                aria-label="课堂设置"
              >
                {(
                  [
                    ['audio', '声音设备'],
                    ['captions', '字幕样式'],
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
                {blocked ? '当前任务结束后可保存修改' : '有未保存的修改'}
              </span>
              <div className="button-row">
                <button
                  className="button text"
                  disabled={busy}
                  onClick={draft.reset}
                >
                  撤销修改
                </button>
                <button
                  className="button primary"
                  disabled={blocked}
                  onClick={() =>
                    void run(async () => {
                      await api.saveSettings(settings);
                      await workspace.refresh();
                    }, '设置已保存。')
                  }
                >
                  <Icon name="check" size={16} />
                  保存修改
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
