import { useEffect, useRef, useState } from 'react';
import type { AppSettings } from '../../types/domain';

export function mergeSettingsDraft(
  draft: AppSettings,
  previous: AppSettings,
  saved: AppSettings,
): AppSettings {
  const merged = { ...draft };
  const update = <K extends keyof AppSettings>(key: K) => {
    // Summary settings have their own save workflow; do not submit a stale copy.
    if (key === 'liveSummaries' || draft[key] === previous[key])
      merged[key] = saved[key];
  };
  for (const key of Object.keys(saved) as (keyof AppSettings)[]) update(key);
  return merged;
}

export function useSettingsDraft(saved: AppSettings) {
  const [settings, setSettings] = useState(saved);
  const previous = useRef(saved);
  useEffect(() => {
    const before = previous.current;
    previous.current = saved;
    setSettings((draft) => mergeSettingsDraft(draft, before, saved));
  }, [saved]);
  return {
    settings,
    setSettings,
    dirty: JSON.stringify(settings) !== JSON.stringify(saved),
    reset: () => setSettings(saved),
  };
}
