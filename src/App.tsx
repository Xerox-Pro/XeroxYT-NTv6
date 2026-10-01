import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { detectIncognito } from 'detectincognitojs';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';

export default function App() {
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);

  useEffect(() => {
    detectIncognito()
      .then((result) => {
        setIsPrivate(result.isPrivate);
      })
      .catch(() => {
        setIsPrivate(false);
      });
  }, []);

  if (isPrivate === true) {
    return <>{`erorr(Private browsing is not available)`}</>;
  }

  if (isPrivate === null) {
    return null; // Loading state to prevent flash of content
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
