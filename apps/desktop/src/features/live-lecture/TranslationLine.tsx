import { ui } from '../../i18n';
import type { TranslationPreview } from '../../types/domain';

export function TranslationLine({
  preview,
  size,
}: {
  preview: TranslationPreview;
  size: number;
}) {
  return (
    <div className="caption-preview" data-translation-kind={preview.kind}>
      <p
        className="caption-translation"
        lang={preview.language}
        style={{ fontSize: size }}
      >
        {preview.translatedText}
      </p>
      <small className="translation-preview-label">
        {preview.kind === 'draft'
          ? ui.captionsPreviewDraftLabel
          : ui.captionsPreviewTranslatingLabel}
      </small>
    </div>
  );
}
