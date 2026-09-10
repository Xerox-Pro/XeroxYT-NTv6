import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Search, Mic, Video, Bell, LogIn, LogOut, User, Settings, ShieldCheck, Sparkles, History, X, Play, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import Avatar from './Avatar';
import { UserInfo } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { parseYouTubeUrl, YouTubeUrlParseResult } from '../utils';

interface NavbarProps {
  onSearch: (q: string) => void;
  onHome: () => void;
  toggleSidebar: () => void;
  initialSearchQuery: string;
}

export default function Navbar({ 
  onSearch, 
  onHome, 
  toggleSidebar, 
  initialSearchQuery
}: NavbarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialSearchQuery);
  const [detectedNotice, setDetectedNotice] = useState<{
    label: string;
    description: string;
    type: 'video' | 'short' | 'channel';
  } | null>(null);

  // 検索履歴 & 候補
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_yt_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 入力値からのURL自動検知
  const detectedLink = useMemo(() => {
    return parseYouTubeUrl(query);
  }, [query]);

  // 検知トーストの自動消去タイマー
  useEffect(() => {
    if (!detectedNotice) return;
    const timer = setTimeout(() => {
      setDetectedNotice(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [detectedNotice]);

  useEffect(() => {
    setQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  // 検出されたリンク先の動画プレイヤーまたはチャンネルページを開く
  const handleOpenDetected = (detected: YouTubeUrlParseResult) => {
    setDetectedNotice({
      label: detected.label,
      description: detected.description,
      type: detected.type
    });
    setIsSearchFocused(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();

    if (detected.type === 'video' || detected.type === 'short') {
      const playlistParam = detected.playlistId ? `&list=${encodeURIComponent(detected.playlistId)}` : '';
      navigate(`/watch?v=${encodeURIComponent(detected.id)}${playlistParam}`);
    } else if (detected.type === 'channel') {
      navigate(`/channel/${encodeURIComponent(detected.id)}`);
    }
  };

  // 貼り付け (Paste) イベントでの自動検知 & 即時オープン
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const detected = parseYouTubeUrl(pastedText);
    if (detected) {
      e.preventDefault();
      setQuery(pastedText.trim());
      handleOpenDetected(detected);
    }
  };

  // 履歴保存
  const saveSearchTerm = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 25);
      try {
        localStorage.setItem('xerox_yt_search_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save search history', e);
      }
      return updated;
    });
  };

  // 履歴アイテム個別削除
  const removeSearchHistoryItem = (e: React.MouseEvent, termToRemove: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item !== termToRemove);
      try {
        localStorage.setItem('xerox_yt_search_history', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update search history', e);
      }
      return updated;
    });
  };

  // 履歴全削除
  const clearAllSearchHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSearchHistory([]);
    try {
      localStorage.removeItem('xerox_yt_search_history');
    } catch (e) {
      console.error('Failed to clear search history', e);
    }
  };

  // サジェスト取得 (デバウンス)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || parseYouTubeUrl(trimmed)) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggestions?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSuggestions(data);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch suggestions', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // ドロップダウンに表示する項目の生成
  const displayItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return searchHistory.slice(0, 10).map((term) => ({ type: 'history' as const, term }));
    }
    const matchingHistory = searchHistory
      .filter((h) => h.toLowerCase().includes(trimmed.toLowerCase()))
      .slice(0, 5);
    const matchingSet = new Set(matchingHistory.map((h) => h.toLowerCase()));
    const matchingSuggestions = suggestions
      .filter((s) => !matchingSet.has(s.toLowerCase()))
      .slice(0, 8);

    return [
      ...matchingHistory.map((term) => ({ type: 'history' as const, term })),
      ...matchingSuggestions.map((term) => ({ type: 'suggestion' as const, term })),
    ];
  }, [query, searchHistory, suggestions]);

  const handlePerformSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    // URL または ID が検知された場合は直接移動
    const detected = parseYouTubeUrl(trimmed);
    if (detected) {
      handleOpenDetected(detected);
      return;
    }

    saveSearchTerm(trimmed);
    setQuery(trimmed);
    setIsSearchFocused(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
    onSearch(trimmed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. YouTubeリンクが検知されている場合は最優先で直接開く
    if (detectedLink) {
      handleOpenDetected(detectedLink);
      return;
    }

    // 2. ドロップダウン選択がある場合
    if (selectedIndex >= 0 && displayItems[selectedIndex]) {
      handlePerformSearch(displayItems[selectedIndex].term);
    } else if (query.trim()) {
      handlePerformSearch(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // リンクが検知されている場合のEnterキーはhandleSubmitが処理
    if (!isSearchFocused) return;

    // 検出リンクバナーがある場合は矢印キーのインデックスも考慮
    const maxIndex = displayItems.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      setSelectedIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full min-h-[3.5rem] bg-white text-gray-900 flex flex-wrap items-center justify-between px-4 py-2 border-b border-gray-200 shadow-xs relative z-50">
      {/* リンク検知通知バナー (トースト) */}
      <AnimatePresence>
        {detectedNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[110] bg-gray-900 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-gray-700 text-sm max-w-[92vw]"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              {detectedNotice.type === 'video' ? (
                <Play size={14} className="fill-white text-white ml-0.5" />
              ) : detectedNotice.type === 'short' ? (
                <Zap size={14} className="fill-amber-400 text-amber-400" />
              ) : (
                <User size={14} className="text-white" />
              )}
            </div>
            <div className="flex flex-col min-w-0 pr-1">
              <span className="font-semibold text-xs text-blue-300 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-400" />
                {detectedNotice.label} を検出
              </span>
              <span className="text-xs text-gray-200 truncate">{detectedNotice.description}</span>
            </div>
            <button
              onClick={() => setDetectedNotice(null)}
              className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors ml-1 shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 左側: ハンバーガーメニュー + YouTubeロゴ */}
      <div className="flex items-center gap-4 shrink-0">
        <motion.button 
          onClick={toggleSidebar} 
          whileTap={{ scale: 0.88 }}
          className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200 text-gray-800"
          title="メニュー"
        >
          <Menu size={22} strokeWidth={2} />
        </motion.button>
        <Link to="/" className="flex items-center gap-2 select-none group" onClick={(e) => {
          if (window.location.pathname === '/') {
            e.preventDefault();
            onHome();
          }
        }}>
          <img 
            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjvrN3FNoHzYnXNfVvvvuP-mBKnl4JUP7tyzaJzIaA-5S21wei4MmKP4L08YGfUOnOU2Jug18mVZ4mzGgAtgKmj9AgYD-u9AAShb_PwiI_rFBWFTlO7Vmds1lDHcJPqpI_Xs-vYnNnNxzt8n0TLG8IJ-2O4BjADNtFZeIcbd1KU-PjCIFFpcUB6rWfz6_y6/s1600/YouTubePro.png"
            alt="YouTube Logo" 
            className="h-6 sm:h-7 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <span className="text-[17px] sm:text-[19px] font-bold tracking-tight text-gray-900 font-sans">XeroxYT-NTv6</span>
        </Link>
      </div>
      
      {/* 中央: 検索バー + マイク */}
      <div className="flex-1 max-w-[680px] mx-4 sm:mx-8 flex items-center justify-center gap-2 relative" ref={searchContainerRef}>
        <form onSubmit={handleSubmit} className="w-full flex items-center">
          <div className={`flex w-full bg-white rounded-full border shadow-xs transition-all duration-200 ${
            detectedLink 
              ? 'border-blue-500 ring-2 ring-blue-500/20' 
              : 'border-gray-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20'
          }`}>
            <div className="flex-1 flex items-center pl-4 pr-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(-1);
                  if (!isSearchFocused) setIsSearchFocused(true);
                }}
                onPaste={handlePaste}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder="検索、またはYouTubeの動画/ショート/チャンネルリンクを貼り付け"
                className="w-full bg-transparent py-2 outline-none text-gray-900 text-sm placeholder-gray-500 font-normal"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                    setSelectedIndex(-1);
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                  title="クリア"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <motion.button 
              type="submit" 
              whileTap={{ scale: 0.92 }}
              className={`px-6 border-l border-gray-300 flex items-center justify-center transition-colors shrink-0 rounded-r-full ${
                detectedLink 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white font-medium' 
                  : 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700'
              }`}
              title={detectedLink ? `${detectedLink.label} を開く` : '検索'}
            >
              {detectedLink ? (
                <ArrowRight size={19} strokeWidth={2.5} />
              ) : (
                <Search size={19} strokeWidth={2} />
              )}
            </motion.button>
          </div>
        </form>

        {/* 検索ドロップダウン (URL検知バナー + 履歴 & 候補) */}
        {isSearchFocused && (detectedLink || displayItems.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-[100] max-h-[380px] overflow-y-auto">
            {/* YouTube URL が検知されている時の最上位ハイライト項目 */}
            {detectedLink && (
              <div 
                onClick={() => handleOpenDetected(detectedLink)}
                className="mx-2 mb-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    {detectedLink.type === 'video' ? (
                      <Play size={16} className="fill-white text-white ml-0.5" />
                    ) : detectedLink.type === 'short' ? (
                      <Zap size={16} className="fill-amber-300 text-amber-300" />
                    ) : (
                      <User size={16} className="text-white" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-500" />
                      YouTubeリンクを検出
                    </span>
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {detectedLink.label} を開く
                    </span>
                    <span className="text-[11px] text-gray-500 truncate">
                      ID: {detectedLink.id}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-blue-600 group-hover:bg-blue-700 text-white text-xs font-semibold rounded-full shrink-0 flex items-center gap-1 transition-colors">
                  開く
                  <ArrowRight size={13} />
                </span>
              </div>
            )}

            {!query.trim() && searchHistory.length > 0 && (
              <div className="flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100 mb-1">
                <span className="flex items-center gap-1.5">
                  <History size={13} className="text-gray-600" />
                  検索履歴
                </span>
                <button
                  type="button"
                  onClick={clearAllSearchHistory}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  すべて削除
                </button>
              </div>
            )}

            {displayItems.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              if (item.type === 'history') {
                return (
                  <div
                    key={`history-${item.term}-${idx}`}
                    onClick={() => handlePerformSearch(item.term)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <History size={17} className="text-gray-600 shrink-0" />
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {item.term}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => removeSearchHistoryItem(e, item.term)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-200 rounded-full transition-colors ml-2 shrink-0"
                      title="履歴から削除"
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={`suggestion-${item.term}-${idx}`}
                  onClick={() => handlePerformSearch(item.term)}
                  className={`flex items-center gap-3.5 px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <Search size={17} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-900 font-medium truncate">
                    {item.term}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors hidden sm:flex items-center justify-center shadow-xs shrink-0"
          title="音声で検索"
          onClick={() => {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
              const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              const recognition = new SpeechRecognition();
              recognition.lang = 'ja-JP';
              recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                if (text) {
                  setQuery(text);
                  handlePerformSearch(text);
                }
              };
              recognition.start();
            }
          }}
        >
          <Mic size={18} />
        </motion.button>
      </div>

      {/* 右側 */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <PWAInstallButton />
        <Link
          to="/aistudio"
          className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full transition-colors text-sm font-medium shadow-xs"
          title="Xrayを開く"
        >
          Xray
        </Link>
      </div>
    </header>
  );
}

