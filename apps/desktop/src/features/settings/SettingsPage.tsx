import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText, pruneDeletedDrafts } from '../../api/client';
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
import { SetupGuide } from './SetupGuide';
import {
  AudioSettings,
  CaptionSettings,
  GeneralSettings,
  ProviderSettings,
} from './SettingsSections';

const categories = [
  ['首次使用', 'check'],
  ['通用', 'settings'],
  ['声音', 'mic'],
  ['字幕显示', 'books'],
  ['AI 服务', 'cloud'],
  ['本地 AI', 'spark'],
  ['数据与存储', 'folder'],
  ['安全与隐私', 'shield'],
  ['关于', 'info'],
] as const;
type Category = (typeof categories)[number][0];

export function SettingsPage() {
  const workspace = useWorkspace();
  const saved = JSON.stringify(workspace.data.settings);
  const [settings, setSettings] = useState<AppSettings>(
    workspace.data.settings,
  );
  const [category, setCategory] = useState<Category>('首次使用');
  const [model, setModel] = useState<ModelStatus>();
  const [textModels, setTextModels] = useState<ModelStatus[]>([]);
  const [trash, setTrash] = useState<Course[]>([]);
  const [storageRevision, setStorageRevision] = useState(0);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadError = Object.values(loadErrors).join(' ');
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
    setLoadErrors({});
    const failed = (key: string, error: unknown) => {
      if (!disposed)
        setLoadErrors((errors) => ({ ...errors, [key]: errorText(error) }));
    };
    // Unrelated library reads must not keep successfully loaded models disabled.
    const load = <T,>(
      key: string,
      request: Promise<T>,
      apply: (value: T) => void,
    ) => {
      void request
        .then((value) => {
          if (!disposed) apply(value);
        })
        .catch((error) => failed(key, error));
    };
    load('speech', api.localModel(), setModel);
    load('text', api.textModels(), setTextModels);
    load('trash', api.trash(), setTrash);
    const subscription = listen<ModelStatus>('model-status', (e) => {
      if (!disposed) {
        if (e.payload.id === 'nemotron-streaming') setModel(e.payload);
        else
          setTextModels((models) =>
            models.map((m) => (m.id === e.payload.id ? e.payload : m)),
          );
      }
    }).catch((error) => {
      failed('events', error);
      return () => {};
    });
    return () => {
      disposed = true;
      void subscription.then((off) => off());
    };
  }, [loadAttempt]);
  const blocked =
    busy ||
    !!workspace.recording ||
    !!workspace.job ||
    !!workspace.live?.active ||
    !!model?.downloading ||
    textModels.some((m) => m.downloading);
  const modelBlockedReason = workspace.recording
    ? '请先结束并保存录音，再下载或删除模型。'
    : workspace.job
      ? '请先等待当前 AI 任务完成，或取消任务，再管理模型。'
      : workspace.live?.active
        ? '字幕或翻译仍在处理，请等待完成，或在课堂记录中停止处理。'
        : model?.downloading || textModels.some((m) => m.downloading)
          ? '一次只能下载一个模型。请等待下载完成，或点击“取消下载”。'
          : busy
            ? '请等待当前设置操作完成。'
            : '';
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
          <h1>{'设置'}</h1>
        </div>
        <span className="pill">v{workspace.data.storage.version}</span>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分类">
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
            <div role="alert" className="audio-warning">
              <p>{loadError}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                {'重新加载'}
              </button>
            </div>
          )}
          {category === '首次使用' && (
            <SetupGuide
              {...props}
              model={model}
              textModels={textModels}
              run={run}
              onModels={() => select('本地 AI')}
              onAudio={() => select('声音')}
            />
          )}
          {category === '通用' && <GeneralSettings {...props} />}
          {category === '声音' && <AudioSettings {...props} />}
          {category === '字幕显示' && (
            <CaptionSettings {...props} onProviders={() => select('AI 服务')} />
          )}
          {category === 'AI 服务' && (
            <ProviderSettings
              {...props}
              providers={workspace.data.providers}
              onSecurity={() => select('安全与隐私')}
              onLocal={() => select('本地 AI')}
            />
          )}
          {category === '本地 AI' && (
            <>
              {modelBlockedReason && (
                <p role="status" className="field-hint">
                  {modelBlockedReason}
                </p>
              )}
              <ModelManagerCard
                model={model}
                blocked={blocked}
                run={run}
                setModel={setModel}
              />
              <section className="settings-card">
                <h3>{'使用说明'}</h3>
                <p>
                  {
                    '模型只需下载一次。下载后，在“AI 服务”中将语音识别、翻译和学习工具设为本地运行。'
                  }
                </p>
                <p className="field-hint">
                  {
                    '上课时运行识别和翻译，课后释放实时模型再加载 Qwen。本地模式不会自动切换到云端。三个模型共需约 4.3 GiB 存储空间，运行时还需额外内存。'
                  }
                </p>
                <button
                  className="button primary"
                  onClick={() => select('首次使用')}
                >
                  {'返回首次设置'}
                </button>
                <button
                  className="button secondary"
                  onClick={() => select('AI 服务')}
                >
                  {'选择 AI 模型'}
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
          {category === '数据与存储' && (
            <>
              <section className="settings-card">
                <h3>{'课堂资料'}</h3>
                <StorageUsage key={storageRevision} />
                <p>{'录音、转录文本和课程背景保存在这台电脑上。'}</p>
                <dl className="storage-list">
                  <div>
                    <dt>{'资料库'}</dt>
                    <dd>{workspace.data.storage.library}</dd>
                  </div>
                  <div>
                    <dt>{'导出文件'}</dt>
                    <dd>{workspace.data.storage.exports}</dd>
                  </div>
                </dl>
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() => void run(() => api.openFolder('library'))}
                  >
                    <Icon name="folder" size={16} />
                    {'打开资料库文件夹'}
                  </button>
                  <button
                    className="button text"
                    onClick={() => void run(() => api.openFolder('exports'))}
                  >
                    {'打开导出文件夹'}
                  </button>
                </div>
                <details className="settings-advanced">
                  <summary>{'存储位置'}</summary>
                  <dl className="storage-list">
                    <div>
                      <dt>{'数据库'}</dt>
                      <dd>{workspace.data.storage.database}</dd>
                    </div>
                    <div>
                      <dt>{'应用数据'}</dt>
                      <dd>{workspace.data.storage.state}</dd>
                    </div>
                  </dl>
                  <p className="field-hint">
                    {
                      '备份时请同时保存资料库和数据库。转录与笔记可在课堂回放页导出。'
                    }
                  </p>
                </details>
              </section>
              <TrashCard
                trash={trash}
                blocked={blocked}
                run={run}
                setTrash={setTrash}
                onDeleted={async () => setStorageRevision((n) => n + 1)}
              />
              <section className="settings-card">
                <h2>{'清空课堂数据与模型'}</h2>
                <p>
                  {
                    '永久删除所有课程（含回收站）、录音、转录、笔记、复习指南、PDF、应用内导出文件、已下载模型及处理缓存。再次使用本地 AI 前需重新下载模型。'
                  }
                </p>
                <p className="field-hint">
                  {
                    '应用、偏好设置和 Windows 凭据管理器中的 API Key 会保留，也会保留少量数据库和界面设置文件。应用之外的文件副本不会删除。'
                  }
                </p>
                <button
                  className="button danger"
                  disabled={blocked}
                  onClick={() =>
                    void run(async () => {
                      if (
                        !(await workspace.confirm({
                          title: '清空全部课堂数据和模型？',
                          body: '所有课程（含回收站）、录音、转录、笔记、复习指南、PDF、应用内导出文件、本地模型和处理缓存都会永久删除，无法恢复。请先导出需要保留的内容。偏好设置和 API Key 会保留。',
                          action: '清空数据与模型',
                          danger: true,
                          confirmationText: '清空全部数据',
                        }))
                      )
                        return;
                      try {
                        await api.freeAllStorage('DELETE ALL');
                      } finally {
                        await pruneDeletedDrafts();
                        setTrash(await api.trash());
                        setModel(await api.localModel());
                        setTextModels(await api.textModels());
                        setStorageRevision((n) => n + 1);
                        await workspace.refresh();
                      }
                      workspace.notify(
                        '课堂数据和模型已清空，存储空间已释放。',
                      );
                    })
                  }
                >
                  {'清空课堂数据与模型…'}
                </button>
              </section>
            </>
          )}
          {category === '安全与隐私' && (
            <>
              <ProviderKeyForm
                settings={settings}
                busy={blocked}
                run={run}
                form={keyForm}
              />
              <section className="settings-card">
                <h3>{'数据保存在哪里？何时会上传？'}</h3>
                <div className="privacy-row">
                  <Icon name="folder" />
                  <div>
                    <strong>{'保存在本机'}</strong>
                    <p>
                      {
                        '录音、课程资料和转录文本保存在本机。本地英文识别也在这台电脑上完成。'
                      }
                    </p>
                  </div>
                </div>
                <div className="privacy-row">
                  <Icon name="cloud" />
                  <div>
                    <strong>{'启用云端功能时才会上传'}</strong>
                    <p>
                      {
                        '云端识别会上传录音；设为云端的文本功能会将相关文本和课程背景发送给所选服务商。本地翻译和学习工具在本机处理。云端服务可能收费。'
                      }
                    </p>
                  </div>
                </div>
                <p className="field-hint">
                  {
                    'API Key 存放在 Windows 凭据管理器中，不会随课堂资料导出。使用 LectureRelay 无需注册账号。'
                  }
                </p>
              </section>
            </>
          )}
          {category === '关于' && (
            <section className="settings-card about-card">
              <h2>LectureRelay</h2>
              <span className="pill">
                {'版本'}
                {workspace.data.storage.version} · Windows
              </span>
              <dl className="storage-list">
                <div>
                  <dt>{'界面语言'}</dt>
                  <dd>简体中文</dd>
                </div>
                <div>
                  <dt>{'支持的译文语言'}</dt>
                  <dd>{'中文、日语、韩语'}</dd>
                </div>
                <div>
                  <dt>{'项目许可证'}</dt>
                  <dd>{'尚未确定'}</dd>
                </div>
                <div>
                  <dt>{'开源组件'}</dt>
                  <dd>{'第三方许可证与声明随应用一起提供。'}</dd>
                </div>
                <div>
                  <dt>{'源码仓库'}</dt>
                  <dd>github.com/Ellen-Tian/LectureRelay</dd>
                </div>
              </dl>
            </section>
          )}
          <div className="settings-savebar">
            <span role="status">
              {blocked
                ? '录音或处理期间仍可调整外观和安静模式。其他设置请在任务结束后保存。'
                : dirty
                  ? '有尚未保存的修改。'
                  : '设置已保存。'}
            </span>
            <div className="button-row">
              {dirty && (
                <button
                  className="button text"
                  disabled={blocked}
                  onClick={() => setSettings(JSON.parse(saved) as AppSettings)}
                >
                  {'撤销修改'}
                </button>
              )}
              <button
                className="button primary"
                disabled={blocked || !dirty}
                onClick={() =>
                  void run(async () => {
                    await api.saveSettings(settings);
                    await workspace.refresh();
                  }, '设置已保存。')
                }
              >
                <Icon name="check" size={16} />
                {'保存修改'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
