export type Route =
  | { view: 'courses' }
  | { view: 'settings' }
  | { view: 'course'; id: string }
  | { view: 'live'; id: string }
  | { view: 'lecture'; id: string };
