import type { CSSProperties } from 'react';
import { ui } from '../../i18n';
import { Icon } from '../../components/Icon';
import { clock } from '../../lib/presentation';

/** Player controls in the app's own style; the <audio> element stays hidden. */
export function ReplayControls({
  playing,
  position,
  duration,
  speed,
  onToggle,
  onScrub,
  onSpeed,
}: {
  playing: boolean;
  position: number;
  duration: number;
  speed: number;
  onToggle: () => void;
  /** Move the playhead without changing play/pause. */
  onScrub: (seconds: number) => void;
  onSpeed: (speed: number) => void;
}) {
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  return (
    <div className="replay-controls">
      <button
        className="player-play"
        aria-label={playing ? ui.playerPause : ui.playerPlay}
        disabled={duration <= 0}
        onClick={onToggle}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>
      <button
        className="icon-button"
        aria-label={ui.rewind10Seconds}
        title={ui.rewind10Seconds}
        disabled={duration <= 0}
        onClick={() => onScrub(position - 10)}
      >
        <Icon name="rewind" size={18} />
      </button>
      <button
        className="icon-button"
        aria-label={ui.forward10Seconds}
        title={ui.forward10Seconds}
        disabled={duration <= 0}
        onClick={() => onScrub(position + 10)}
      >
        <Icon name="forward" size={18} />
      </button>
      <span className="player-time">
        {clock(position)} / {clock(duration)}
      </span>
      <input
        className="player-progress"
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.1}
        value={Math.min(position, duration)}
        disabled={duration <= 0}
        aria-label={ui.playerProgress}
        aria-valuetext={`${clock(position)} / ${clock(duration)}`}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        onChange={(e) => onScrub(Number(e.target.value))}
      />
      <select
        aria-label={ui.playbackSpeed}
        value={speed}
        onChange={(e) => onSpeed(Number(e.target.value))}
      >
        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => (
          <option key={n} value={n}>
            {n}×
          </option>
        ))}
      </select>
      <span className="player-hint">{ui.playerShortcutHint}</span>
    </div>
  );
}
