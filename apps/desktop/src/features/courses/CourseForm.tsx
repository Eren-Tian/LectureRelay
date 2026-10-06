import { ui } from '../../i18n';
import { useState, useCallback, type FormEvent } from 'react';
import { api } from '../../api/client';
import { type Course, type CourseInput } from '../../types/domain';
import { LANGUAGES, SUBJECTS, subjectName } from '../../lib/presentation';
import { Modal } from '../../components/Modal';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../app/Workspace';

export function CourseForm({
  course,
  onClose,
}: {
  course?: Course;
  onClose: () => void;
}) {
  const { data, refresh, navigate } = useWorkspace();
  const [input, setInput] = useState<CourseInput>(() => ({
    name: course?.name ?? '',
    code: course?.code ?? '',
    subject: course?.subject ?? SUBJECTS[0],
    description: course?.description ?? '',
    assistanceLanguage:
      course?.assistanceLanguage ?? data.settings.assistanceLanguage,
  }));
  const { busy, run } = useAction();
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const field = <K extends keyof CourseInput>(name: K, value: CourseInput[K]) =>
    setInput((current) => ({ ...current, [name]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const saved = await api.saveCourse(course?.id ?? null, input);
      await refresh();
      onClose();
      navigate({ view: 'course', id: saved.id });
    }, ui.courseSaved);
  };
  return (
    <Modal title={course ? ui.editCourse : ui.newCourse} onClose={close}>
      <form onSubmit={submit} className="form-stack">
        <label>
          {ui.courseName}
          <input
            required
            maxLength={150}
            value={input.name}
            onChange={(event) => field('name', event.target.value)}
            placeholder={ui.courseNamePlaceholder}
          />
        </label>
        <div className="form-grid">
          <label>
            {ui.courseCodeLabel}
            <span className="optional">{ui.optional}</span>
            <input
              maxLength={40}
              value={input.code}
              onChange={(event) => field('code', event.target.value)}
              placeholder="BIO 101"
            />
          </label>
          <label>
            {ui.assistanceLanguage}
            <select
              value={input.assistanceLanguage}
              onChange={(event) =>
                field(
                  'assistanceLanguage',
                  event.target.value as CourseInput['assistanceLanguage'],
                )
              }
            >
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {ui.subject}
          <select
            value={input.subject}
            onChange={(event) => field('subject', event.target.value)}
          >
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subjectName(subject)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {ui.courseContextLabel}
          <span className="optional">{ui.optional}</span>
          <textarea
            maxLength={6000}
            rows={3}
            value={input.description}
            onChange={(event) => field('description', event.target.value)}
            placeholder={ui.courseContextPlaceholder}
          />
        </label>
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
            {busy ? ui.saving : ui.saveCourse}
          </button>
        </div>
      </form>
    </Modal>
  );
}
