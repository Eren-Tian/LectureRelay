import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useAction } from '../../hooks/useAction';
import type { AppSettings } from '../../types/domain';

export function RuntimePreferences() {
  const { data, refresh } = useWorkspace();
  const { busy, run } = useAction();
  const { theme, quietMode } = data.settings;
  const save = (change: Partial<Pick<AppSettings, 'theme' | 'quietMode'>>) =>
    void run(async () => {
      await api.saveRuntimePreferences(change);
      await refresh();
    });
  return (
    <>
      <section className="settings-card">
        <div className="settings-title">
          <h3>外观</h3>
          <span className="pill">自动保存</span>
        </div>
        <div className="theme-options" role="group" aria-label="外观">
          {(['light', 'dark'] as const).map((value) => (
            <button
              key={value}
              className="theme-option"
              aria-pressed={theme === value}
              disabled={busy}
              onClick={() => save({ theme: value })}
            >
              <span className={`theme-preview ${value}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {value === 'light' ? '浅色' : '深色'}
              <span className="theme-selected" aria-hidden="true">
                {theme === value ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="settings-card">
        <label className="toggle-row performance-toggle">
          <span>
            <strong>{'安静模式'}</strong>
            <small>{'本地 AI 共用最多 4 个 CPU 核心'}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="安静模式"
            checked={quietMode}
            disabled={busy}
            onChange={(e) => save({ quietMode: e.target.checked })}
          />
        </label>
        <p className="field-hint" role="status">
          {quietMode
            ? '已限制 CPU 占用 · 自动保存'
            : '全速运行，功耗更高 · 自动保存'}
        </p>
      </section>
    </>
  );
}
