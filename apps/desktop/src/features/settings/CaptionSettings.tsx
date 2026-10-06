import { Icon } from '../../components/Icon';
import { ui } from '../../i18n';
import { captionSample } from '../../i18n/caption-samples';
import type { SettingsSectionProps } from './settings-types';
export function CaptionSettings({
  settings,
  setSettings,
  blocked,
  onProviders,
}: SettingsSectionProps & { onProviders: () => void }) {
  const toggle = (
    key: 'showEnglish' | 'showTranslation' | 'autoScroll',
    checked: boolean,
  ) =>
    setSettings({
      ...settings,
      [key]: checked,
      ...(!checked && key === 'showEnglish' ? { showTranslation: true } : {}),
      ...(!checked && key === 'showTranslation' ? { showEnglish: true } : {}),
    });
  return (
    <>
      <section className="settings-card">
        <h3>{ui.captionSettingsReadingPreferences}</h3>
        <div className="caption-toggles">
          {(
            [
              ['showEnglish', ui.showEnglish],
              ['showTranslation', ui.showTranslation],
              ['autoScroll', ui.captionSettingsAutoScroll],
            ] as const
          ).map(([key, title]) => (
            <label className="toggle-row" key={key}>
              <span>
                <strong>{title}</strong>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={settings[key]}
                disabled={blocked}
                onChange={(e) => toggle(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
        <div className="settings-two-columns">
          {(
            [
              ['englishFontSize', ui.englishSize, 16, 44],
              ['translationFontSize', ui.translationSize, 14, 36],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <span className="range-control">
                <input
                  type="range"
                  aria-label={label}
                  min={min}
                  max={max}
                  value={settings[key]}
                  disabled={blocked}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: Number(e.target.value) })
                  }
                />
                <output>{settings[key]} px</output>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="settings-card caption-preview">
        <div className="preview-label">
          {ui.captionSettingsPreviewLabel}
          <span>{ui.captionSettingsSampleCaption}</span>
        </div>
        {settings.showEnglish && (
          <p
            className="caption-english"
            style={{ fontSize: settings.englishFontSize }}
          >
            {captionSample.source}
          </p>
        )}
        {settings.showTranslation && (
          <p
            className="caption-translation"
            lang={settings.assistanceLanguage}
            style={{ fontSize: settings.translationFontSize }}
          >
            {captionSample.translations[settings.assistanceLanguage]}
          </p>
        )}
      </section>
      <div className="settings-inline-note">
        <Icon name="cloud" size={18} />
        <p>{ui.captionSettingsProvidersNote}</p>
        <button className="text-button" onClick={onProviders}>
          {ui.captionSettingsGoToSettings}
          <Icon name="arrow" size={14} />
        </button>
      </div>
    </>
  );
}
