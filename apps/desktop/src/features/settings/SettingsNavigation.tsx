import { Icon, type IconName } from '../../components/Icon';

export type SettingsCategory =
  'setup' | 'general' | 'classroom' | 'ai' | 'storage' | 'privacy' | 'about';
export type AISection = 'services' | 'models' | 'summaries';

export const settingsTitles: Record<SettingsCategory, string> = {
  setup: '首次设置',
  general: '通用',
  classroom: '声音与字幕',
  ai: 'AI 与模型',
  storage: '数据与存储',
  privacy: '安全与隐私',
  about: '关于',
};
const groups: {
  label: string;
  items: { id: SettingsCategory; icon: IconName }[];
}[] = [
  {
    label: '日常使用',
    items: [
      { id: 'general', icon: 'settings' },
      { id: 'classroom', icon: 'mic' },
      { id: 'ai', icon: 'spark' },
    ],
  },
  {
    label: '应用管理',
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
    <nav className="settings-nav" aria-label="设置分类">
      <button
        className="settings-setup-link"
        aria-current={category === 'setup' ? 'page' : undefined}
        onClick={() => onSelect('setup')}
      >
        <Icon name="check" size={18} />
        首次设置
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
