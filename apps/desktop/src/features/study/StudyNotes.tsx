import { ui } from '../../i18n';
import { useEffect, useState } from 'react';
import { useNoteDraft } from './useNoteDraft';
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
  const { confirm } = useWorkspace();
  const [version, setVersion] = useState('');
  const {
    draft,
    editing,
    setEditing,
    status,
    saving,
    change,
    commit,
    discard,
  } = useNoteDraft({
    id,
    savedBody: note?.body ?? '',
    databaseDraft: study.draft,
    append,
    onSaved,
  });
  const save = async (body?: string) => {
    if (await commit(body)) setVersion('');
  };
  useEffect(() => {
    if (append) setVersion('');
  }, [append]);
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
                await discard();
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
