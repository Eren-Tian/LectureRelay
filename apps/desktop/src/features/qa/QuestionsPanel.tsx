import { ui } from '../../i18n';
import { Icon } from '../../components/Icon';
import { MarkdownBody } from '../../components/MarkdownBody';
import { clock } from '../../lib/presentation';
import type { FormEvent } from 'react';
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
}: {
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
