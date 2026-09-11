import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';

export default function App() {
  useEffect(() => {
    const isPrivacyMode = localStorage.getItem('xerox_yt_privacy_mode') === 'true';
    if (isPrivacyMode) {
      document.body.classList.add('privacy-screen-active');
    }
  }, []);

  return (
    <>
      <PWAUpdateIndicator />
      <Routes>
        <Route path="/*" element={<MainApp />} />
        <Route path="/aistudio" element={<AIStudio />} />
      </Routes>
    </>
  );
}
