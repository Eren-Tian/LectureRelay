import { ui } from '../../i18n';
import { useCallback, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import {
  type AssistanceLanguage,
  type SegmentInput,
  type TranscriptSegment,
} from '../../types/domain';
import { languageName } from '../../lib/presentation';
import { Modal } from '../../components/Modal';
import { useAction } from '../../hooks/useAction';

export function SegmentForm({
  lectureId,
  duration,
  language,
  segment,
  onClose,
  onSaved,
}: {
  lectureId: string;
  duration: number;
  language: AssistanceLanguage;
  segment?: TranscriptSegment;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [input, setInput] = useState<SegmentInput>({
    startSeconds: segment?.startSeconds ?? 0,
    endSeconds: segment?.endSeconds ?? Math.min(duration, 30),
    sourceText: segment?.sourceText ?? '',
    translatedText: segment?.translatedText ?? '',
  });
  const { busy, run } = useAction();
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.saveSegment(lectureId, segment?.id ?? null, input);
      await onSaved();
      onClose();
    }, ui.transcriptSaved);
  };
  return (
    <Modal
      title={segment ? ui.correctTranscript : ui.addSegment}
      onClose={close}
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <label>
            {ui.startSecondsLabel}
            <input
              type="number"
              required
              min={0}
              max={duration}
              step="any"
              value={input.startSeconds}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  startSeconds: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            {ui.endSecondsLabel}
            <input
              type="number"
              required
              min={input.startSeconds}
              max={duration}
              step="any"
              value={input.endSeconds}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  endSeconds: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
        <label>
          {ui.english}
          <textarea
            required
            rows={4}
            maxLength={8000}
            value={input.sourceText}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                sourceText: event.target.value,
              }))
            }
            placeholder={ui.transcriptPlaceholder}
          />
        </label>
        <label>
          {languageName(language)}
          {ui.segmentTranslationSuffix}
          <span className="optional">{ui.optional}</span>
          <textarea
            rows={3}
            maxLength={10000}
            value={input.translatedText}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                translatedText: event.target.value,
              }))
            }
          />
        </label>
        <p className="field-hint">{ui.segmentFormHint}</p>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={close}
            disabled={busy}
          >
            {ui.cancel}
          </button>
          <button className="button primary" disabled={busy}>
            {ui.saveTranscript}
          </button>
        </div>
      </form>
    </Modal>
  );
}
