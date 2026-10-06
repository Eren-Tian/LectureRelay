import { ui } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { MarkdownBody } from '../../components/MarkdownBody';
import { clock, dateText, languageName } from '../../lib/presentation';
import type { Note, StudyState } from '../../types/domain';

export function StudyNotes({
  id,
  note,
  study,
  position,
  onSeek,
  onSaved,
  onGenerate,
  blocked,
  append,
}: {
  id: string;
  note: Note | null;
  study: StudyState;
  position: number;
  onSeek?: (n: number) => void;
  onSaved: () => Promise<void>;
  onGenerate?: () => void;
  blocked: boolean;
  append?: { key: string; body: string };
}) {
  const key = 'lecturerelay-note-draft:' + id;
  const { notify, confirm } = useWorkspace();
  const [draft, setDraft] = useState(() => {
    try {
      return localStorage.getItem(key) ?? study.draft ?? note?.body ?? '';
    } catch {
      return study.draft ?? note?.body ?? '';
    }
  });
  const [editing, setEditing] = useState(() => draft !== (note?.body ?? '')),
    [status, setStatus] = useState(''),
    [saving, setSaving] = useState(false),
    [version, setVersion] = useState('');
  const queue = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    savingRef = useRef(false),
    latest = useRef(draft);
  const appended = useRef('');
  const persist = (body: string) => {
    queue.current = queue.current
      .catch(() => {})
      .then(() => api.saveDraft(id, body));
    return queue.current;
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const change = (value: string) => {
    if (savingRef.current) return;
    latest.current = value;
    setDraft(value);
    setStatus(ui.studyNotesSavingDraft);
    try {
      localStorage.setItem(key, value);
    } catch {
      setStatus(ui.studyNotesRecoveryCacheUnavailable);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(value)
        .then(() => {
          if (latest.current === value)
            setStatus(ui.studyNotesDraftSavedLocally);
        })
        .catch((e) => setStatus(errorText(e)));
    }, 650);
  };
  const save = async (body = draft) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    try {
      await queue.current.catch(() => {});
      await api.saveNote(id, body);
      try {
        localStorage.removeItem(key);
      } catch {
        /* SQLite is authoritative. */
      }
      latest.current = body;
      setDraft(body);
      setEditing(false);
      setVersion('');
      setStatus(ui.saved);
      await onSaved();
    } catch (e) {
      setStatus(errorText(e));
      notify(errorText(e), true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!append || appended.current === append.key || saving) return;
    appended.current = append.key;
    const body = latest.current + append.body;
    if (body.length > 100000) {
      notify(ui.studyNotesLengthLimit, true);
      return;
    }
    change(body);
    // An explicit append should reach SQLite immediately, including a quick exit.
    if (timer.current) clearTimeout(timer.current);
    void persist(body)
      .then(() => {
        if (latest.current === body) setStatus(ui.studyNotesDraftSavedLocally);
      })
      .catch((e) => setStatus(errorText(e)));
    setEditing(true);
    setVersion('');
  }, [append, saving]);
  const selected = study.versions.find((v) => v.id === version);
  return (
    <div className="study-notes">
      <div className="study-toolbar">
        <button
          className="button secondary"
          disabled={saving}
          onClick={() => {
            setEditing(!editing);
            setVersion('');
          }}
        >
          {editing ? ui.studyNotesPreviewDraft : ui.editNotes}
        </button>
        {onGenerate && (
          <button
            className="button secondary"
            disabled={blocked}
            onClick={onGenerate}
          >
            {ui.studyNotesGenerateAiDraft}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <div className="study-toolbar">
            <button
              className="text-button"
              disabled={saving}
              onClick={() =>
                change(
                  draft + `\n[${clock(position)}](#t=${Math.floor(position)}) `,
                )
              }
            >
              {ui.studyNotesInsertTimestamp(clock(position))}
            </button>
            <span role="status" className="muted">
              {status || ui.studyNotesRestoredDraft}
            </span>
          </div>
          <textarea
            className="study-note-editor"
            aria-label={ui.studyNotesEditorLabel}
            value={draft}
            disabled={saving}
            maxLength={100000}
            onChange={(e) => change(e.target.value)}
          />
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: ui.studyNotesDiscardDraftTitle,
                    body: ui.studyNotesDiscardDraftBody,
                    action: ui.studyNotesDiscardDraft,
                    danger: true,
                  }))
                )
                  return;
                if (savingRef.current) return;
                savingRef.current = true;
                setSaving(true);
                if (timer.current) clearTimeout(timer.current);
                try {
                  await queue.current.catch(() => {});
                  await api.clearDraft(id);
                  try {
                    localStorage.removeItem(key);
                  } catch {
                    /* The database draft has already been cleared. */
                  }
                  setDraft(note?.body ?? '');
                  latest.current = note?.body ?? '';
                  setEditing(false);
                  setStatus('');
                } catch (e) {
                  notify(errorText(e), true);
                } finally {
                  savingRef.current = false;
                  setSaving(false);
                }
              }}
            >
              {ui.studyNotesDiscardDraft}
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? ui.saving : ui.saveNotes}
            </button>
          </div>
        </>
      ) : (
        <>
          {draft !== (note?.body ?? '') && !selected && (
            <p className="notice">
              {ui.studyNotesUnsavedDraftNotice}{' '}
              <button className="text-button" onClick={() => setEditing(true)}>
                {ui.studyNotesContinueEditing}
              </button>
            </p>
          )}
          {study.versions.length > 0 && (
            <label className="version-picker">
              {ui.studyNotesVersionHistory}
              <select
                aria-label={ui.studyNotesVersionLabel}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              >
                <option value="">{ui.studyNotesCurrentVersion}</option>
                {study.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.origin === 'local'
                      ? ui.studyNotesLocalAiDraft
                      : v.origin === 'cloud'
                        ? ui.studyNotesCloudAiDraft
                        : ui.studyNotesEarlierNotes}{' '}
                    · {languageName(v.language)} · {dateText(v.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected && (
            <div className="notice">
              <span>
                {selected.sourceVersion !== study.sourceVersion
                  ? ui.studyNotesVersionStale
                  : ui.studyNotesVersionSeparate}
              </span>
              <button
                className="button secondary"
                disabled={saving}
                onClick={async () => {
                  if (
                    await confirm({
                      title: ui.studyNotesUseVersionTitle,
                      body: ui.studyNotesUseVersionBody,
                      action: ui.studyNotesUseVersion,
                    })
                  )
                    await save(selected.body);
                }}
              >
                {ui.studyNotesUseVersion}
              </button>
            </div>
          )}
          {(selected?.body ?? note?.body) ? (
            <MarkdownBody body={selected?.body ?? note!.body} onSeek={onSeek} />
          ) : (
            <div className="empty-state">
              <h3>{ui.studyMyNotes}</h3>
            </div>
          )}
        </>
      )}
    </div>
  );
}
