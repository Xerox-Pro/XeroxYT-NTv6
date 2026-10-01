import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';
import IncognitoBlockedScreen from './components/IncognitoBlockedScreen';
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

  // While checking, display a clean dark loader to prevent flash of content in incognito mode
  if (!incognitoState.checked) {
    return (
      <div className="min-h-screen bg-[#0F0F12] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
        <span className="text-xs text-gray-500 font-medium">セキュリティチェック中...</span>
      </div>
    );
  }

  // Block completely if incognito / private mode is detected
  if (incognitoState.isPrivate) {
    return (
      <IncognitoBlockedScreen
        browserName={incognitoState.browserName}
        reason={incognitoState.reason}
        onRetry={runDetection}
        isRetrying={isRetrying}
      />
    );
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
