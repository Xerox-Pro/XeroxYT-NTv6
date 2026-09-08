import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 text-sm font-medium shadow-xs transition"
        title="アプリをインストール"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">アプリをインストール</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 text-sm font-medium shadow-xs transition"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">iOSにインストール</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">iPhone / iPad にインストール</h3>
              <p className="mt-2 text-sm text-gray-600">
                1. Safariのツールバーにある <strong>共有</strong> ボタンをタップします。<br />
                2. 下にスクロールして <strong>ホーム画面に追加</strong> をタップします。
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
