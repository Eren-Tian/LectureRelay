import { useEffect, useRef, useState } from 'react';
import { listen, TauriEvent } from '@tauri-apps/api/event';

const MEDIA_EXTENSIONS = ['wav', 'mp3', 'm4a', 'mp4', 'flac', 'ogg'];
export const isMediaPath = (path: string) =>
  MEDIA_EXTENSIONS.includes(path.split('.').pop()?.toLowerCase() ?? '');
export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
/** The file name without its extension, as a default lecture title. */
export const fileStem = (path: string) =>
  fileName(path).replace(/\.[^.]+$/, '');

/**
 * Files dragged onto the window. Returns whether a media file is being
 * dragged over it; `onDrop` receives the dropped paths.
 */
export function useMediaDrop(onDrop: (paths: string[]) => void) {
  const [hovering, setHovering] = useState(false);
  const handler = useRef(onDrop);
  useEffect(() => {
    handler.current = onDrop;
  }, [onDrop]);
  useEffect(() => {
    let active = true;
    const stops: (() => void)[] = [];
    const keep = (subscription: Promise<() => void>) =>
      void subscription.then((stop) => (active ? stops.push(stop) : stop()));
    keep(
      listen<{ paths: string[] }>(TauriEvent.DRAG_ENTER, (event) =>
        setHovering(event.payload.paths.some(isMediaPath)),
      ),
    );
    keep(listen(TauriEvent.DRAG_LEAVE, () => setHovering(false)));
    keep(
      listen<{ paths: string[] }>(TauriEvent.DRAG_DROP, (event) => {
        setHovering(false);
        handler.current(event.payload.paths);
      }),
    );
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, []);
  return hovering;
}
