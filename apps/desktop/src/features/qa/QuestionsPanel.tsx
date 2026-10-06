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
          <h2>{ui.s159}</h2>
          <p>{ui.s160}</p>
        </div>
        <span className="pill">{cloud}</span>
      </div>
      {!answers.length && (
        <div className="empty-state question-empty">
          <Icon name="search" size={32} />
          <h3>{ui.s161}</h3>
          <p>{ui.s162}</p>
        </div>
      )}
      <div className="answer-list">
        {answers.map((answer) => (
          <article className="answer-card" key={answer.id}>
            <h3>{answer.question}</h3>
            <MarkdownBody body={answer.answer} />
            <details>
              <summary>
                {ui.s163}
                {answer.sources.length} {ui.s164}
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
        <label htmlFor="lecture-question">{ui.s165}</label>
        <div>
          <textarea
            id="lecture-question"
            required
            rows={2}
            maxLength={2000}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={ui.s166}
            disabled={blocked || !segments.length}
          />
          <button
            className="button primary"
            disabled={blocked || !question.trim() || !segments.length}
          >
            {ui.s167}
            <Icon name="arrow" size={17} />
          </button>
        </div>
        <p>
          {local ? (
            '问答在本机运行，依据检索到的课堂片段作答。请查看引用核对答案；系统复习整节课可使用“整堂复习”。'
          ) : (
            <>
              {ui.s168}
              {cloud}
              {ui.s169}
            </>
          )}
        </p>
      </form>
    </section>
  );
}
