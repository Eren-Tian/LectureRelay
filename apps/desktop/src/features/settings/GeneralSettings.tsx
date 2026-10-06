import { RuntimePreferences } from './RuntimePreferences';
import { LANGUAGES } from '../../lib/presentation';
import type { AppSettings } from '../../types/domain';
import type { SettingsSectionProps } from './settings-types';
import { ui } from '../../i18n';
export function GeneralSettings({
  settings,
  setSettings,
  blocked,
}: SettingsSectionProps) {
  return (
    <>
      <RuntimePreferences />
      <section className="settings-card">
        <h3>{ui.generalCoursePreferencesTitle}</h3>
        <label>
          {ui.generalNewCourseLanguage}
          <select
            disabled={blocked}
            value={settings.assistanceLanguage}
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
      </section>
    </>
  );
}
