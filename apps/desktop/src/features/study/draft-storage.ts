import { api } from '../../api/client';

const prefix = 'lecturerelay-note-draft:';
const recovery = new Map<string, string>();
const writes = new Map<string, Promise<void>>();
function enqueue(id: string, write: () => Promise<void>) {
  const pending = (writes.get(id) ?? Promise.resolve())
    .catch(() => {})
    .then(write);
  writes.set(id, pending);
  const cleanup = () => {
    if (writes.get(id) === pending) writes.delete(id);
  };
  void pending.then(cleanup, cleanup);
  return pending;
}
export const draftStorage = {
  read(id: string, fallback: string) {
    if (recovery.has(id)) return recovery.get(id)!;
    try {
      return localStorage.getItem(prefix + id) ?? fallback;
    } catch {
      return fallback;
    }
  },
  write(id: string, body: string) {
    // Keep a session fallback even when the browser cache is unavailable.
    recovery.set(id, body);
    localStorage.setItem(prefix + id, body);
  },
  remove(id: string) {
    recovery.delete(id);
    localStorage.removeItem(prefix + id);
  },
  persist(id: string, body: string) {
    return enqueue(id, () => api.saveDraft(id, body));
  },
  commit(id: string, body: string) {
    return enqueue(id, async () => {
      await api.saveNote(id, body);
      try {
        draftStorage.remove(id);
      } catch {
        /* SQLite has committed. */
      }
    });
  },
  discard(id: string) {
    return enqueue(id, async () => {
      await api.clearDraft(id);
      try {
        draftStorage.remove(id);
      } catch {
        /* SQLite has cleared the draft. */
      }
    });
  },
};

/** Only remove fallback drafts after native storage confirms deletion. */
export async function pruneDeletedDrafts() {
  const cached = Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
  const ids = [...new Set([...cached, ...recovery.keys()])];
  for (let offset = 0; offset < ids.length; offset += 250) {
    const batch = ids.slice(offset, offset + 250);
    const existing = new Set(await api.existingLectureIds(batch));
    for (const id of batch) if (!existing.has(id)) draftStorage.remove(id);
  }
}
