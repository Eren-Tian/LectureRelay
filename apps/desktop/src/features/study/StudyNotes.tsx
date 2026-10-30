import { ui } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
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
  const editor = useRef<HTMLTextAreaElement>(null);
  /** Applies Markdown to the selection and keeps it selected. */
  const format = (kind: NoteFormat) => {
    const el = editor.current;
    if (!el) return;
    const { text, start, end } = applyFormat(
      draft,
      el.selectionStart,
      el.selectionEnd,
      kind,
      `[${clock(position)}](#t=${Math.floor(position)}) `,
    );
    change(text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
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
            <div
              className="format-toolbar"
              role="toolbar"
              aria-label={ui.notesFormatToolbar}
            >
              {FORMATS.map(([kind, glyph]) => (
                <button
                  key={kind}
                  type="button"
                  aria-label={formatLabel(kind)}
                  title={formatLabel(kind)}
                  disabled={saving}
                  onClick={() => format(kind)}
                >
                  {glyph}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              disabled={saving}
              onClick={() => format('timestamp')}
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
            ref={editor}
            disabled={saving}
            maxLength={100000}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => {
              if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
              const key = e.key.toLowerCase();
              if (key === 's') void save();
              else if (key === 'b') format('bold');
              else if (key === 'i') format('italic');
              else return;
              e.preventDefault();
            }}
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

type NoteFormat =
  'heading' | 'bold' | 'italic' | 'bullet' | 'numbered' | 'quote' | 'timestamp';
const FORMATS: [NoteFormat, string][] = [
  ['heading', 'H'],
  ['bold', 'B'],
  ['italic', 'I'],
  ['bullet', '•'],
  ['numbered', '1.'],
  ['quote', '❝'],
];
const formatLabel = (kind: NoteFormat) =>
  ({
    heading: ui.notesFormatHeading,
    bold: ui.notesFormatBold,
    italic: ui.notesFormatItalic,
    bullet: ui.notesFormatBullet,
    numbered: ui.notesFormatNumbered,
    quote: ui.notesFormatQuote,
    timestamp: '',
  })[kind];
/** Markdown for one toolbar action; returns the new text and selection. */
function applyFormat(
  text: string,
  from: number,
  to: number,
  kind: NoteFormat,
  stamp: string,
) {
  if (kind === 'timestamp')
    return {
      text: text.slice(0, from) + stamp + text.slice(to),
      start: from + stamp.length,
      end: from + stamp.length,
    };
  if (kind === 'bold' || kind === 'italic') {
    const mark = kind === 'bold' ? '**' : '*';
    const chosen = text.slice(from, to);
    return {
      text: text.slice(0, from) + mark + chosen + mark + text.slice(to),
      start: from + mark.length,
      end: to + mark.length,
    };
  }
  const prefix = { heading: '## ', bullet: '- ', numbered: '1. ', quote: '> ' }[
    kind
  ];
  const lineStart = text.lastIndexOf('\n', from - 1) + 1;
  const block = text
    .slice(lineStart, to)
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
  return {
    text: text.slice(0, lineStart) + block + text.slice(to),
    start: from + prefix.length,
    end: lineStart + block.length,
  };
}
