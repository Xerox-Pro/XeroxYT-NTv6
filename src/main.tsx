import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initPWA } from './pwa';
import { isPrivateMode } from './utils/detectPrivate';

async function bootstrap() {
  const privateDetected = (window as any).__is_private_browsing__ || await isPrivateMode();
  if (privateDetected) {
    document.open();
    document.write('erorr(Private browsing is not available)');
    document.close();
    return;
  }

  // サイト変更検知＆自動アップデートの初期化
  initPWA();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

bootstrap();

