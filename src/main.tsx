import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initPWA } from './pwa';

const LAST_PAGE_KEY = 'xerox_last_page';

function getInitialPage(): string {
  const current = window.location.pathname + window.location.search + window.location.hash;
  let initialPage = current;
  if (window.location.pathname === '/' && !window.location.search && !window.location.hash) {
    try {
      const saved = localStorage.getItem(LAST_PAGE_KEY);
      // Only restore local application paths, never an external URL.
      initialPage = saved && saved.startsWith('/') && !saved.startsWith('//') ? saved : '/';
    } catch {
      initialPage = '/';
    }
  }

  // Keep old links working while showing the same clean URL on every page.
  if (current !== '/') {
    window.history.replaceState(window.history.state, '', '/');
  }
  return initialPage;
}

const initialPage = getInitialPage();

// サイト変更検知＆自動アップデートの初期化
initPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[initialPage]}>
      <App />
    </MemoryRouter>
  </StrictMode>,
);
