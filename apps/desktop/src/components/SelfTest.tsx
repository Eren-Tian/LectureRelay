import { ui } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { MarkdownBody } from './MarkdownBody';
import { recallCards } from '../lib/self-test';

/**
 * Shows one heading of the notes at a time with its text hidden. The student
 * recalls it, reveals the text and marks whether they knew it; a second round
 * can repeat only the cards they missed.
 */
export function SelfTest({
  body,
  onSeek,
}: {
  body: string;
  onSeek?: (seconds: number) => void;
}) {
  const cards = recallCards(body);
  const [order, setOrder] = useState(() => cards.map((_, i) => i)),
    [step, setStep] = useState(0),
    [revealed, setRevealed] = useState(false),
    [missed, setMissed] = useState<number[]>([]);
  const action = useRef<HTMLButtonElement>(null),
    moved = useRef(false);
  // The clicked button goes away on every step, so keep the keyboard on the
  // card's main button; opening the view leaves focus where it was.
  useEffect(() => {
    if (moved.current) action.current?.focus();
    moved.current = true;
  }, [step, revealed, order]);
  if (!cards.length) return <p className="empty-state">{ui.selfTestEmpty}</p>;
  const restart = (next: number[]) => {
    setOrder(next);
    setStep(0);
    setRevealed(false);
    setMissed([]);
  };
  const mark = (knew: boolean) => {
    if (!knew) setMissed((list) => [...list, order[step]]);
    setStep(step + 1);
    setRevealed(false);
  };
  if (step >= order.length)
    return (
      <div className="self-test self-test-done" aria-live="polite">
        <h3>{ui.selfTestDone}</h3>
        <p>{ui.selfTestScore(order.length - missed.length, missed.length)}</p>
        <div className="button-row">
          {missed.length > 0 && (
            <button
              ref={action}
              className="button primary"
              onClick={() => restart(missed)}
            >
              {ui.selfTestRetryMissed(missed.length)}
            </button>
          )}
          <button
            ref={missed.length ? undefined : action}
            className="button secondary"
            onClick={() => restart(cards.map((_, i) => i))}
          >
            {ui.selfTestRestart}
          </button>
        </div>
      </div>
    );
  const card = cards[order[step]];
  return (
    <div className="self-test">
      <div className="self-test-progress">
        <span>{ui.selfTestProgress(step + 1, order.length)}</span>
        <progress value={step} max={order.length} aria-hidden="true" />
      </div>
      <article className="self-test-card">
        {card.path.length > 0 && (
          <p className="self-test-path">{card.path.join(' › ')}</p>
        )}
        <h3>{card.heading}</h3>
        {revealed ? (
          <div className="self-test-answer">
            <MarkdownBody body={card.body} onSeek={onSeek} />
          </div>
        ) : (
          <p className="self-test-hint">{ui.selfTestRecallHint}</p>
        )}
      </article>
      <div className="button-row">
        {revealed ? (
          <>
            <button
              ref={action}
              className="button primary"
              onClick={() => mark(true)}
            >
              {ui.selfTestKnew}
            </button>
            <button className="button secondary" onClick={() => mark(false)}>
              {ui.selfTestMissed}
            </button>
          </>
        ) : (
          <button
            ref={action}
            className="button primary"
            onClick={() => setRevealed(true)}
          >
            {ui.selfTestReveal}
          </button>
        )}
      </div>
    </div>
  );
}
