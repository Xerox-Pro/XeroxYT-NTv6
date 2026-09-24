import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Keyboard, 
  X, 
  Play, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  Maximize2, 
  Gauge, 
  SkipForward, 
  Search,
  Sliders
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  items: ShortcutItem[];
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const groups: ShortcutGroup[] = [
    {
      title: '再生 & 一時停止',
      icon: <Play size={16} className="text-red-600" />,
      items: [
        { keys: ['K'], description: '動画の再生 / 一時停止' },
        { keys: ['Space'], description: '再生 / 一時停止（画面スクロール防止）' },
      ],
    },
    {
      title: 'シーク & ナビゲーション',
      icon: <RotateCw size={16} className="text-blue-600" />,
      items: [
        { keys: ['J'], description: '10秒 巻き戻し' },
        { keys: ['L'], description: '10秒 早送り' },
        { keys: ['←'], description: '5秒 巻き戻し' },
        { keys: ['→'], description: '5秒 早送り' },
        { keys: ['0 〜 9'], description: '動画の 0% 〜 90% の位置へジャンプ' },
        { keys: ['Shift', 'N'], description: '次の動画を再生' },
      ],
    },
    {
      title: '音量 & 画面表示',
      icon: <Volume2 size={16} className="text-emerald-600" />,
      items: [
        { keys: ['M'], description: '消音（ミュート）の切り替え' },
        { keys: ['↑'], description: '音量を 5% 上げる' },
        { keys: ['↓'], description: '音量を 5% 下げる' },
        { keys: ['F'], description: '全画面表示の切り替え（Escで解除）' },
      ],
    },
    {
      title: '再生速度 & その他',
      icon: <Gauge size={16} className="text-purple-600" />,
      items: [
        { keys: ['< (Shift+,)'], description: '再生速度を遅くする' },
        { keys: ['> (Shift+.)'], description: '再生速度を速くする' },
        { keys: ['/'], description: '検索バーへフォーカス' },
        { keys: ['? (Shift+/)'], description: 'ショートカット一覧の表示 / 非表示' },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* バックドロップ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* モーダルコンテンツ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shadow-2xs">
                  <Keyboard size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    キーボード ショートカット
                  </h3>
                  <p className="text-xs text-gray-500">
                    デスクトップでの快適な動画操作をサポート
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                title="閉じる (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* 本文 (ショートカットグループ一覧) */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {groups.map((group, idx) => (
                  <div key={idx} className="bg-gray-50/70 rounded-xl p-4 border border-gray-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200/60 font-semibold text-gray-800 text-xs">
                      {group.icon}
                      <span>{group.title}</span>
                    </div>
                    <ul className="space-y-2.5 flex-1">
                      {group.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-gray-600 leading-tight">{item.description}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.keys.map((k, kIdx) => (
                              <React.Fragment key={kIdx}>
                                <kbd className="px-2 py-0.8 bg-white border border-gray-300 rounded shadow-2xs text-[11px] font-mono font-bold text-gray-800 min-w-[22px] text-center inline-block">
                                  {k}
                                </kbd>
                                {kIdx < item.keys.length - 1 && (
                                  <span className="text-gray-400 text-[10px]">+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50/80 rounded-xl p-3.5 border border-blue-100/80 text-xs text-blue-900 flex items-start gap-2.5">
                <Sliders size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>ヒント:</strong> コメント入力中や検索バーに入力している間は、誤動作を防ぐためキーボードショートカットは自動的に無効化されます。動画の外をクリックすることでいつでもショートカットが利用できます。
                </p>
              </div>
            </div>

            {/* フッター */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-mono text-[10px] font-bold">Esc</kbd> キーで閉じる
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white font-medium rounded-lg text-xs transition-colors cursor-pointer"
              >
                了解
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
