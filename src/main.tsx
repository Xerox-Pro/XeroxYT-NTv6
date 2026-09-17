import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initPWA } from './pwa';

// サイト変更検知＆自動アップデートの初期化
try {
  initPWA();
} catch (e) {
  console.warn('[PWA] Init failed:', e);
}

// 予期せぬ非同期エラーで画面が停止するのを防止
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection caught:', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
