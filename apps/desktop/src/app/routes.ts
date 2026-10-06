export type SettingsEntry =
  'setup' | 'audio' | 'models' | 'services' | 'summaries';
export type Route =
  | { view: 'courses' }
  | { view: 'settings'; entry?: SettingsEntry }
  | { view: 'course'; id: string }
  | { view: 'live'; id: string }
  | { view: 'lecture'; id: string };
