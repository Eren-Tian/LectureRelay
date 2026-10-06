import type { CSSProperties } from 'react';

type IconName =
  | 'books'
  | 'settings'
  | 'info'
  | 'plus'
  | 'arrow'
  | 'back'
  | 'mic'
  | 'pause'
  | 'play'
  | 'stop'
  | 'edit'
  | 'trash'
  | 'download'
  | 'close'
  | 'check'
  | 'cloud'
  | 'folder'
  | 'spark'
  | 'shield'
  | 'search';
const paths: Record<IconName, string> = {
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 11v6 M12 7v.1',
  books: 'M4 5h6v14H4z M14 4h5v15h-5z M7 9h1 M16 8h1',
  settings:
    'M10 3h4l.4 2.2 1.3.6 1.9-1.3 2.9 2.9-1.3 1.9.6 1.3L22 11v2l-2.2.4-.6 1.3 1.3 1.9-2.9 2.9-1.9-1.3-1.3.6L14 21h-4l-.4-2.2-1.3-.6-1.9 1.3-2.9-2.9 1.3-1.9-.6-1.3L2 13v-2l2.2-.4.6-1.3-1.3-1.9 2.9-2.9 1.9 1.3 1.3-.6L10 3z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  back: 'M19 12H5 M10 7l-5 5 5 5',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M6 10v2a6 6 0 0 0 12 0v-2 M12 18v3 M9 21h6',
  pause: 'M8 5v14 M16 5v14',
  play: 'M8 5l11 7-11 7z',
  stop: 'M6 6h12v12H6z',
  edit: 'M4 20l1-5L16 4l4 4-11 11z M14 6l4 4',
  trash: 'M4 6h16 M9 3h6 M6 6l1 14h10l1-14 M10 10v6 M14 10v6',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 17v3h14v-3',
  close: 'M6 6l12 12 M6 18 18 6',
  check: 'M5 12l4 4L19 6',
  cloud: 'M7 18a5 5 0 0 1-1-10 6 6 0 0 1 11-1 5 5 0 0 1 0 11z',
  folder: 'M3 5h7l2 3h9v12H3z',
  spark: 'M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
  search: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12 M15 15l5 5',
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
