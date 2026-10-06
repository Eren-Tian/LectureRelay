import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useAction } from '../../hooks/useAction';
import type { AppSettings } from '../../types/domain';
import { ui } from '../../i18n';

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
          <h3>{ui.runtimeAppearance}</h3>
          <span className="pill">{ui.runtimeAutoSave}</span>
        </div>
        <div
          className="theme-options"
          role="group"
          aria-label={ui.runtimeAppearance}
        >
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
              {value === 'light' ? ui.runtimeThemeLight : ui.runtimeThemeDark}
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
            <strong>{ui.quietMode}</strong>
            <small>{ui.runtimeQuietModeHint}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label={ui.quietMode}
            checked={quietMode}
            disabled={busy}
            onChange={(e) => save({ quietMode: e.target.checked })}
          />
        </label>
        <p className="field-hint" role="status">
          {quietMode
            ? ui.runtimeQuietModeOnStatus
            : ui.runtimeQuietModeOffStatus}
        </p>
      </section>
    </>
  );
}
