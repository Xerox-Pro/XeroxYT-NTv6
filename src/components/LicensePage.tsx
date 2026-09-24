import React, { useState } from 'react';
import { 
  ScrollText, 
  Copy, 
  Check, 
  ArrowLeft,
  Settings2,
  Tv,
  Cpu
} from 'lucide-react';

interface LicensePageProps {
  onBack?: () => void;
}

export default function LicensePage({ onBack }: LicensePageProps) {
  const [copiedKeyUrl, setCopiedKeyUrl] = useState(false);
  const eduKeyUrl = 'https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json';

  const handleCopy = () => {
    navigator.clipboard.writeText(eduKeyUrl);
    setCopiedKeyUrl(true);
    setTimeout(() => setCopiedKeyUrl(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#2d3748] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* 上部ナビゲーション */}
        {onBack && (
          <button
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#4a5568] hover:text-[#1a202c] transition-colors duration-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>ホームへ戻る</span>
          </button>
        )}

        {/* ヘッダーエリア */}
        <header className="mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100/80 rounded-full text-xs font-medium text-gray-700 mb-4 tracking-wide">
            <ScrollText size={14} className="text-gray-600" />
            <span>システム構成 & 設定</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1a202c] mb-3 leading-snug">
            システム情報
          </h1>
          <p className="text-[#4a5568] text-sm sm:text-base leading-[1.7] tracking-[0.01em]">
            XeroxYT-NTv6 プレイヤー環境設定および連携エンドポイント情報。
          </p>
        </header>

        {/* プレイヤー設定 */}
        <section className="mb-10 sm:mb-12 bg-white rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-100">
          <div className="pb-6 border-b border-gray-100">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400">Player Configuration</span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1a202c] mt-0.5 tracking-tight flex items-center gap-2">
              YouTube Education 連携
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              埋め込み再生を制御する最新の設定パラメータをリモートJSONから動的に同期します。
            </p>
          </div>

          {/* video_config 取得先 */}
          <div className="mt-6 pt-1">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              video_config 取得先エンドポイント
            </label>
            <div className="flex items-center gap-2 bg-[#f8fafc] p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm font-mono text-gray-800 break-all border border-gray-100">
              <span className="flex-1 select-all">{eduKeyUrl}</span>
              <button
                onClick={handleCopy}
                className="shrink-0 p-2 text-gray-600 hover:text-gray-900 bg-white rounded-md shadow-2xs hover:shadow-xs transition-all duration-200 active:scale-[0.96] cursor-pointer border border-gray-100"
                title="URLをコピー"
              >
                {copiedKeyUrl ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-400 leading-normal">
              YouTube Education 埋め込みプレイヤー用の最新パラメータを提供する公式設定ソースです。
            </p>
          </div>
        </section>

        {/* 機能ステータス */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Tv size={18} />
              <h3 className="text-sm font-semibold text-gray-900">Education Player</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              広告なし・軽量なEducationモードでYouTube動画を安定して再生します。
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Cpu size={18} />
              <h3 className="text-sm font-semibold text-gray-900">自動キー同期</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              最新の暗号化パラメータ（enc）と設定を自動的にキャッシュ・更新します。
            </p>
          </div>
        </section>

        {/* フッター */}
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
          <p>XeroxYT-NTv6</p>
        </footer>
      </div>
    </div>
  );
}
