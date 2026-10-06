import { useEffect, useRef, useState, type ReactNode } from 'react';

export function StudyWorkspace({
  primary,
  secondary,
  primaryLabel = '转录文本',
}: {
  primary: ReactNode;
  secondary: ReactNode;
  primaryLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false),
    [panel, setPanel] = useState('primary'),
    [focus, setFocus] = useState(false);
  const [ratio, setRatio] = useState(() => {
    try {
      return Math.max(
        40,
        Math.min(68, Number(localStorage.getItem('study-split')) || 58),
      );
    } catch {
      return 58;
    }
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setNarrow(entry.contentRect.width < 850),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const resize = (value: number) => {
    const next = Math.max(40, Math.min(68, value));
    setRatio(next);
    try {
      localStorage.setItem('study-split', String(next));
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
          <div className="tabs" role="tablist" aria-label="工作区面板">
            {[
              ['primary', primaryLabel],
              ['secondary', '学习工具'],
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
            {focus ? '显示学习工具' : '专注阅读' + primaryLabel.toLowerCase()}
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
            aria-label="调整面板宽度"
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
              if (e.key === 'Home') resize(58);
            }}
            onDoubleClick={() => resize(58)}
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
