import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import type {
  LiveSummaryPreferences,
  ProviderStatus,
} from '../../types/domain';

export const defaultSummaryPreferences: LiveSummaryPreferences = {
  enabled: false,
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  intervalMinutes: 4,
  uploadConsent: false,
};
export function availableSummaryPreferences(
  preferences: LiveSummaryPreferences = defaultSummaryPreferences,
): LiveSummaryPreferences {
  return preferences.provider === 'local'
    ? {
        ...preferences,
        enabled: false,
        provider: 'none',
        model: defaultSummaryPreferences.model,
        uploadConsent: false,
      }
    : preferences;
}
const models = {
  groq: 'openai/gpt-oss-120b',
  openai: 'gpt-4o-mini',
  none: 'openai/gpt-oss-120b',
};
export function LiveSummarySetup({ onSaved }: { onSaved?: () => void }) {
  const workspace = useWorkspace();
  const [preferences, setPreferences] = useState(
    availableSummaryPreferences(workspace.data.settings.liveSummaries),
  );
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [key, setKey] = useState('');
  const [tested, setTested] = useState('');
  const [busy, setBusy] = useState(false);
  const activeAction = useRef(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const cloud =
    preferences.provider === 'groq' || preferences.provider === 'openai';
  const selected = providers.find((p) => p.provider === preferences.provider);
  const identity = `${preferences.provider}:${preferences.model}`;
  const load = async () => {
    const setup = await api.summarySetup();
    setProviders(setup.providers);
    setTested(
      setup.connectionTested
        ? `${setup.preferences.provider}:${setup.preferences.model}`
        : '',
    );
  };
  useEffect(() => {
    void load().catch((e) => {
      setFailed(true);
      setMessage(errorText(e));
    });
  }, []);
  const action = async (task: () => Promise<void>) => {
    if (activeAction.current) return;
    activeAction.current = true;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await task();
    } catch (e) {
      setFailed(true);
      setMessage(errorText(e));
    } finally {
      activeAction.current = false;
      setBusy(false);
    }
  };
  const save = async (enabled: boolean) => {
    const next = {
      ...preferences,
      enabled: enabled && preferences.provider !== 'none',
    };
    await api.saveSummarySettings(next);
    setPreferences(next);
    await workspace.refresh();
    await load();
    onSaved?.();
    setMessage(
      next.enabled
        ? '实时总结已启用，录音与字幕设置保持不变。'
        : '总结设置已保存；已完成卡片会保留。',
    );
  };
  return (
    <section className="settings-card live-summary-setup">
      <h3>实时课堂总结</h3>
      <details className="settings-advanced">
        <summary>使用说明</summary>
        <p>整理新定稿的英文，不改变语音识别、翻译或课后学习设置。</p>
        <p>已停用本地 Qwen 实时总结，已有卡片保留。</p>
      </details>
      <label>
        总结方式
        <select
          disabled={busy}
          value={preferences.provider}
          onChange={(e) => {
            const provider = e.target.value as keyof typeof models;
            setKey('');
            setMessage('');
            setPreferences({
              ...preferences,
              provider,
              model: models[provider],
              enabled: false,
              uploadConsent: false,
            });
          }}
        >
          <option value="groq">Groq · 推荐云端入口</option>
          <option value="openai">OpenAI</option>
          <option value="none">关闭</option>
        </select>
      </label>
      <label>
        自动整理间隔
        <select
          disabled={busy}
          value={preferences.intervalMinutes}
          onChange={(e) =>
            setPreferences({
              ...preferences,
              intervalMinutes: Number(e.target.value) as 2 | 4 | 5,
            })
          }
        >
          <option value={2}>2 分钟</option>
          <option value={4}>4 分钟 · 默认</option>
          <option value={5}>5 分钟</option>
        </select>
      </label>
      {cloud && (
        <>
          <ol className="summary-setup-steps">
            <li>获取 Key</li>
            <li>粘贴并保存</li>
            <li>测试</li>
            <li>启用总结</li>
          </ol>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void action(() =>
                api.openSummaryPage(preferences.provider, 'keys'),
              )
            }
          >
            {preferences.provider === 'groq'
              ? '获取 Groq API Key'
              : '获取 OpenAI API Key'}
          </button>
          <p className="field-hint">
            在服务商网站创建 Key，再粘贴到这里。Key 使用 Windows Credential
            Manager 保存。
          </p>
          <p role="status">
            {selected?.hasKey
              ? `Key 已保存：${selected.maskedKey} · ${tested === identity ? '本模型测试通过' : '本模型尚未测试'}`
              : '尚未保存 API Key'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await api.saveKey(
                  preferences.provider as 'groq' | 'openai',
                  key,
                );
                setKey('');
                setTested('');
                await load();
                setMessage('Key 已保存，请点击“测试总结连接”。');
              });
            }}
          >
            <label>
              {selected?.hasKey ? '替换 API Key' : '粘贴 API Key'}
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                maxLength={2000}
                value={key}
                disabled={busy}
                onChange={(e) => setKey(e.target.value)}
                placeholder="仅保存在此电脑，不进入笔记或导出"
              />
            </label>
            <div className="button-row">
              <button
                className="button secondary"
                disabled={busy || !key.trim()}
              >
                保存 Key
              </button>
              {selected?.hasKey && (
                <button
                  type="button"
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await api.removeKey(
                        preferences.provider as 'groq' | 'openai',
                      );
                      setKey('');
                      setTested('');
                      await load();
                      setMessage('Key 已移除。');
                    })
                  }
                >
                  移除 Key
                </button>
              )}
            </div>
          </form>
          <details>
            <summary>模型高级设置</summary>
            <label>
              总结模型
              <input
                maxLength={120}
                disabled={busy}
                value={preferences.model}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    model: e.target.value,
                    enabled: false,
                  })
                }
              />
            </label>
            <p className="field-hint">
              默认模型已经按官方参数配置。自选模型需支持 JSON
              Schema；修改后请重新测试。
            </p>
          </details>
          <button
            className="button secondary"
            disabled={busy || !selected?.hasKey}
            onClick={() =>
              void action(async () => {
                await api.saveSummarySettings({
                  ...preferences,
                  enabled: false,
                });
                setPreferences((p) => ({ ...p, enabled: false }));
                await api.testSummaryProvider(
                  preferences.provider,
                  preferences.model,
                );
                await load();
                await workspace.refresh();
                setMessage(
                  '所选模型已实际生成并通过格式与引用校验。请确认文字上传范围，然后启用总结。',
                );
              })
            }
          >
            {busy ? '正在处理…' : '测试总结连接'}
          </button>
          <p className="field-hint">
            测试会发送一小段固定测试文字并生成结果。保存 Key
            不代表模型、权限或额度可用。
          </p>
          <label className="toggle-row">
            <span>
              允许向 {preferences.provider === 'groq' ? 'Groq' : 'OpenAI'}{' '}
              发送所选英文转录片段及课程背景、术语，用于总结。此功能不上传录音。
            </span>
            <input
              type="checkbox"
              checked={preferences.uploadConsent}
              disabled={busy}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  uploadConsent: e.target.checked,
                })
              }
            />
          </label>
          <div className="button-row">
            <button
              className="text-button"
              onClick={() =>
                void action(() =>
                  api.openSummaryPage(preferences.provider, 'privacy'),
                )
              }
            >
              查看服务商数据政策
            </button>
            <button
              className="text-button"
              onClick={() =>
                void action(() =>
                  api.openSummaryPage(preferences.provider, 'limits'),
                )
              }
            >
              查看账户额度
            </button>
          </div>
          <p className="field-hint">
            {preferences.provider === 'groq'
              ? 'Groq 免费额度以账户显示为准，有请求与 tokens 限制，不保证无限免费使用。'
              : 'OpenAI API 单独计费，ChatGPT 订阅不包含 API 用量。已创建的完整 Key 无法再次查看；未保存时请创建新 Key。'}
          </p>
        </>
      )}
      <div className="button-row">
        <button
          className="button primary"
          disabled={
            busy ||
            !cloud ||
            (cloud &&
              (!selected?.hasKey ||
                tested !== identity ||
                !preferences.uploadConsent))
          }
          onClick={() => void action(() => save(true))}
        >
          {preferences.enabled ? '保存并保持启用' : '启用实时总结'}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void action(() => save(false))}
        >
          {preferences.enabled ? '关闭实时总结' : '保存设置，暂不启用'}
        </button>
      </div>
      {message && (
        <p
          className={`notice ${failed ? 'warning' : ''}`}
          role={failed ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
    </section>
  );
}
