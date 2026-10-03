import { useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useAction } from '../../hooks/useAction';

export function DeepReview({
  id,
  blocked,
  onSaved,
}: {
  id: string;
  blocked: boolean;
  onSaved: () => Promise<void>;
}) {
  const [request, setRequest] = useState('');
  const { busy, run } = useAction();
  const workspace = useWorkspace();
  const mode = workspace.data.settings.studyMode;
  return (
    <details className="settings-advanced">
      <summary>Review the whole class</summary>
      <p>
        Processes every transcript section, then saves a new study guide with
        timestamps. Check the draft against the source. Your existing notes stay
        available.
      </p>
      <label>
        What would you like to review?
        <textarea
          rows={3}
          maxLength={2000}
          value={request}
          disabled={blocked || busy}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="Explain the key concepts and how they connect. Include common mistakes and five practice questions."
        />
      </label>
      <p className="field-hint">
        {mode === 'local'
          ? 'Qwen3.5-4B · on this computer · no API charges'
          : mode === 'cloud'
            ? 'Uses your selected cloud provider. Transcript and course context are sent; charges may apply.'
            : 'Study AI is off. Choose a model in Settings.'}
      </p>
      <button
        className="button secondary"
        disabled={blocked || busy || !request.trim() || mode === 'none'}
        onClick={() =>
          void run(async () => {
            if (
              mode === 'cloud' &&
              !(await workspace.confirm({
                title: 'Generate a full-class review?',
                body: 'The full transcript and course context will be sent to your selected cloud provider. Provider charges may apply.',
                action: 'Generate review',
              }))
            )
              return;
            try {
              await api.generateReview(id, request);
              workspace.notify('Review saved in Saved versions.');
            } finally {
              await onSaved();
              await workspace.refresh();
            }
          })
        }
      >
        Generate review
      </button>
    </details>
  );
}
