// Where each lecture was last played, so a long review can pick up again.
// Kept per viewer in localStorage; losing it only loses the suggestion.
const key = (id: string) => `lecturerelay-position:${id}`;

export function savedPosition(id: string) {
  try {
    return Number(localStorage.getItem(key(id))) || 0;
  } catch {
    return 0;
  }
}

export function savePosition(id: string, seconds: number) {
  try {
    if (seconds < 5) localStorage.removeItem(key(id));
    else localStorage.setItem(key(id), String(Math.floor(seconds)));
  } catch {
    /* Playback works without the saved position. */
  }
}
