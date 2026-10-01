import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';
import { checkIsIncognitoWithTimeout, IncognitoDetectionResult } from './utils/incognitoDetector';

export default function App() {
  const [incognitoState, setIncognitoState] = useState<{
    checked: boolean;
    isPrivate: boolean;
    browserName?: string;
    reason?: string;
  }>({
    checked: false,
    isPrivate: false,
  });
  const [isRetrying, setIsRetrying] = useState(false);

  const runDetection = async () => {
    setIsRetrying(true);
    try {
      const res: IncognitoDetectionResult = await checkIsIncognitoWithTimeout(1800);
      setIncognitoState({
        checked: true,
        isPrivate: res.isPrivate,
        browserName: res.browserName,
        reason: res.reason,
      });
    } catch {
      setIncognitoState({
        checked: true,
        isPrivate: false,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    runDetection();

    // Bootstrap client API key configuration from server
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.apiKey) {
          (window as any).__APP_API_KEY__ = data.apiKey;
          try {
            localStorage.setItem('xerox_api_key', data.apiKey);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // While checking, wait silently or show empty
  if (!incognitoState.checked) {
    return null;
  }

  // Block completely if incognito / private mode is detected: display only 'error'
  if (incognitoState.isPrivate) {
    return <div>error</div>;
  }

  // Normal browsing mode: regular app experience
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
