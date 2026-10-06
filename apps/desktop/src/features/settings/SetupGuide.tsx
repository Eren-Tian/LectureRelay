import { useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import type { ActionRunner } from '../../hooks/useAction';
import type { AppSettings, ModelStatus } from '../../types/domain';
import { LANGUAGES } from '../../lib/presentation';

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
        <h3>{'1. 选择字幕方式'}</h3>
        <p>
          {
            '建议先使用本地英文字幕。电脑性能允许时，再开启双语字幕；无需账号或 API Key。'
          }
        </p>
        <label>
          {'字幕方式'}
          <select
            value={bilingual ? 'bilingual' : 'english'}
            disabled={blocked}
            onChange={(e) => setBilingual(e.target.value === 'bilingual')}
          >
            <option value="bilingual">{'英文原文 + 译文'}</option>
            <option value="english">{'仅英文原文 · 更省算力'}</option>
          </select>
        </label>
        <label>
          {'译文语言'}
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
            {'英文识别 · 667 MiB ·'}{' '}
            <strong>
              {speechReady ? '已下载' : model ? '需要下载' : '正在检查…'}
            </strong>
          </li>
          {bilingual && (
            <li>
              {'翻译 · 约 1.1 GiB ·'}{' '}
              <strong>{translationReady ? '已下载' : '需要下载'}</strong>
            </li>
          )}
        </ul>
        <div className="button-row">
          {!ready && (
            <button className="button primary" onClick={onModels}>
              {'下载所需模型'}
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
              }, '字幕设置已保存，接下来请测试声音。')
            }
          >
            {bilingual ? '启用本地双语字幕' : '启用本地英文字幕'}
          </button>
        </div>
        <p className="field-hint">
          {
            'Qwen 用于课后总结和深度复习，可以稍后下载，不影响开始录音。已有课程仍使用各自的译文语言。'
          }
        </p>
      </section>
      <section className="settings-card">
        <h3>{'2. 测试声音'}</h3>
        <p>
          <strong>{'麦克风：'}</strong>
          {'用于录制教室里的讲话。'} <strong>{'系统声音：'}</strong>
          {'用于录制电脑播放的课程。上课前请选择设备，并完成 5 秒声音测试。'}
        </p>
        <button className="button secondary" onClick={onAudio}>
          {'选择设备并测试声音'}
        </button>
        <p className="field-hint">
          {
            '安静模式会限制 CPU 占用。字幕跟不上时，可切换到全速模式，或只显示英文。录音保存不依赖 AI。'
          }
        </p>
      </section>
      <section className="settings-card">
        <h3>{'3. 开始第一节课'}</h3>
        <p>
          {
            '创建课程并选择译文语言，然后点击“开始录音”。补充课程背景和专业术语，有助于识别与翻译。'
          }
        </p>
        <button
          className="button primary"
          onClick={() => workspace.navigate({ view: 'courses' })}
        >
          {'前往课程'}
        </button>
        <p className="field-hint">
          {
            '点击“结束并保存”后，可以打开课堂记录回放录音、修订文本、补全翻译或生成学习笔记。'
          }
        </p>
      </section>
    </div>
  );
}
