import { RuntimePreferences } from './RuntimePreferences';
import { LanguageOptions } from '../../components/LanguageOptions';
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
            <LanguageOptions />
          </select>
        </label>
      </section>
    </>
  );
}
