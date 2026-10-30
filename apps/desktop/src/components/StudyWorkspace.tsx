import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ui } from '../i18n';

export function StudyWorkspace({
  primary,
  secondary,
  primaryLabel = ui.transcript,
  secondaryLabel = ui.studyTools,
  storageKey = 'study-split',
  defaultRatio = 58,
  narrowBelow = 850,
  reveal,
}: {
  /** A changing value brings the secondary panel into view. */
  reveal?: number;
  primary: ReactNode;
  secondary: ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
  /** Remembered split, so each page keeps its own layout. */
  storageKey?: string;
  /** Primary column share (percent) before the user resizes. */
  defaultRatio?: number;
  /** Below this width (px) the two panels become tabs. */
  narrowBelow?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false),
    [panel, setPanel] = useState('primary'),
    [focus, setFocus] = useState(false);
  const [ratio, setRatio] = useState(() => {
    try {
      return Math.max(
        40,
        Math.min(68, Number(localStorage.getItem(storageKey)) || defaultRatio),
      );
    } catch {
      return defaultRatio;
    }
  });
  useEffect(() => {
    if (!reveal) return;
    setPanel('secondary');
    setFocus(false);
  }, [reveal]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setNarrow(entry.contentRect.width < narrowBelow),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [narrowBelow]);
  const resize = (value: number) => {
    const next = Math.max(40, Math.min(68, value));
    setRatio(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      /* Current layout still works. */
    }
  };
  return (
    <div
      ref={root}
      className={`study-workspace ${narrow ? 'narrow' : ''} ${focus ? 'focus-primary' : ''}`}
    >
      <div className="workspace-switcher">
        {narrow ? (
          <div className="tabs" role="tablist" aria-label={ui.workspacePanels}>
            {[
              ['primary', primaryLabel],
              ['secondary', secondaryLabel],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={panel === id}
                onClick={() => setPanel(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <button
            className="text-button"
            aria-pressed={focus}
            onClick={() => setFocus(!focus)}
          >
            {focus
              ? ui.showStudyTools
              : ui.focusOnPanel(primaryLabel.toLowerCase())}
          </button>
        )}
      </div>
      <div
        className="study-columns"
        style={{
          gridTemplateColumns:
            narrow || focus
              ? 'minmax(0,1fr)'
              : `minmax(0,${ratio}fr) 12px minmax(0,${100 - ratio}fr)`,
        }}
      >
        <div className="study-primary" hidden={narrow && panel !== 'primary'}>
          {primary}
        </div>
        {!narrow && !focus && (
          <div
            className="study-divider"
            role="separator"
            aria-label={ui.resizePanels}
            aria-orientation="vertical"
            aria-valuenow={Math.round(ratio)}
            aria-valuemin={40}
            aria-valuemax={68}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                resize(ratio + (e.key === 'ArrowLeft' ? -2 : 2));
              }
              if (e.key === 'Home') resize(defaultRatio);
            }}
            onDoubleClick={() => resize(defaultRatio)}
            onPointerDown={(e) =>
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const box = root.current?.getBoundingClientRect();
              if (box) resize(((e.clientX - box.left) / box.width) * 100);
            }}
            onPointerUp={(e) =>
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          />
        )}
        <div
          className="study-secondary"
          hidden={narrow ? panel !== 'secondary' : focus}
        >
          {secondary}
        </div>
      </div>
    </div>
  );
}
