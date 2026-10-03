import { useState, useCallback, useRef, useEffect } from 'react';
import { errorText } from '../api/client';

export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const reload = useCallback(async () => {
    const current = ++generation.current;
    try {
      const value = await load();
      if (current !== generation.current) return;
      setData(value);
      setError('');
    } catch (error) {
      if (current !== generation.current) return;
      setError(errorText(error));
    }
  }, [load]);
  return { data, error, reload };
}
