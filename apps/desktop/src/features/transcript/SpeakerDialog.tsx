import { useState } from 'react';
import { ui } from '../../i18n';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { useAction } from '../../hooks/useAction';
import { clock } from '../../lib/presentation';
import type { TranscriptSegment } from '../../types/domain';

/** Labels who is speaking in one segment, or renames a speaker everywhere. */
export function SpeakerDialog({
  lectureId,
  segment,
  current,
  known,
  onClose,
  onSaved,
}: {
  lectureId: string;
  segment: TranscriptSegment;
  current: string;
  /** Names already used in this lecture. */
  known: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { busy, run } = useAction();
  const [name, setName] = useState(current);
  const choices = [
    ...new Set([...known, ui.speakerTeacher, ui.speakerStudent]),
  ];
  const apply = (task: () => Promise<void>) =>
    void run(async () => {
      await task();
      await onSaved();
      onClose();
    });
  const label = (speaker: string) =>
    apply(() => api.setSpeaker(lectureId, segment.id, speaker));
  const trimmed = name.trim();
  return (
    <Modal title={ui.speakerDialogTitle} onClose={() => !busy && onClose()}>
      <p className="field-hint speaker-excerpt">
        {clock(segment.startSeconds)} · {segment.sourceText}
      </p>
      <div
        className="speaker-choices"
        role="group"
        aria-label={ui.speakerDialogTitle}
      >
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={choice === current ? 'active' : ''}
            aria-pressed={choice === current}
            disabled={busy}
            onClick={() => label(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) label(trimmed);
        }}
      >
        <label>
          {ui.speakerOtherName}
          <input
            data-autofocus
            maxLength={40}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-actions">
          {current && (
            <button
              type="button"
              className="button text danger-text"
              disabled={busy}
              onClick={() => label('')}
            >
              {ui.speakerClear}
            </button>
          )}
          {current && trimmed && trimmed !== current && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() =>
                apply(() => api.renameSpeaker(lectureId, current, trimmed))
              }
            >
              {ui.speakerRenameAll(current)}
            </button>
          )}
          <button className="button primary" disabled={busy || !trimmed}>
            {ui.speakerUse}
          </button>
        </div>
      </form>
    </Modal>
  );
}
