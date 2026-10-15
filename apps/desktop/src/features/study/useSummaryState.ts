import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';
import type { SummaryState } from '../../types/domain';

/** Owns snapshot ordering, polling, subscriptions and manual generation. */
export function useSummaryState(id: string) {
  const [state, setState] = useState<SummaryState>();
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [busy, setBusy] = useState(false);
  const currentId = useRef(id);
  currentId.current = id;
  const generation = useRef(0);
  const mounted = useRef(false);
  const action = useRef<object | null>(null);
  const reading = useRef<object | null>(null);
  const reload = useCallback(
    async (replace = false) => {
      if (!mounted.current || currentId.current !== id) return;
      // Polling coalesces while a read is outstanding; explicit invalidation can replace it.
      if (reading.current && !replace) return;
      const token = {};
      reading.current = token;
      const request = ++generation.current;
      const current = () =>
        mounted.current &&
        currentId.current === id &&
        request === generation.current;
      try {
        const result = await api.summaryState(id);
        if (!current()) return;
        setState(result);
        setReadError('');
      } catch (e) {
        if (current()) setReadError(errorText(e));
      } finally {
        if (reading.current === token) reading.current = null;
      }
    },
    [id],
  );
  useEffect(() => {
    mounted.current = true;
    setState(undefined);
    setError('');
    setReadError('');
    setBusy(false);
    action.current = null;
    reading.current = null;
    let active = true;
    void reload();
    const timer = setInterval(() => void reload(), 2000);
    const subscription = listen<string>('summary-updated', (event) => {
      if (active && event.payload === id) void reload(true);
    }).catch(() => () => {});
    return () => {
      active = false;
      mounted.current = false;
      generation.current++;
      clearInterval(timer);
      void subscription.then((off) => off());
    };
  }, [id, reload]);
  const generate = async (cardId: string | null = null) => {
    if (action.current) return;
    const token = {};
    action.current = token;
    setBusy(true);
    setError('');
    const current = () =>
      mounted.current && currentId.current === id && action.current === token;
    try {
      await api.summarizeNow(id, cardId);
    } catch (e) {
      if (current()) setError(errorText(e));
    } finally {
      if (current()) {
        action.current = null;
        setBusy(false);
        await reload(true);
      }
    }
  };
  return { state, error: error || readError, setError, busy, generate, reload };
}
