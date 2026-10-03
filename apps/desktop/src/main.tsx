import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingCaptions } from './features/live-lecture/FloatingCaptions';
import { App } from './app/App';
import './styles/app.css';
import './styles/workspace.css';

try {
  if (localStorage.getItem('lecturerelay-theme') === 'dark')
    document.documentElement.dataset.theme = 'dark';
} catch {
  /* Native preferences are applied after bootstrap. */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get('panel') === 'captions' ? (
      <FloatingCaptions />
    ) : (
      <App />
    )}
  </StrictMode>,
);
