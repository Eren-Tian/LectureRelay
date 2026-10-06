import { Icon } from '../../components/Icon';
import type { SettingsSectionProps } from './settings-types';
const samples = {
  zh: '把新知识与已知的事物联系起来，会让学习更轻松。',
  ja: '新しい知識を知っていることと結びつけると、学びやすくなります。',
  ko: '새로운 지식을 이미 아는 것과 연결하면 더 쉽게 배울 수 있습니다.',
};
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
        <h3>{'阅读偏好'}</h3>
        <div className="caption-toggles">
          {(
            [
              ['showEnglish', '显示英文原文'],
              ['showTranslation', '显示译文'],
              ['autoScroll', '自动跟随最新字幕'],
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
              ['englishFontSize', '英文字号', 16, 44],
              ['translationFontSize', '译文字号', 14, 36],
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
          {'字幕预览'}
          <span>{'示例字幕'}</span>
        </div>
        {settings.showEnglish && (
          <p
            className="caption-english"
            style={{ fontSize: settings.englishFontSize }}
          >
            Learning becomes easier when we connect new ideas to what we already
            know.
          </p>
        )}
        {settings.showTranslation && (
          <p
            className="caption-translation"
            lang={settings.assistanceLanguage}
            style={{ fontSize: settings.translationFontSize }}
          >
            {samples[settings.assistanceLanguage]}
          </p>
        )}
      </section>
      <div className="settings-inline-note">
        <Icon name="cloud" size={18} />
        <p>{'字幕使用的模型与服务'}</p>
        <button className="text-button" onClick={onProviders}>
          {'前往设置'}
          <Icon name="arrow" size={14} />
        </button>
      </div>
    </>
  );
}
