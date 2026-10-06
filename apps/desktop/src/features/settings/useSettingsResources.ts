import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, errorText } from '../../api/client';
import type { Course, ModelStatus } from '../../types/domain';

type ResourceKey = 'speech' | 'text' | 'trash' | 'events';
export function useSettingsResources() {
  const [model, setModel] = useState<ModelStatus>();
  const [textModels, setTextModels] = useState<ModelStatus[]>([]);
  const [trash, setTrash] = useState<Course[]>([]);
  const [errors, setErrors] = useState<Partial<Record<ResourceKey, string>>>(
    {},
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setErrors({});
    const failed = (key: ResourceKey, error: unknown) => {
      if (!disposed)
        setErrors((current) => ({ ...current, [key]: errorText(error) }));
    };
    const load = <T>(
      key: ResourceKey,
      request: Promise<T>,
      apply: (value: T) => void,
    ) => {
      void request
        .then((value) => {
          if (!disposed) apply(value);
        })
        .catch((error) => failed(key, error));
    };
    load('speech', api.localModel(), setModel);
    load('text', api.textModels(), setTextModels);
    load('trash', api.trash(), setTrash);
    const subscription = listen<ModelStatus>('model-status', (event) => {
      if (disposed) return;
      if (event.payload.id === 'nemotron-streaming') setModel(event.payload);
      else
        setTextModels((models) =>
          models.map((item) =>
            item.id === event.payload.id ? event.payload : item,
          ),
        );
    }).catch((error) => {
      failed('events', error);
      return () => {};
    });
    return () => {
      disposed = true;
      void subscription.then((off) => off());
    };
  }, [attempt]);
  return {
    model,
    setModel,
    textModels,
    setTextModels,
    trash,
    setTrash,
    errors,
    retry: () => setAttempt((current) => current + 1),
  };
}
export type SettingsResources = ReturnType<typeof useSettingsResources>;
