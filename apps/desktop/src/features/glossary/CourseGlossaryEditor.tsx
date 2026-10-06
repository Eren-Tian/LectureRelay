import { useState, type FormEvent } from 'react';
import { ui } from '../../i18n';
import { api } from '../../api/client';
import { languageName } from '../../lib/presentation';
import { Icon } from '../../components/Icon';
import type { Course, GlossaryTerm } from '../../types/domain';
import type { ActionRunner } from '../../hooks/useAction';

export function CourseGlossaryEditor({
  course,
  terms,
  reload,
  busy,
  run,
}: {
  course: Course;
  terms: GlossaryTerm[];
  reload: () => Promise<void>;
  busy: boolean;
  run: ActionRunner;
}) {
  const id = course.id;
  const [term, setTerm] = useState<GlossaryTerm | null>(null);
  const [source, setSource] = useState('');
  const [translation, setTranslation] = useState('');
  const resetTerm = () => {
    setTerm(null);
    setSource('');
    setTranslation('');
  };
  const saveTerm = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.saveTerm(id, term?.id ?? null, source, translation);
      resetTerm();
      await reload();
    }, ui.glossaryTermSaved);
  };
  return (
    <aside className="glossary-panel">
      <div className="section-heading">
        <h2>{ui.courseGlossary}</h2>
        <span>{terms.length}</span>
      </div>
      <p className="field-hint">{ui.courseGlossaryHint}</p>
      <div className="glossary-list">
        {terms.map((entry) => (
          <div className="glossary-row" key={entry.id}>
            <div>
              <strong>{entry.source}</strong>
              <p>{entry.translation || ui.keepEnglish}</p>
            </div>
            <button
              className="icon-button"
              aria-label={ui.editTermLabel(entry.source)}
              onClick={() => {
                setTerm(entry);
                setSource(entry.source);
                setTranslation(entry.translation);
              }}
            >
              <Icon name="edit" size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={ui.deleteTermLabel(entry.source)}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api.deleteTerm(id, entry.id);
                  await reload();
                })
              }
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
      <form className="form-stack glossary-form" onSubmit={saveTerm}>
        <label>
          {ui.englishTerm}
          <input
            required
            maxLength={150}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={ui.englishTermPlaceholder}
          />
        </label>
        <label>
          {languageName(course.assistanceLanguage)}
          {ui.glossaryMeaningSuffix}
          <input
            maxLength={250}
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            placeholder={ui.preferredTranslationPlaceholder}
          />
        </label>
        <div className="button-row">
          {term && (
            <button type="button" className="button text" onClick={resetTerm}>
              {ui.cancelEdit}
            </button>
          )}
          <button className="button secondary" disabled={busy}>
            {term ? ui.saveChanges : ui.addTerm}
          </button>
        </div>
      </form>
    </aside>
  );
}
