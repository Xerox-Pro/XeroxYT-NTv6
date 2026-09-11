import { useEffect, useState } from 'react';

export default function PrivacyOverlay() {
  const [isActive, setIsActive] = useState(() => localStorage.getItem('xerox_yt_privacy_mode') === 'true');
  const [pos, setPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

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

  useEffect(() => {
    if (!isActive) return;

    const updatePos = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length > 0) {
        setPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      } else if ('clientX' in e) {
        setPos({ x: e.clientX, y: e.clientY });
      }
    };

    window.addEventListener('mousemove', updatePos);
    window.addEventListener('touchmove', updatePos);

    return () => {
      window.removeEventListener('mousemove', updatePos);
      window.removeEventListener('touchmove', updatePos);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[999999]"
      style={{
        background: `radial-gradient(circle 180px at ${pos.x}px ${pos.y}px, transparent 0%, rgba(0, 0, 0, 0.95) 85%)`
      }}
    />
  );
}
