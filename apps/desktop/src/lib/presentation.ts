import { ui } from '../i18n';

export const LANGUAGES = [
  { value: 'zh', label: ui.s002 },
  { value: 'ja', label: ui.s003 },
  { value: 'ko', label: 'Korean' },
] as const;
export const SUBJECTS = [
  'Computer Science',
  'Engineering',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology / Medicine',
  'Business / Economics',
  'Social Sciences',
  'Humanities',
  'Geography / Earth Science',
  'Law',
  'Other',
];
export const languageName = (language: string) =>
  LANGUAGES.find((entry) => entry.value === language)?.label ?? ui.s004;
export const providerName = (provider: string) =>
  provider === 'openai' ? 'OpenAI' : provider === 'groq' ? 'Groq' : ui.s005;
export const clock = (seconds: number) => {
  const total = Math.floor(Math.max(0, seconds));
  const parts =
    total >= 3600
      ? [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      : [Math.floor(total / 60), total % 60];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
};
export const dateText = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
