import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  EyeOff,
  ShieldAlert,
  RotateCw,
  AlertTriangle,
  Compass,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

interface IncognitoBlockedScreenProps {
  browserName?: string;
  reason?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export default function IncognitoBlockedScreen({
  browserName,
  reason,
  onRetry,
  isRetrying = false,
}: IncognitoBlockedScreenProps) {
  const [activeTab, setActiveTab] = useState<'chrome' | 'safari' | 'edge' | 'firefox'>('chrome');

  const isTestMode = typeof window !== 'undefined' && 
    (window.location.search.includes('test_incognito=1') || window.location.search.includes('incognito=true'));

  const handleDisableTestMode = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('test_incognito');
      url.searchParams.delete('incognito');
      window.location.href = url.pathname + (url.search ? url.search : '') + url.hash;
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F12] text-gray-100 flex items-center justify-center p-4 sm:p-6 font-sans select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-xl bg-[#1A1A22] border border-red-900/40 rounded-3xl shadow-2xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon & Status */}
        <div className="flex flex-col items-center text-center space-y-4 relative z-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-600 flex items-center justify-center shadow-lg shadow-red-600/20">
              <EyeOff className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-[#1A1A22] p-1 rounded-full border border-red-500/40">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold tracking-wide uppercase">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>アクセス制限エラー (403)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              シークレットモードでのアクセスは制限されています
            </h1>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              本サービスは、シークレットモード（プライベートブラウズ）でのご利用を制限しております。ブラウザの通常ウィンドウで再度アクセスしてください。
            </p>
          </div>
        </div>

        {/* Reason card */}
        <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-gray-800/80 text-xs sm:text-sm text-gray-300 space-y-2 relative z-10">
          <div className="font-semibold text-gray-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>制限されている理由</span>
          </div>
          <ul className="space-y-1.5 text-gray-400 list-disc list-inside pl-1 text-[13px] leading-relaxed">
            <li>
              動画の再生履歴やプレイリスト、ユーザー設定を正常に保存・同期するため
            </li>
            <li>
              オフラインキャッシュおよびセキュリティポリシーを維持するため
            </li>
            {browserName && (
              <li className="text-red-400/90 font-mono">
                検出ブラウザ: {browserName} {reason ? `(${reason})` : ''}
              </li>
            )}
          </ul>
        </div>

        {/* Browser Guide Section */}
        <div className="mt-6 relative z-10">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-purple-400" />
            <span>通常ウィンドウへの切り替え手順</span>
          </div>

          {/* Tab selector */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-gray-800 text-xs text-center font-medium">
            {(['chrome', 'safari', 'edge', 'firefox'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`py-1.5 rounded-lg capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white font-semibold shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab === 'chrome' ? 'Chrome' : tab === 'safari' ? 'Safari' : tab === 'edge' ? 'Edge' : 'Firefox'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="mt-2.5 p-3.5 bg-black/20 border border-gray-800/60 rounded-xl text-xs text-gray-300 space-y-1.5">
            {activeTab === 'chrome' && (
              <div className="space-y-1 leading-relaxed">
                <p className="font-medium text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Google Chromeの場合
                </p>
                <p className="text-gray-400">
                  右上の「︙」メニューから「新しいウィンドウ」を開くか、ショートカットキー（<span className="font-mono text-gray-200 bg-gray-800 px-1 py-0.5 rounded">Ctrl+N</span> / <span className="font-mono text-gray-200 bg-gray-800 px-1 py-0.5 rounded">⌘+N</span>）で通常ウィンドウを開いてください。
                </p>
              </div>
            )}
            {activeTab === 'safari' && (
              <div className="space-y-1 leading-relaxed">
                <p className="font-medium text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Apple Safariの場合
                </p>
                <p className="text-gray-400">
                  タブ一覧アイコンをタップし、「プライベート」タブから通常のタブグループに切り替えてアクセスしてください。
                </p>
              </div>
            )}
            {activeTab === 'edge' && (
              <div className="space-y-1 leading-relaxed">
                <p className="font-medium text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Microsoft Edgeの場合
                </p>
                <p className="text-gray-400">
                  右上の「…」メニューから「新しいウィンドウ」を開くか、<span className="font-mono text-gray-200 bg-gray-800 px-1 py-0.5 rounded">Ctrl+N</span> で通常ウィンドウを開いてください。
                </p>
              </div>
            )}
            {activeTab === 'firefox' && (
              <div className="space-y-1 leading-relaxed">
                <p className="font-medium text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Mozilla Firefoxの場合
                </p>
                <p className="text-gray-400">
                  メニューから「新しいウィンドウ」を開くか、<span className="font-mono text-gray-200 bg-gray-800 px-1 py-0.5 rounded">Ctrl+N</span> で通常ウィンドウを開いてください。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full sm:flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:from-red-700 active:to-rose-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RotateCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? '確認中...' : '再試行（再読み込み）'}</span>
          </button>

          {isTestMode && (
            <button
              type="button"
              onClick={handleDisableTestMode}
              className="w-full sm:w-auto py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-gray-700"
            >
              <span>テスト解除（通常モードで開く）</span>
            </button>
          )}
        </div>

        <div className="mt-4 text-center text-[11px] text-gray-500">
          通常ブラウザウィンドウではすべての機能を快適にご利用いただけます。
        </div>
      </motion.div>
    </div>
  );
}
