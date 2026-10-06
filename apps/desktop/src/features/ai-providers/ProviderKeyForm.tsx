import { useState, type FormEvent } from 'react';
import { ui } from '../../i18n';
import { api } from '../../api/client';
import { providerName } from '../../lib/presentation';
import { Icon } from '../../components/Icon';
import { useWorkspace } from '../../app/Workspace';
import type { ActionRunner } from '../../hooks/useAction';
import type { AppSettings } from '../../types/domain';

export function useProviderKeyForm(run: ActionRunner) {
  const workspace = useWorkspace();
  const [key, setKey] = useState('');
  const [keyProvider, setKeyProvider] = useState<'openai' | 'groq'>('openai');
  const status = workspace.data.providers.find(
    (provider) => provider.provider === keyProvider,
  );
  const saveKey = (event: FormEvent) => {
    event.preventDefault();
    const enteredKey = key;
    setKey('');
    void run(async () => {
      await api.saveKey(keyProvider, enteredKey);
      await workspace.refresh();
    }, ui.apiKeySaved);
  };
  const removeKey = async () => {
    if (
      !(await workspace.confirm({
        title: ui.removeApiKeyTitle(providerName(keyProvider)),
        body: ui.removeApiKeyBody,
        action: ui.removeApiKey,
        danger: true,
      }))
    )
      return;
    void run(async () => {
      await api.removeKey(keyProvider);
      await workspace.refresh();
    }, ui.apiKeyRemoved);
  };
  return {
    key,
    setKey,
    keyProvider,
    setKeyProvider,
    status,
    saveKey,
    removeKey,
  };
}

export function ProviderKeyForm({
  settings,
  busy,
  run,
  form,
}: {
  settings: AppSettings;
  busy: boolean;
  run: ActionRunner;
  form: ReturnType<typeof useProviderKeyForm>;
}) {
  const workspace = useWorkspace();
  const {
    key,
    setKey,
    keyProvider,
    setKeyProvider,
    status,
    saveKey,
    removeKey,
  } = form;
  return (
    <section className="settings-card">
      <div className="settings-title">
        <Icon name="shield" />
        <div>
          <h2>
            {providerName(keyProvider)} {ui.apiKeyTitleSuffix}
          </h2>
          <p>{ui.apiKeyStorageHint}</p>
        </div>
        <span className={`pill ${status?.hasKey ? '' : 'gold'}`}>
          {status?.hasKey ? ui.apiKeySavedBadge : ui.apiKeyMissingBadge}
        </span>
      </div>
      <label>
        {ui.apiKeyProvider}
        <select
          value={keyProvider}
          disabled={busy}
          onChange={(e) => {
            setKey('');
            setKeyProvider(e.target.value as 'openai' | 'groq');
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="groq">Groq</option>
        </select>
      </label>
      {status?.hasKey && (
        <div className="credential-row">
          <code>{status.maskedKey}</code>
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={() => void removeKey()}
          >
            {ui.removeApiKey}
          </button>
        </div>
      )}
      <form className="key-form" onSubmit={saveKey}>
        <label>
          {status?.hasKey ? ui.replaceApiKey : ui.addApiKey}
          <input
            type="password"
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            value={key}
            maxLength={2000}
            onChange={(event) => setKey(event.target.value)}
            placeholder={ui.apiKeyPlaceholder}
            required
          />
        </label>
        <button className="button secondary" disabled={busy || !key}>
          {ui.saveSecurely}
        </button>
      </form>
      <div className="credential-actions">
        <button
          className="button secondary"
          disabled={busy || !status?.hasKey || !!workspace.recording}
          onClick={() =>
            void run(
              () =>
                api.testProvider(
                  keyProvider,
                  keyProvider === settings.provider
                    ? settings.chatModel
                    : keyProvider === 'groq'
                      ? 'llama-3.3-70b-versatile'
                      : 'gpt-4o-mini',
                ),
              ui.connectionSucceeded,
            )
          }
        >
          {ui.testConnection}
        </button>
        <span>{ui.testConnectionHint}</span>
      </div>
      <div className="notice">
        <Icon name="cloud" size={18} />
        <p>
          {ui.cloudRequestsNoticePrefix} {providerName(keyProvider)}{' '}
          {ui.cloudRequestsNoticeSuffix}
        </p>
      </div>
    </section>
  );
}
