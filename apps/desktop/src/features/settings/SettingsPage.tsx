import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { Icon } from '../../components/Icon';
import { useAction } from '../../hooks/useAction';
import type { AppSettings, Course, ModelStatus } from '../../types/domain';
import {
  ProviderKeyForm,
  useProviderKeyForm,
} from '../ai-providers/ProviderKeyForm';
import { ModelManagerCard } from '../model-manager/ModelManagerCard';
import { TrashCard } from '../trash/TrashCard';
import { StorageUsage } from './StorageUsage';
import {
  AudioSettings,
  CaptionSettings,
  GeneralSettings,
  ProviderSettings,
} from './SettingsSections';

const categories = [
  ['General', 'settings'],
  ['Audio', 'mic'],
  ['Live Captions', 'books'],
  ['AI Providers', 'cloud'],
  ['Local AI', 'spark'],
  ['Data', 'folder'],
  ['Security & Privacy', 'shield'],
  ['About', 'info'],
] as const;
type Category = (typeof categories)[number][0];

export function SettingsPage() {
  const workspace = useWorkspace();
  const saved = JSON.stringify(workspace.data.settings);
  const [settings, setSettings] = useState<AppSettings>(
    workspace.data.settings,
  );
  const [category, setCategory] = useState<Category>('General');
  const [model, setModel] = useState<ModelStatus>();
  const [textModels, setTextModels] = useState<ModelStatus[]>([]);
  const [trash, setTrash] = useState<Course[]>([]);
  const [loadError, setLoadError] = useState('');
  const { busy, run } = useAction();
  const keyForm = useProviderKeyForm(run);
  const page = useRef<HTMLDivElement>(null);
  const previousSaved = useRef(saved);
  useEffect(() => {
    const previous = JSON.parse(previousSaved.current) as AppSettings;
    const next = JSON.parse(saved) as AppSettings;
    previousSaved.current = saved;
    // Immediate appearance/performance saves must preserve other unsaved edits.
    setSettings(
      (draft) =>
        Object.fromEntries(
          Object.entries(next).map(([key, value]) => [
            key,
            draft[key as keyof AppSettings] ===
            previous[key as keyof AppSettings]
              ? value
              : draft[key as keyof AppSettings],
          ]),
        ) as unknown as AppSettings,
    );
  }, [saved]);
  useEffect(() => {
    let disposed = false;
    void Promise.all([api.localModel(), api.trash(), api.textModels()])
      .then(([model, trash, textModels]) => {
        if (!disposed) {
          setModel(model);
          setTrash(trash);
          setTextModels(textModels);
        }
      })
      .catch((error) => {
        if (!disposed) setLoadError(errorText(error));
      });
    const subscription = listen<ModelStatus>('model-status', (e) => {
      if (!disposed) {
        if (e.payload.id === 'nemotron-streaming') setModel(e.payload);
        else
          setTextModels((models) =>
            models.map((m) => (m.id === e.payload.id ? e.payload : m)),
          );
      }
    });
    return () => {
      disposed = true;
      void subscription.then((off) => off());
    };
  }, []);
  const blocked =
    busy ||
    !!workspace.recording ||
    !!workspace.job ||
    !!workspace.live?.active ||
    !!model?.downloading ||
    textModels.some((m) => m.downloading);
  const dirty = JSON.stringify(settings) !== saved;
  const select = (next: Category) => {
    keyForm.setKey('');
    setCategory(next);
    const scroller = page.current?.closest('main');
    if (scroller) scroller.scrollTop = 0;
  };
  const props = { settings, setSettings, blocked };
  return (
    <div className="settings-page" ref={page}>
      <header className="page-heading settings-heading">
        <div>
          <h1>Settings</h1>
        </div>
        <span className="pill">v{workspace.data.storage.version}</span>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings categories">
          {categories.map(([name, icon]) => (
            <button
              key={name}
              aria-current={category === name ? 'page' : undefined}
              onClick={() => select(name)}
            >
              <Icon name={icon} size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="settings-detail" id="settings-detail">
          <header className="settings-section-heading">
            <h2>{category}</h2>
          </header>
          {loadError && (
            <p role="alert" className="audio-warning">
              {loadError}
            </p>
          )}
          {category === 'General' && <GeneralSettings {...props} />}
          {category === 'Audio' && <AudioSettings {...props} />}
          {category === 'Live Captions' && (
            <CaptionSettings
              {...props}
              onProviders={() => select('AI Providers')}
            />
          )}
          {category === 'AI Providers' && (
            <ProviderSettings
              {...props}
              providers={workspace.data.providers}
              onSecurity={() => select('Security & Privacy')}
              onLocal={() => select('Local AI')}
            />
          )}
          {category === 'Local AI' && (
            <>
              <ModelManagerCard
                model={model}
                blocked={blocked}
                run={run}
                setModel={setModel}
              />
              <section className="settings-card">
                <h3>Setup</h3>
                <p>
                  Download each model once. Choose Local English for speech and
                  Local for translation and study tools in AI Providers.
                </p>
                <p className="field-hint">
                  During class: speech and translation. After class: release
                  live models before loading Qwen. Local mode never falls back
                  to a cloud service. Allow about 4.3 GiB for all three
                  downloads and additional working memory.
                </p>
                <button
                  className="button secondary"
                  onClick={() => select('AI Providers')}
                >
                  Choose AI models
                  <Icon name="arrow" size={16} />
                </button>
              </section>
              {textModels.map((m) => (
                <ModelManagerCard
                  key={m.id}
                  model={m}
                  blocked={blocked}
                  run={run}
                  setModel={(next) =>
                    setTextModels((models) =>
                      models.map((item) => (item.id === next.id ? next : item)),
                    )
                  }
                />
              ))}
            </>
          )}
          {category === 'Data' && (
            <>
              <section className="settings-card">
                <h3>Class library</h3>
                <StorageUsage />
                <p>
                  Recordings, transcripts and course context stay on this
                  computer.
                </p>
                <dl className="storage-list">
                  <div>
                    <dt>Library</dt>
                    <dd>{workspace.data.storage.library}</dd>
                  </div>
                  <div>
                    <dt>Exports</dt>
                    <dd>{workspace.data.storage.exports}</dd>
                  </div>
                </dl>
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() => void run(() => api.openFolder('library'))}
                  >
                    <Icon name="folder" size={16} />
                    Open library
                  </button>
                  <button
                    className="button text"
                    onClick={() => void run(() => api.openFolder('exports'))}
                  >
                    Open exports
                  </button>
                </div>
                <details className="settings-advanced">
                  <summary>Storage details</summary>
                  <dl className="storage-list">
                    <div>
                      <dt>Database</dt>
                      <dd>{workspace.data.storage.database}</dd>
                    </div>
                    <div>
                      <dt>App data</dt>
                      <dd>{workspace.data.storage.state}</dd>
                    </div>
                  </dl>
                  <p className="field-hint">
                    Keep the library and database together when backing up your
                    classes. Export a transcript or notes from lecture replay.
                  </p>
                </details>
              </section>
              <TrashCard
                trash={trash}
                blocked={blocked}
                run={run}
                setTrash={setTrash}
              />
            </>
          )}
          {category === 'Security & Privacy' && (
            <>
              <ProviderKeyForm
                settings={settings}
                busy={blocked}
                run={run}
                form={keyForm}
              />
              <section className="settings-card">
                <h3>What stays here. What is sent.</h3>
                <div className="privacy-row">
                  <Icon name="folder" />
                  <div>
                    <strong>On your computer</strong>
                    <p>
                      Your recordings, courses and transcripts. Local English
                      recognition processes audio on this device.
                    </p>
                  </div>
                </div>
                <div className="privacy-row">
                  <Icon name="cloud" />
                  <div>
                    <strong>Only when you choose a cloud feature</strong>
                    <p>
                      Cloud speech sends audio. Text features set to Cloud send
                      relevant text and course context to the selected provider.
                      Local translation and study tools process text on this
                      device. Provider charges may apply.
                    </p>
                  </div>
                </div>
                <p className="field-hint">
                  Keys are stored in Windows Credential Manager and excluded
                  from class exports. No LectureRelay account is required.
                </p>
              </section>
            </>
          )}
          {category === 'About' && (
            <section className="settings-card about-card">
              <h2>LectureRelay</h2>
              <span className="pill">
                Version {workspace.data.storage.version} · Windows
              </span>
              <dl className="storage-list">
                <div>
                  <dt>Interface</dt>
                  <dd>English</dd>
                </div>
                <div>
                  <dt>Translation languages</dt>
                  <dd>Chinese, Japanese and Korean</dd>
                </div>
                <div>
                  <dt>Project license</dt>
                  <dd>Not yet finalized for distribution</dd>
                </div>
                <div>
                  <dt>Open source components</dt>
                  <dd>Bundled third-party notices accompany the app.</dd>
                </div>
                <div>
                  <dt>Source repository</dt>
                  <dd>github.com/Ellen-Tian/LectureRelay</dd>
                </div>
              </dl>
            </section>
          )}
          <div className="settings-savebar">
            <span role="status">
              {blocked
                ? 'Appearance and Quiet Mode remain available. Finish active work to save other settings.'
                : dirty
                  ? 'You have unsaved changes.'
                  : 'All preferences saved.'}
            </span>
            <div className="button-row">
              {dirty && (
                <button
                  className="button text"
                  disabled={blocked}
                  onClick={() => setSettings(JSON.parse(saved) as AppSettings)}
                >
                  Reset changes
                </button>
              )}
              <button
                className="button primary"
                disabled={blocked || !dirty}
                onClick={() =>
                  void run(async () => {
                    await api.saveSettings(settings);
                    await workspace.refresh();
                  }, 'Preferences saved.')
                }
              >
                <Icon name="check" size={16} />
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
