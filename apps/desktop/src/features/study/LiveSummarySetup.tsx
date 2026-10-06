import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { ui } from '../../i18n';
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
const models = {
  groq: 'openai/gpt-oss-120b',
  openai: 'gpt-4o-mini',
  none: 'openai/gpt-oss-120b',
};
export function LiveSummarySetup({ onSaved }: { onSaved?: () => void }) {
  const workspace = useWorkspace();
  const [preferences, setPreferences] = useState(
    workspace.data.settings.liveSummaries,
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
        ? ui.summarySetupEnabledMessage
        : ui.summarySetupSavedMessage,
    );
  };
  return (
    <section className="settings-card live-summary-setup">
      <h3>{ui.summarySetupTitle}</h3>
      <details className="settings-advanced">
        <summary>{ui.summarySetupHowItWorks}</summary>
        <p>{ui.summarySetupHowItWorksBody}</p>
        <p>{ui.summarySetupLocalQwenRetired}</p>
      </details>
      <label>
        {ui.summarySetupProviderLabel}
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
          <option value="groq">{ui.summarySetupGroqOption}</option>
          <option value="openai">OpenAI</option>
          <option value="none">{ui.off}</option>
        </select>
      </label>
      <label>
        {ui.summarySetupIntervalLabel}
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
          <option value={2}>{ui.summarySetupIntervalOption(2)}</option>
          <option value={4}>{ui.summarySetupIntervalDefaultOption(4)}</option>
          <option value={5}>{ui.summarySetupIntervalOption(5)}</option>
        </select>
      </label>
      {cloud && (
        <>
          <ol className="summary-setup-steps">
            <li>{ui.summarySetupStepGetKey}</li>
            <li>{ui.summarySetupStepPasteAndSave}</li>
            <li>{ui.summarySetupStepTest}</li>
            <li>{ui.summarySetupStepEnable}</li>
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
              ? ui.summarySetupGetGroqKey
              : ui.summarySetupGetOpenAiKey}
          </button>
          <p className="field-hint">{ui.summarySetupKeyHint}</p>
          <p role="status">
            {selected?.hasKey
              ? `${ui.summarySetupKeySavedStatus(selected.maskedKey)} · ${tested === identity ? ui.summarySetupModelTested : ui.summarySetupModelUntested}`
              : ui.summarySetupNoKeySaved}
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
                setMessage(ui.summarySetupKeySavedMessage);
              });
            }}
          >
            <label>
              {selected?.hasKey
                ? ui.summarySetupReplaceKeyLabel
                : ui.summarySetupPasteKeyLabel}
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                maxLength={2000}
                value={key}
                disabled={busy}
                onChange={(e) => setKey(e.target.value)}
                placeholder={ui.summarySetupKeyPlaceholder}
              />
            </label>
            <div className="button-row">
              <button
                className="button secondary"
                disabled={busy || !key.trim()}
              >
                {ui.summarySetupSaveKey}
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
                      setMessage(ui.summarySetupKeyRemovedMessage);
                    })
                  }
                >
                  {ui.summarySetupRemoveKey}
                </button>
              )}
            </div>
          </form>
          <details>
            <summary>{ui.advancedModelSettings}</summary>
            <label>
              {ui.summarySetupModelLabel}
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
            <p className="field-hint">{ui.summarySetupModelHint}</p>
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
                setMessage(ui.summarySetupTestPassedMessage);
              })
            }
          >
            {busy ? ui.processing : ui.summarySetupTestConnection}
          </button>
          <p className="field-hint">{ui.summarySetupTestHint}</p>
          <label className="toggle-row">
            <span>
              {ui.summarySetupUploadConsent(
                preferences.provider === 'groq' ? 'Groq' : 'OpenAI',
              )}
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
              {ui.summarySetupViewDataPolicy}
            </button>
            <button
              className="text-button"
              onClick={() =>
                void action(() =>
                  api.openSummaryPage(preferences.provider, 'limits'),
                )
              }
            >
              {ui.summarySetupViewAccountLimits}
            </button>
          </div>
          <p className="field-hint">
            {preferences.provider === 'groq'
              ? ui.summarySetupGroqQuotaHint
              : ui.summarySetupOpenAiBillingHint}
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
          {preferences.enabled
            ? ui.summarySetupSaveAndKeepEnabled
            : ui.summarySetupEnable}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void action(() => save(false))}
        >
          {preferences.enabled
            ? ui.summarySetupDisable
            : ui.summarySetupSaveWithoutEnabling}
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
