import { useCallback, useState } from 'react';
import { ui } from '../../i18n';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { useAction } from '../../hooks/useAction';
import { languageName } from '../../lib/presentation';
import type { Course } from '../../types/domain';

/** Adds a term picked from the transcript to the course glossary. */
export function AddTermDialog({
  course,
  term,
  onClose,
}: {
  course: Course;
  term: string;
  onClose: () => void;
}) {
  const { busy, run } = useAction();
  const [source, setSource] = useState(term),
    [translation, setTranslation] = useState('');
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  return (
    <Modal title={ui.addToGlossaryTitle} onClose={close}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api.saveTerm(
              course.id,
              null,
              source.trim(),
              translation.trim(),
            );
            onClose();
          }, ui.glossaryTermSaved);
        }}
      >
        <label>
          {ui.englishTerm}
          <input
            required
            maxLength={150}
            value={source}
            disabled={busy}
            onChange={(e) => setSource(e.target.value)}
          />
        </label>
        <label>
          {languageName(course.assistanceLanguage)}
          {ui.glossaryMeaningSuffix}
          <input
            data-autofocus
            maxLength={250}
            value={translation}
            disabled={busy}
            placeholder={ui.preferredTranslationPlaceholder}
            onChange={(e) => setTranslation(e.target.value)}
          />
        </label>
        <p className="field-hint">{ui.addToGlossaryHint}</p>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={close}>
            {ui.cancel}
          </button>
          <button className="button primary" disabled={busy || !source.trim()}>
            {ui.addTerm}
          </button>
        </div>
      </form>
    </Modal>
  );
}
