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
        <h3>Appearance</h3>
        <div className="theme-options" role="group" aria-label="Appearance">
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
              {value === 'light' ? 'Light' : 'Dark'}
              <span className="theme-selected" aria-hidden="true">
                {theme === value ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
        <p className="field-hint">
          Applies immediately across the app. Saved automatically.
        </p>
      </section>
      <section className="settings-card">
        <label className="toggle-row performance-toggle">
          <span>
            <strong>Quiet Mode</strong>
            <small>Use up to four logical CPU cores for local speech.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Quiet Mode"
            checked={quietMode}
            disabled={busy}
            onChange={(e) => save({ quietMode: e.target.checked })}
          />
        </label>
        <p className="field-hint" role="status">
          {quietMode
            ? 'On · Reduced CPU budget.'
            : 'Off · Full CPU performance. All available CPU cores are allowed.'}{' '}
          Applies to all courses, including speech recognition already running.
          Saved automatically.
        </p>
      </section>
    </>
  );
}
