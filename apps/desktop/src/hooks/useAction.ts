import { useState } from 'react';
import { errorText } from '../api/client';
import { useWorkspace } from '../app/Workspace';

export function useAction() {
  const { notify } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const run = async <T>(
    action: () => Promise<T>,
    message?: string,
  ): Promise<T | undefined> => {
    setBusy(true);
    try {
      const value = await action();
      if (message) notify(message);
      return value;
    } catch (error) {
      notify(errorText(error), true);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export type ActionRunner = ReturnType<typeof useAction>['run'];
