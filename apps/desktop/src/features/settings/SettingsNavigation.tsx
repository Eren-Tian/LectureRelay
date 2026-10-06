import { Icon, type IconName } from '../../components/Icon';
import { ui } from '../../i18n';

export type SettingsCategory =
  'setup' | 'general' | 'classroom' | 'ai' | 'storage' | 'privacy' | 'about';
export type AISection = 'services' | 'models' | 'summaries';

export const settingsTitles: Record<SettingsCategory, string> = {
  setup: ui.settingsNavSetup,
  general: ui.settingsNavGeneral,
  classroom: ui.settingsNavClassroom,
  ai: ui.settingsNavAI,
  storage: ui.settingsNavStorage,
  privacy: ui.privacy,
  about: ui.about,
};
const groups: {
  label: string;
  items: { id: SettingsCategory; icon: IconName }[];
}[] = [
  {
    label: ui.settingsNavEverydayGroup,
    items: [
      { id: 'general', icon: 'settings' },
      { id: 'classroom', icon: 'mic' },
      { id: 'ai', icon: 'spark' },
    ],
  },
  {
    label: ui.settingsNavAppGroup,
    items: [
      { id: 'storage', icon: 'folder' },
      { id: 'privacy', icon: 'shield' },
      { id: 'about', icon: 'info' },
    ],
  },
];

export function SettingsNavigation({
  category,
  onSelect,
}: {
  category: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
}) {
  return (
    <nav className="settings-nav" aria-label={ui.settingsNavAriaLabel}>
      <button
        className="settings-setup-link"
        aria-current={category === 'setup' ? 'page' : undefined}
        onClick={() => onSelect('setup')}
      >
        <Icon name="check" size={18} />
        {ui.settingsNavSetup}
      </button>
      {groups.map((group) => (
        <div className="settings-nav-group" key={group.label}>
          <span className="settings-nav-label">{group.label}</span>
          {group.items.map(({ id, icon }) => (
            <button
              key={id}
              aria-current={category === id ? 'page' : undefined}
              onClick={() => onSelect(id)}
            >
              <Icon name={icon} size={18} />
              {settingsTitles[id]}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
