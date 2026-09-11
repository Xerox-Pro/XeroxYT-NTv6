import { useEffect, useState } from 'react';

export default function PrivacyOverlay() {
  const [isActive, setIsActive] = useState(() => localStorage.getItem('xerox_yt_privacy_mode') === 'true');

  useEffect(() => {
    const handleStorageChange = () => {
      setIsActive(localStorage.getItem('xerox_yt_privacy_mode') === 'true');
    };
    
    // Listen for cross-tab storage changes and same-tab custom events
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('privacy-mode-changed', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('privacy-mode-changed', handleStorageChange);
    };
  }, []);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[999999]"
      style={{
        background: `repeating-linear-gradient(
          90deg,
          rgba(0, 0, 0, 0) 0px,
          rgba(0, 0, 0, 0) 1px,
          rgba(0, 0, 0, 0.15) 1px,
          rgba(0, 0, 0, 0.15) 2px
        )`
      }}
    />
  );
}
