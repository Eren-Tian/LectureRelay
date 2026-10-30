// Where each lecture was last played, so a long review can pick up again.
// Kept per viewer in localStorage; losing it only loses the suggestion.
const key = (id: string) => `lecturerelay-position:${id}`;

/** The saved position and when it was saved (0 for older plain values). */
export function savedResume(
  id: string,
): { seconds: number; at: number } | null {
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return null;
    const value: unknown = raw.startsWith('{') ? JSON.parse(raw) : Number(raw);
    if (typeof value === 'number')
      return value > 0 ? { seconds: value, at: 0 } : null;
    const { seconds, at } = value as { seconds?: unknown; at?: unknown };
    return typeof seconds === 'number' && seconds > 0
      ? { seconds, at: typeof at === 'number' ? at : 0 }
      : null;
  } catch {
    return null;
  }
}

export const savedPosition = (id: string) => savedResume(id)?.seconds ?? 0;

export function savePosition(id: string, seconds: number) {
  try {
    if (seconds < 5) localStorage.removeItem(key(id));
    else
      localStorage.setItem(
        key(id),
        JSON.stringify({ seconds: Math.floor(seconds), at: Date.now() }),
      );
  } catch {
    /* Playback works without the saved position. */
  }
}
