import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { detectIncognito } from 'detectincognitojs';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';

export default function App() {
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkIncognito = async () => {
      try {
        const result = await detectIncognito();
        if (isMounted && result?.isPrivate) {
          setIsPrivate(true);
          return;
        }
      } catch {}

      // Fallback detection techniques
      try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          // Chromium incognito sets quota significantly lower (e.g. <= 120MB)
          if (estimate.quota && estimate.quota < 125829120) {
            if (isMounted) {
              setIsPrivate(true);
              return;
            }
          }
        }
      } catch {}

      if (isMounted) {
        setIsPrivate(false);
      }
    };

    checkIncognito();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isPrivate) {
    return (
      <div className="min-h-screen bg-white text-black font-mono text-base p-6">
        erorr(Private browsing is not available)
      </div>
    );
  }

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
