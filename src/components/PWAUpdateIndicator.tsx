import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PWAUpdateIndicator() {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdating = () => {
      setIsUpdating(true);
    };

    window.addEventListener('pwa-updating', handleUpdating);
    return () => {
      window.removeEventListener('pwa-updating', handleUpdating);
    };
  }, []);

  if (!isUpdating) return null;

  return (
    <aside
      aria-label="サイト更新通知"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out animate-fade-in"
    >
      <div className="bg-white/95 backdrop-blur-sm text-gray-800 px-5 py-3 rounded-xl shadow-lg border border-gray-100/80 flex items-center gap-3 max-w-md">
        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-900 tracking-wide">
            サイトの更新を検出しました
          </span>
          <span className="text-[11px] text-gray-500 leading-relaxed tracking-wider">
            最新バージョンに自動更新しています...
          </span>
        </div>
      </div>
    </aside>
  );
}
