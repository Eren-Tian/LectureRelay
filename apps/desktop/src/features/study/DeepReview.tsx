import { useState } from 'react';
import { api } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { useAction } from '../../hooks/useAction';
import type { ReviewCheckpoint } from '../../types/domain';

export function DeepReview({
  id,
  blocked,
  onSaved,
  reviews,
}: {
  id: string;
  blocked: boolean;
  onSaved: () => Promise<void>;
  reviews: ReviewCheckpoint[];
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
      {reviews.map((review) => (
        <article className="task-row" key={review.id}>
          <div>
            <strong>
              {review.publishedVersion
                ? 'Review saved'
                : 'Saved review progress'}
            </strong>
            <p>
              {review.parts.filter((part) => part.body !== null).length} /{' '}
              {review.parts.length} source sections saved
              {review.levels.length > 1
                ? ` · ${review.levels.slice(1).reduce((n, level) => n + level.length, 0)} overview steps saved`
                : ''}
              {review.recoveries
                ? ` · ${review.recoveries} automatic size recoveries`
                : ''}
            </p>
            <p>
              {review.message ||
                (review.publishedVersion
                  ? ''
                  : 'You can leave and resume later. Only unfinished work will run.')}
            </p>
            <details>
              <summary>Saved sections (incomplete until published)</summary>
              <p>{review.request || 'General study notes'}</p>
              {review.parts.map((part, index) => (
                <section key={index}>
                  <strong>
                    Section {index + 1}
                    {part.body ? '' : ' · pending'}
                  </strong>
                  <p
                    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {part.body || 'Not generated yet.'}
                  </p>
                </section>
              ))}
            </details>
          </div>
          {!review.publishedVersion && review.state !== 'stale' && (
            <button
              className="button secondary"
              disabled={blocked || busy || mode === 'none'}
              onClick={() =>
                void run(async () => {
                  if (
                    mode === 'cloud' &&
                    !(await workspace.confirm({
                      title: 'Resume cloud review?',
                      body: 'Remaining text and course context will be sent to your selected provider. Charges may apply.',
                      action: 'Resume review',
                    }))
                  )
                    return;
                  try {
                    await api.resumeReview(id, review.id);
                    workspace.notify('Review saved in Saved versions.');
                  } finally {
                    await onSaved();
                    await workspace.refresh();
                  }
                })
              }
            >
              Resume review
            </button>
          )}
          {review.state === 'stale' && (
            <button
              className="button secondary"
              disabled={blocked || busy}
              onClick={() => setRequest(review.request)}
            >
              Use request for a new review
            </button>
          )}
        </article>
      ))}
    </details>
  );
}
