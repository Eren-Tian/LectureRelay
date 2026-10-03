import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { MarkdownBody } from '../../components/MarkdownBody';
import { clock, dateText } from '../../lib/presentation';
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
}: {
  id: string;
  note: Note | null;
  study: StudyState;
  position: number;
  onSeek?: (n: number) => void;
  onSaved: () => Promise<void>;
  onGenerate?: () => void;
  blocked: boolean;
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
    latest = useRef(draft);
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
    latest.current = value;
    setDraft(value);
    setStatus('Saving draft…');
    try {
      localStorage.setItem(key, value);
    } catch {
      setStatus(
        'Local recovery cache is unavailable; waiting for database save.',
      );
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(value)
        .then(() => {
          if (latest.current === value) setStatus('Draft saved on this device');
        })
        .catch((e) => setStatus(errorText(e)));
    }, 650);
  };
  const save = async (body = draft) => {
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
      setStatus('Saved');
      await onSaved();
    } catch (e) {
      setStatus(errorText(e));
      notify(errorText(e), true);
    } finally {
      setSaving(false);
    }
  };
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
          {editing ? 'Preview draft' : 'Write notes'}
        </button>
        {onGenerate && (
          <button
            className="button secondary"
            disabled={blocked}
            onClick={onGenerate}
          >
            Generate AI draft
          </button>
        )}
      </div>
      {editing ? (
        <>
          <div className="study-toolbar">
            <button
              className="text-button"
              onClick={() =>
                change(
                  draft + `\n[${clock(position)}](#t=${Math.floor(position)}) `,
                )
              }
            >
              + Timestamp {clock(position)}
            </button>
            <span role="status" className="muted">
              {status || 'Recovered draft'}
            </span>
          </div>
          <textarea
            className="study-note-editor"
            aria-label="Lecture notes"
            value={draft}
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
                    title: 'Discard this draft?',
                    body: 'Your last saved notes and version history will stay available.',
                    action: 'Discard draft',
                    danger: true,
                  }))
                )
                  return;
                if (timer.current) clearTimeout(timer.current);
                try {
                  await queue.current.catch(() => {});
                  await api.clearDraft(id);
                  localStorage.removeItem(key);
                  setDraft(note?.body ?? '');
                  latest.current = note?.body ?? '';
                  setEditing(false);
                  setStatus('');
                } catch (e) {
                  notify(errorText(e), true);
                }
              }}
            >
              Discard draft
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        </>
      ) : (
        <>
          {draft !== (note?.body ?? '') && !selected && (
            <p className="notice">
              An unpublished draft is available.{' '}
              <button className="text-button" onClick={() => setEditing(true)}>
                Continue writing
              </button>
            </p>
          )}
          {study.versions.length > 0 && (
            <label className="version-picker">
              Saved versions
              <select
                aria-label="Note version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              >
                <option value="">Current notes</option>
                {study.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.origin === 'cloud' ? 'AI draft' : 'Previous notes'} ·{' '}
                    {v.language.toUpperCase()} · {dateText(v.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected && (
            <div className="notice">
              <span>
                {selected.sourceVersion !== study.sourceVersion
                  ? 'Transcript has changed since this version. Check its evidence.'
                  : 'This version is saved separately from your notes.'}
              </span>
              <button
                className="button secondary"
                disabled={saving}
                onClick={async () => {
                  if (
                    await confirm({
                      title: 'Use this version?',
                      body: 'Your current saved notes will remain in version history. Any local draft will be replaced.',
                      action: 'Use version',
                    })
                  )
                    await save(selected.body);
                }}
              >
                Use version
              </button>
            </div>
          )}
          {(selected?.body ?? note?.body) ? (
            <MarkdownBody body={selected?.body ?? note!.body} onSeek={onSeek} />
          ) : (
            <div className="empty-state">
              <h3>Your notes</h3>
              <p>
                Write freely and connect ideas to moments in the recording. AI
                drafts stay separate until you choose one.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
