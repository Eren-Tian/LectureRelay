import { ui } from '../../i18n';
import { Icon } from '../../components/Icon';
import { MarkdownBody } from '../../components/MarkdownBody';
import { dateText } from '../../lib/presentation';
import { useWorkspace } from '../../app/Workspace';
import type { Note, Lecture, TranscriptSegment } from '../../types/domain';

export function NotesPanel({
  note,
  lecture,
  segments,
  editingNote,
  draft,
  blocked,
  busy,
  setDraft,
  setEditingNote,
  beginAI,
  saveNote,
  exportFile,
}: {
  note: Note | null;
  lecture: Lecture;
  segments: TranscriptSegment[];
  editingNote: boolean;
  draft: string;
  blocked: boolean;
  busy: boolean;
  setDraft: (value: string) => void;
  setEditingNote: (value: boolean) => void;
  beginAI: (kind: 'notes') => Promise<void>;
  saveNote: () => void;
  exportFile: (kind: 'notes') => void;
}) {
  const workspace = useWorkspace();
  return (
    <section className="review-panel">
      <div className="section-heading">
        <div>
          <h2>{ui.notes}</h2>
          <p>
            {note
              ? ui.notesMeta(
                  note.origin === 'cloud'
                    ? ui.notesOriginAi
                    : ui.notesOriginManual,
                  dateText(note.updatedAt),
                )
              : ui.notesDescription}
          </p>
        </div>
        <div className="button-row">
          <button
            className="button secondary"
            disabled={blocked}
            onClick={() => {
              setDraft(note?.body ?? `# ${lecture.title}\n\n`);
              setEditingNote(true);
            }}
          >
            <Icon name="edit" size={16} />
            {ui.editNotes}
          </button>
          <button
            className="button primary"
            disabled={blocked || !segments.length}
            onClick={() => void beginAI('notes')}
          >
            <Icon name="spark" size={17} />
            {ui.generateNotes}
          </button>
        </div>
      </div>
      {editingNote ? (
        <div className="note-editor">
          <textarea
            aria-label={ui.markdownNotes}
            rows={18}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={100000}
          />
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  !(await workspace.confirm({
                    title: ui.discardNoteChangesTitle,
                    body: ui.discardNoteChangesBody,
                    action: ui.discardChanges,
                  }))
                )
                  return;
                setEditingNote(false);
              }}
            >
              {ui.cancelEdit}
            </button>
            <button
              className="button primary"
              disabled={blocked}
              onClick={saveNote}
            >
              {ui.saveNotes}
            </button>
          </div>
        </div>
      ) : note ? (
        <MarkdownBody body={note.body} />
      ) : (
        <div className="empty-state">
          <Icon name="books" size={32} />
          <h3>{ui.noNotesTitle}</h3>
          <p>{ui.noNotesBody}</p>
        </div>
      )}
      <div className="review-footer">
        <span>{ui.notesStoredLocally}</span>
        <button
          className="text-button"
          disabled={busy || !note}
          onClick={() => exportFile('notes')}
        >
          <Icon name="download" size={15} />
          {ui.exportMarkdown}
        </button>
      </div>
    </section>
  );
}
