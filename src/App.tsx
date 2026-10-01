import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';
import { detectIncognito } from 'detect-incognito';

export default function App() {
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    detectIncognito()
      .then((result) => {
        if (active) {
          setIsPrivate(result.isPrivate);
        }
      })
      .catch((err) => {
        console.error('Failed to detect incognito:', err);
        if (active) {
          setIsPrivate(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (isPrivate === null) {
    return null;
  }

  if (isPrivate) {
    return <>erorr(Private browsing is not available)</>;
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
