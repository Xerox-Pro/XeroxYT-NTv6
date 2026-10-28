import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import MainApp from './MainApp';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem('xerox_last_page', location.pathname + location.search + location.hash);
    } catch {
      // Browsing still works when storage is unavailable.
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <>
      <PWAUpdateIndicator />
      <Routes>
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </>
  );
}
