import { ui } from '../../i18n';
import { useWorkspace } from '../../app/Workspace';
import { Icon } from '../../components/Icon';
import { MarkdownBody } from '../../components/MarkdownBody';
import { clock } from '../../lib/presentation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TranscriptSegment, Answer } from '../../types/domain';

export function QuestionsPanel({
  answers,
  cloud,
  local = false,
  blocked,
  question,
  segments,
  seek,
  ask,
  setQuestion,
  focusRequested = false,
  onFocused,
  onAddToNotes,
}: {
  onAddToNotes?: (answer: Answer) => void;
  /** Focus the question box once it is on screen, then report back. */
  focusRequested?: boolean;
  onFocused?: () => void;
  answers: Answer[];
  cloud: string;
  local?: boolean;
  blocked: boolean;
  question: string;
  segments: TranscriptSegment[];
  seek: (seconds: number) => void;
  ask: (event: FormEvent) => void;
  setQuestion: (value: string) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState('');
  const { notify } = useWorkspace();
  useEffect(() => {
    if (!focusRequested || !input.current) return;
    input.current.focus();
    onFocused?.();
  }, [focusRequested, onFocused]);
  return (
    <section className="review-panel">
      <div className="section-heading">
        <div>
          <h2>{ui.questionsTitle}</h2>
          <p>{ui.questionsDescription}</p>
        </div>
        <span className="pill">{cloud}</span>
      </div>
      {!answers.length && (
        <div className="empty-state question-empty">
          <Icon name="search" size={32} />
          <h3>{ui.noQuestionsTitle}</h3>
          <p>{ui.noQuestionsBody}</p>
        </div>
      )}
      <div className="answer-list">
        {answers.map((answer) => (
          <article className="answer-card" key={answer.id}>
            <h3>{answer.question}</h3>
            <MarkdownBody body={answer.answer} />
            <div className="answer-actions">
              {onAddToNotes && (
                <button
                  className="text-button"
                  onClick={() => onAddToNotes(answer)}
                >
                  {ui.summaryAddToNotes}
                </button>
              )}
              <button
                className="text-button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(answer.answer)
                    .then(() => setCopied(answer.id))
                    .catch(() => notify(ui.answerCopyFailed, true))
                }
              >
                {copied === answer.id ? ui.answerCopied : ui.answerCopy}
              </button>
            </div>
            <details>
              <summary>
                {ui.viewEvidencePrefix}
                {answer.sources.length} {ui.segmentCountSuffix}
              </summary>
              <div className="source-chips">
                {answer.sources.map((source, index) => (
                  <button
                    key={source.id}
                    onClick={() => seek(source.startSeconds)}
                  >
                    <span>
                      S{index + 1} · {clock(source.startSeconds)}
                    </span>
                    {source.sourceText}
                  </button>
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
      <form className="question-form" onSubmit={ask}>
        <label htmlFor="lecture-question">{ui.askThisLecture}</label>
        <div>
          <textarea
            id="lecture-question"
            ref={input}
            required
            rows={2}
            maxLength={2000}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={ui.questionPlaceholder}
            disabled={blocked || !segments.length}
          />
          <button
            className="button primary"
            disabled={blocked || !question.trim() || !segments.length}
          >
            {ui.ask}
            <Icon name="arrow" size={17} />
          </button>
        </div>
        <p>
          {local ? (
            ui.localQuestionNotice
          ) : (
            <>
              {ui.cloudQuestionNoticePrefix}
              {cloud}
              {ui.cloudQuestionNoticeSuffix}
            </>
          )}
        </p>
      </form>
    </section>
  );
}
