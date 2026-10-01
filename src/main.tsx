import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initPWA } from './pwa';
import { detectIncognito } from 'detectincognitojs';

// サイト変更検知＆自動アップデートの初期化
initPWA();

async function init() {
  let isPrivate = false;
  try {
    const result = await detectIncognito();
    isPrivate = result.isPrivate;
  } catch (e) {
    console.warn('Failed to detect incognito mode, falling back to normal', e);
  }

  if (isPrivate) {
    document.body.className = '';
    document.body.style.all = 'unset';
    document.body.style.display = 'block';
    document.body.style.padding = '20px';
    document.body.style.fontFamily = 'monospace';
    document.body.style.color = '#000000';
    document.body.style.backgroundColor = '#ffffff';
    document.body.innerText = 'erorr(Private browsing is not available)';
    return;
  }

  // Restore opacity for regular mode
  document.body.style.opacity = '1';

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

init();
