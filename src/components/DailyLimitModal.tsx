import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, AlertTriangle, Clock, RefreshCw, X, Play, Search, Zap, Info, CheckCircle2 } from 'lucide-react';
import { DailyUsageLimits } from '../types';
import { fetchLimits } from '../utils';

interface DailyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerData?: any;
}

export default function DailyLimitModal({ isOpen, onClose, triggerData }: DailyLimitModalProps) {
  const [limits, setLimits] = useState<DailyUsageLimits | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number }>({ hours: 0, minutes: 0, seconds: 0 });
  const [resetSec, setResetSec] = useState<number>(0);

  const loadLimits = async () => {
    setLoading(true);
    try {
      const data = await fetchLimits();
      setLimits(data);
      if (data && typeof data.resetSeconds === 'number') {
        setResetSec(data.resetSeconds);
      }
    } catch (err) {
      console.error('Failed to load daily limits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLimits();
    }
  }, [isOpen]);

  // カウントダウンタイマー
  useEffect(() => {
    if (!isOpen || resetSec <= 0) return;

    const updateCountdown = () => {
      const h = Math.floor(resetSec / 3600);
      const m = Math.floor((resetSec % 3600) / 60);
      const s = resetSec % 60;
      setCountdown({ hours: h, minutes: m, seconds: s });
    };

    updateCountdown();

    const interval = setInterval(() => {
      setResetSec((prev) => {
        if (prev <= 1) {
          loadLimits();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, resetSec]);

  if (!isOpen) return null;

  const isVideoLimited = limits ? limits.videos.used >= limits.videos.limit : false;
  const isSearchLimited = limits ? limits.searches.used >= limits.searches.limit : false;
  const isTotalLimited = limits ? limits.total.used >= limits.total.limit : false;
  const isAnyLimited = limits?.isLimited || isVideoLimited || isSearchLimited || isTotalLimited;

  const getPercent = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  const getBarColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-amber-500';
    return 'bg-blue-600';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-[#181818] border border-gray-700/60 rounded-2xl shadow-2xl text-white overflow-hidden flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#202020]">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isAnyLimited ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {isAnyLimited ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                  1日の利用状況とリクエスト制限
                </h3>
                <p className="text-xs text-gray-400">
                  Vercelサーバー負荷保護システム
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors"
              aria-label="閉じる"
            >
              <X size={20} />
            </button>
          </div>

          {/* コンテンツ */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* 状態アラート */}
            {isAnyLimited ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start gap-3">
                <AlertTriangle className="shrink-0 text-red-400 mt-0.5" size={20} />
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-sm text-red-300">
                    本日の利用上限に達しました
                  </div>
                  <div>
                    {triggerData?.error || 'Vercelサーバーの転送量・実行上限保護のため、制限がリセットされるまで一部機能が一時停止します。'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="shrink-0 text-emerald-400" size={18} />
                <div className="text-xs font-medium">
                  現在、すべての機能が正常にご利用いただけます。
                </div>
              </div>
            )}

            {/* リセットタイマー */}
            <div className="p-4 rounded-xl bg-[#222222] border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="text-blue-400" size={20} />
                <div>
                  <div className="text-xs text-gray-400 font-medium">次回リセットまで</div>
                  <div className="text-lg font-mono font-bold text-gray-100">
                    {String(countdown.hours).padStart(2, '0')}時間 {String(countdown.minutes).padStart(2, '0')}分 {String(countdown.seconds).padStart(2, '0')}秒
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block text-[11px] px-2.5 py-1 bg-gray-800 text-gray-300 rounded-full font-medium">
                  毎日 00:00 (JST) リセット
                </span>
              </div>
            </div>

            {/* 利用状況メーター */}
            <div className="space-y-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>本日の利用枠ステータス</span>
                <button
                  onClick={loadLimits}
                  disabled={loading}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 normal-case transition-colors"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  更新
                </button>
              </div>

              {/* 1. 動画視聴 */}
              <div className="p-4 rounded-xl bg-[#202020] border border-gray-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Play size={16} className="text-red-400" />
                    <span>動画視聴</span>
                  </div>
                  <div className="text-xs font-mono">
                    <span className="font-bold text-gray-100">{limits ? limits.videos.used : 0}</span>
                    <span className="text-gray-400"> / {limits ? limits.videos.limit : 50} 回</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      isVideoLimited ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isVideoLimited ? '上限到達' : `残り ${limits ? limits.videos.remaining : 50} 回`}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getBarColor(getPercent(limits?.videos.used || 0, limits?.videos.limit || 50))}`}
                    style={{ width: `${getPercent(limits?.videos.used || 0, limits?.videos.limit || 50)}%` }}
                  />
                </div>
              </div>

              {/* 2. 検索 */}
              <div className="p-4 rounded-xl bg-[#202020] border border-gray-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Search size={16} className="text-blue-400" />
                    <span>検索リクエスト</span>
                  </div>
                  <div className="text-xs font-mono">
                    <span className="font-bold text-gray-100">{limits ? limits.searches.used : 0}</span>
                    <span className="text-gray-400"> / {limits ? limits.searches.limit : 100} 回</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      isSearchLimited ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isSearchLimited ? '上限到達' : `残り ${limits ? limits.searches.remaining : 100} 回`}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getBarColor(getPercent(limits?.searches.used || 0, limits?.searches.limit || 100))}`}
                    style={{ width: `${getPercent(limits?.searches.used || 0, limits?.searches.limit || 100)}%` }}
                  />
                </div>
              </div>

              {/* 3. 総合リクエスト */}
              <div className="p-4 rounded-xl bg-[#202020] border border-gray-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Zap size={16} className="text-amber-400" />
                    <span>総合リクエスト (コメント・関連等含む)</span>
                  </div>
                  <div className="text-xs font-mono">
                    <span className="font-bold text-gray-100">{limits ? limits.total.used : 0}</span>
                    <span className="text-gray-400"> / {limits ? limits.total.limit : 600} 回</span>
                  </div>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getBarColor(getPercent(limits?.total.used || 0, limits?.total.limit || 600))}`}
                    style={{ width: `${getPercent(limits?.total.used || 0, limits?.total.limit || 600)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 制限に関する説明 */}
            <div className="p-4 rounded-xl bg-[#1e1e1e] border border-gray-800 text-xs text-gray-400 space-y-2 leading-relaxed">
              <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Info size={14} className="text-blue-400" />
                なぜリクエスト制限があるのですか？
              </div>
              <p>
                本サービスはVercelホスティング環境で動作しています。帯域幅転送量（Fast Data Transfer）やサーバーレス実行回数（Function Invocations）の上限超過を防ぎ、無料枠内での安定した運用を継続するため、1日ごとの利用回数を保護しています。
              </p>
              <p className="text-gray-500">
                💡 同じ動画を再度視聴する際はブラウザキャッシュが活用され、リクエスト回数は消費されません。
              </p>
            </div>
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t border-gray-800 bg-[#202020] flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              閉じる
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
