import React, { useEffect, useState } from 'react';

export default function TopProgressBar({ isLoading }: { isLoading: boolean }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setVisible(true);
      setIsFinishing(false);
      setProgress(20);
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 85) return p;
          return p + Math.random() * 12;
        });
      }, 250);
    } else if (visible) {
      setProgress(100);
      setIsFinishing(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        setIsFinishing(false);
        setProgress(0);
      }, 350);
      return () => clearTimeout(timeout);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, visible]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-[3px] z-[9999] pointer-events-none overflow-hidden">
      <div 
        className={`h-full bg-[#ff0000] shadow-[0_0_8px_#ff0000] transition-all duration-300 ease-out ${
          isFinishing ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
