import { ui } from '../../i18n';
import { messageText } from '../../i18n/messages';
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
      <summary>{ui.deepReviewTitle}</summary>
      <p>{ui.deepReviewDescription}</p>
      <label>
        {ui.deepReviewRequestLabel}
        <textarea
          rows={3}
          maxLength={2000}
          value={request}
          disabled={blocked || busy}
          onChange={(e) => setRequest(e.target.value)}
          placeholder={ui.deepReviewRequestPlaceholder}
        />
      </label>
      <p className="field-hint">
        {mode === 'local'
          ? ui.deepReviewLocalHint
          : mode === 'cloud'
            ? ui.deepReviewCloudHint
            : ui.deepReviewDisabledHint}
      </p>
      <button
        className="button secondary"
        disabled={blocked || busy || !request.trim() || mode === 'none'}
        onClick={() =>
          void run(async () => {
            if (
              mode === 'cloud' &&
              !(await workspace.confirm({
                title: ui.deepReviewGenerateTitle,
                body: ui.deepReviewGenerateBody,
                action: ui.deepReviewGenerate,
              }))
            )
              return;
            try {
              await api.generateReview(id, request);
              workspace.notify(ui.deepReviewSavedNotice);
            } finally {
              await onSaved();
              await workspace.refresh();
            }
          })
        }
      >
        {ui.deepReviewGenerate}
      </button>
      {reviews
        .filter((review) => review.request.trim())
        .map((review) => (
          <article className="task-row" key={review.id}>
            <div>
              <strong>
                {review.publishedVersion
                  ? ui.deepReviewPublished
                  : ui.deepReviewSavedProgress}
              </strong>
              <p>
                {ui.deepReviewPartsProgress(
                  review.parts.filter((part) => part.body !== null).length,
                  review.parts.length,
                )}
                {review.levels.length > 1
                  ? ` · ${ui.deepReviewSynthesisStepsDone(review.levels.slice(1).reduce((n, level) => n + level.length, 0))}`
                  : ''}
                {review.recoveries
                  ? ` · ${ui.deepReviewAutoRetries(review.recoveries)}`
                  : ''}
              </p>
              <p>
                {messageText(review.message) ||
                  (review.publishedVersion ? '' : ui.deepReviewResumeHint)}
              </p>
              <details>
                <summary>{ui.deepReviewPartialDrafts}</summary>
                <p>{review.request || ui.deepReviewDefaultRequest}</p>
                {review.parts.map((part, index) => (
                  <section key={index}>
                    <strong>
                      {ui.deepReviewPartTitle(index + 1)}
                      {part.body ? '' : ` · ${ui.pending}`}
                    </strong>
                    <p
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {part.body || ui.deepReviewPartNotGenerated}
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
                        title: ui.deepReviewResumeTitle,
                        body: ui.deepReviewResumeBody,
                        action: ui.deepReviewResume,
                      }))
                    )
                      return;
                    try {
                      await api.resumeReview(id, review.id);
                      workspace.notify(ui.deepReviewSavedNotice);
                    } finally {
                      await onSaved();
                      await workspace.refresh();
                    }
                  })
                }
              >
                {ui.deepReviewResume}
              </button>
            )}
            {review.state === 'stale' && (
              <button
                className="button secondary"
                disabled={blocked || busy}
                onClick={() => setRequest(review.request)}
              >
                {ui.deepReviewRegenerate}
              </button>
            )}
          </article>
        ))}
    </details>
  );
}
