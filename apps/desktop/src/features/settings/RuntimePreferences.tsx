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
        <h3>{'外观'}</h3>
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
        <p className="field-hint">{'立即应用到整个界面，并自动保存。'}</p>
      </section>
      <section className="settings-card">
        <label className="toggle-row performance-toggle">
          <span>
            <strong>{'安静模式'}</strong>
            <small>{'所有本地 AI 共用最多 4 个逻辑 CPU 核心。'}</small>
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
            ? '开启：限制 CPU 占用，减轻电脑负担。'
            : '关闭：允许使用全部可用 CPU 核心，提高处理速度。'}{' '}
          {'对所有课程生效，也会调整正在运行的语音和文本模型，设置自动保存。'}
        </p>
      </section>
    </>
  );
}
