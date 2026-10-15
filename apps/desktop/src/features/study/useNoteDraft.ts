import { useEffect, useRef, useState } from 'react';
import { errorText } from '../../api/client';
import { useWorkspace } from '../../app/Workspace';
import { ui } from '../../i18n';
import { draftStorage } from './draft-storage';

/** One lecture's recovery, ordered writes, commit, discard and explicit appends. */
export function useNoteDraft({
  id,
  savedBody,
  databaseDraft,
  append,
  onSaved,
}: {
  id: string;
  savedBody: string;
  databaseDraft: string | null;
  append?: { key: string; body: string };
  onSaved: () => Promise<void>;
}) {
  const { notify } = useWorkspace();
  const [draft, setDraft] = useState(() =>
    draftStorage.read(id, databaseDraft ?? savedBody),
  );
  const [editing, setEditing] = useState(() => draft !== savedBody);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const latest = useRef(draft);
  const appended = useRef('');
  const persist = (body: string) => draftStorage.persist(id, body);
  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      // A fast navigation must not depend only on the browser recovery cache.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void persist(latest.current).catch(() => {});
      }
    },
    [],
  );
  const change = (value: string) => {
    if (savingRef.current) return;
    latest.current = value;
    setDraft(value);
    setStatus(ui.studyNotesSavingDraft);
    try {
      draftStorage.write(id, value);
    } catch {
      setStatus(ui.studyNotesRecoveryCacheUnavailable);
    }
    stopTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      void persist(value)
        .then(() => {
          if (latest.current === value)
            setStatus(ui.studyNotesDraftSavedLocally);
        })
        .catch((e) => setStatus(errorText(e)));
    }, 650);
  };
  const commit = async (body = latest.current) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    stopTimer();
    try {
      await draftStorage.commit(id, body);
      latest.current = body;
      setDraft(body);
      setEditing(false);
      setStatus(ui.saved);
      await onSaved();
      return true;
    } catch (e) {
      setStatus(errorText(e));
      notify(errorText(e), true);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const discard = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    stopTimer();
    try {
      await draftStorage.discard(id);
      latest.current = savedBody;
      setDraft(savedBody);
      setEditing(false);
      setStatus('');
    } catch (e) {
      notify(errorText(e), true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!append || appended.current === append.key || saving) return;
    const body = latest.current + append.body;
    appended.current = append.key;
    if (body.length > 100000) {
      notify(ui.studyNotesLengthLimit, true);
      return;
    }
    change(body);
    stopTimer();
    void persist(body)
      .then(() => {
        if (latest.current === body) setStatus(ui.studyNotesDraftSavedLocally);
      })
      .catch((e) => setStatus(errorText(e)));
    setEditing(true);
  }, [append, saving]);
  return {
    draft,
    editing,
    setEditing,
    status,
    saving,
    change,
    commit,
    discard,
  };
}
