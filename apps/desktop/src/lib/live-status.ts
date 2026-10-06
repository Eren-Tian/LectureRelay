import type { LiveStatus, TranslationPreview } from '../types/domain';

/** Events and fallback polls can arrive out of order, including across classes. */
export function nextLiveStatus(
  current: LiveStatus | null,
  next: LiveStatus,
): LiveStatus {
  if (
    current &&
    current.generation !== undefined &&
    next.generation !== undefined
  ) {
    if (next.generation < current.generation) return current;
    if (
      next.generation === current.generation &&
      (next.sequence ?? 0) < (current.sequence ?? 0)
    )
      return current;
  }
  return next;
}

export function visibleTranslationPreview(
  previews: TranslationPreview[] | undefined,
  id: string,
  source: string,
  language: string,
): TranslationPreview | undefined {
  const normalized = (text: string) => text.trim().split(/\s+/u).join(' ');
  return previews?.find((preview) => {
    if (
      preview.id !== id ||
      preview.language !== language ||
      !preview.translatedText.trim()
    )
      return false;
    if (preview.kind === 'final') return preview.sourceText === source;
    const text = normalized(source),
      prefix = normalized(preview.sourceText);
    return !!prefix && (text === prefix || text.startsWith(prefix + ' '));
  });
}
