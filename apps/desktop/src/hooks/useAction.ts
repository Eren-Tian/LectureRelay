import { useRef, useState } from 'react';
import { errorText } from '../api/client';
import { useWorkspace } from '../app/Workspace';

export function useAction() {
  const { notify } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const run = async <T>(
    action: () => Promise<T>,
    message?: string,
  ): Promise<T | undefined> => {
    // React state alone does not exclude a second click before the next render.
    if (pending.current) return undefined;
    pending.current = true;
    setBusy(true);
    try {
      const value = await action();
      if (message) notify(message);
      return value;
    } catch (error) {
      notify(errorText(error), true);
      return undefined;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { busy, run };
}

export type ActionRunner = ReturnType<typeof useAction>['run'];
