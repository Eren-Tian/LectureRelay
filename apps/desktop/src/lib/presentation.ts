import { ui } from '../i18n';
import type { ExportKind } from '../types/domain';

export const LANGUAGES = [
  { value: 'zh', label: ui.languageChinese },
  { value: 'ja', label: ui.languageJapanese },
  { value: 'ko', label: ui.languageKorean },
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
  language === 'en'
    ? ui.english
    : (LANGUAGES.find((entry) => entry.value === language)?.label ??
      ui.languageChinese);
const subjectLabels: Record<string, string> = {
  'Computer Science': ui.subjectComputerScience,
  Engineering: ui.subjectEngineering,
  Mathematics: ui.subjectMathematics,
  Physics: ui.subjectPhysics,
  Chemistry: ui.subjectChemistry,
  'Biology / Medicine': ui.subjectBiologyMedicine,
  'Business / Economics': ui.subjectBusinessEconomics,
  'Social Sciences': ui.subjectSocialSciences,
  Humanities: ui.subjectHumanities,
  'Geography / Earth Science': ui.subjectGeographyEarthScience,
  Law: ui.subjectLaw,
  Other: ui.subjectOther,
};
export const subjectName = (subject: string) =>
  subjectLabels[subject] ?? subject;
const exportLabels: Record<ExportKind, string> = {
  notes: ui.exportNotesMarkdown,
  'transcript-json': ui.exportTranscriptJson,
  'transcript-markdown': ui.exportTranscriptMarkdown,
  'srt-source': ui.exportSrtSource,
  'srt-translation': ui.exportSrtTranslation,
  'srt-bilingual': ui.exportSrtBilingual,
  'vtt-source': ui.exportVttSource,
  'vtt-translation': ui.exportVttTranslation,
  'vtt-bilingual': ui.exportVttBilingual,
};
export const exportName = (kind: ExportKind) => exportLabels[kind];
export const taskName = (kind: string) =>
  (
    ({
      transcription: ui.taskTranscription,
      translation: ui.taskTranslation,
      notes: ui.taskNotes,
      review: ui.taskReview,
      question: ui.taskQuestion,
      'provider-test': ui.taskProviderTest,
      'live-captions': ui.liveCaptions,
      import: ui.taskImport,
    }) as Record<string, string>
  )[kind] ?? ui.taskFallback;
export const taskStateName = (state: string) =>
  (
    ({
      running: ui.taskStateRunning,
      completed: ui.taskStateCompleted,
      failed: ui.taskStateFailed,
      cancelled: ui.taskStateCancelled,
      interrupted: ui.taskStateInterrupted,
      stale: ui.taskStateStale,
    }) as Record<string, string>
  )[state] ?? ui.pending;
export const providerName = (provider: string) =>
  provider === 'openai'
    ? 'OpenAI'
    : provider === 'groq'
      ? 'Groq'
      : ui.providerLocalOnly;
export const clock = (seconds: number) => {
  const total = Math.floor(Math.max(0, seconds));
  const parts =
    total >= 3600
      ? [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      : [Math.floor(total / 60), total % 60];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
};
export const dateText = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
