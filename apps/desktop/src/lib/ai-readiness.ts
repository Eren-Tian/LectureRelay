import type { AppSettings, ProviderStatus } from '../types/domain';

export type AiTask = 'transcription' | 'live-speech' | 'translation' | 'study';

/** Configuration only: native commands still check installed models and credentials. */
export function aiReadiness(
  settings: AppSettings,
  providers: ProviderStatus[],
  task: AiTask,
) {
  const speech = task === 'transcription' || task === 'live-speech';
  const choice = speech
    ? settings.speechProvider
    : task === 'translation'
      ? settings.translationMode
      : settings.studyMode;
  const mode =
    choice === 'local'
      ? 'local'
      : choice === 'none' && task !== 'transcription'
        ? 'none'
        : 'cloud';
  const provider =
    speech && (choice === 'openai' || choice === 'groq')
      ? choice
      : settings.provider;
  const configured =
    mode === 'local' ||
    (mode === 'cloud' &&
      provider !== 'none' &&
      providers.some((p) => p.provider === provider && p.hasKey));
  return { mode, provider, configured };
}
