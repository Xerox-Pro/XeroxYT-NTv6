import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Search, Mic, Video, Bell, LogIn, LogOut, User, Settings, ShieldCheck, Sparkles, History, X, Play, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import Avatar from './Avatar';
import { UserInfo } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { parseYouTubeUrl, YouTubeUrlParseResult, fetchJSON, formatDuration } from '../utils';

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

  // 検出された動画のプレビュー情報
  const [videoPreview, setVideoPreview] = useState<{
    id: string;
    title: string;
    author?: string;
    authorAvatar?: string;
    duration?: string;
    loading: boolean;
  } | null>(null);

  // 検出されたチャンネルのプレビュー情報
  const [channelPreview, setChannelPreview] = useState<{
    id: string;
    title: string;
    avatar?: string;
    subscribers?: string;
    loading: boolean;
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

  // 動画IDまたはチャンネルIDが検知されたらサムネ・タイトル等のメタデータを取得
  useEffect(() => {
    if (!detectedLink) {
      setVideoPreview(null);
      setChannelPreview(null);
      return;
    }

    if (detectedLink.type === 'video' || detectedLink.type === 'short') {
      const vId = detectedLink.id;
      setChannelPreview(null);
      setVideoPreview({
        id: vId,
        title: '動画情報を取得中...',
        loading: true
      });

      let isCancelled = false;
      fetchJSON(`/api/video/${encodeURIComponent(vId)}`)
        .then((data) => {
          if (!isCancelled && data) {
            setVideoPreview({
              id: vId,
              title: data.title || `YouTube動画 (${vId})`,
              author: data.author,
              authorAvatar: data.authorAvatar,
              duration: data.lengthSeconds ? formatDuration(data.lengthSeconds) : undefined,
              loading: false
            });
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setVideoPreview({
              id: vId,
              title: `YouTube動画 (${vId})`,
              loading: false
            });
          }
        });

      return () => {
        isCancelled = true;
      };
    } else if (detectedLink.type === 'channel') {
      const cId = detectedLink.id;
      setVideoPreview(null);
      setChannelPreview({
        id: cId,
        title: `チャンネル (${cId})`,
        loading: true
      });

      let isCancelled = false;
      fetchJSON(`/api/channel/${encodeURIComponent(cId)}`)
        .then((data) => {
          if (!isCancelled && data) {
            setChannelPreview({
              id: cId,
              title: data.title || `チャンネル (${cId})`,
              avatar: data.avatar,
              subscribers: data.subscriberCount,
              loading: false
            });
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setChannelPreview({
              id: cId,
              title: `チャンネル (${cId})`,
              loading: false
            });
          }
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [detectedLink?.id, detectedLink?.type]);

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
      label: videoPreview?.title || detected.label,
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

  // 貼り付け (Paste) イベント: URLをセットし、検索一覧のところにサムネとタイトルを表示
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const detected = parseYouTubeUrl(pastedText);
    if (detected) {
      e.preventDefault();
      setQuery(pastedText.trim());
      setIsSearchFocused(true);
      setSelectedIndex(-1);
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
    if (!isSearchFocused) return;

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
    <header className={`w-full min-h-[3.5rem] flex flex-wrap items-center justify-between px-4 py-2 border-b shadow-xs relative z-50 ${isLiquid ? 'text-white border-white/20 bg-transparent' : 'bg-white text-gray-900 border-gray-200'}`}>
      {/* リンク検知通知バナー (トースト: クリーンなミニマルスタイル) */}
      <AnimatePresence>
        {detectedNotice && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[110] bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2.5 text-xs max-w-[92vw]"
          >
            <CheckCircle2 size={14} className="text-gray-300 shrink-0" />
            <span className="text-gray-200 truncate font-medium">
              {detectedNotice.label}
            </span>
            <button
              onClick={() => setDetectedNotice(null)}
              className="p-0.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors ml-1 shrink-0"
            >
              <X size={13} />
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
          <img crossOrigin="anonymous" 
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
          <div className={`flex w-full rounded-full border focus-within:shadow-inner shadow-xs transition-all duration-150 ${isLiquid ? 'bg-white/10 border-white/30 focus-within:border-white/60 text-white' : 'bg-white border-gray-300 focus-within:border-gray-500'}`}>
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
                placeholder="検索・リンクを貼り付け"
                className={`w-full bg-transparent py-2 outline-none text-sm font-normal ${isLiquid ? 'text-white placeholder-gray-300' : 'text-gray-900 placeholder-gray-500'}`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                    setSelectedIndex(-1);
                    setVideoPreview(null);
                    setChannelPreview(null);
                    inputRef.current?.focus();
                  }}
                  className={`p-1 rounded-full transition-colors shrink-0 ${isLiquid ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  title="クリア"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <motion.button 
              type="submit" 
              whileTap={{ scale: 0.94 }}
              className={`px-6 border-l flex items-center justify-center transition-colors shrink-0 rounded-r-full ${isLiquid ? 'border-white/20 bg-white/10 hover:bg-white/20 text-white' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700'}`}
              title={detectedLink ? (detectedLink.type === 'channel' ? 'チャンネルを開く' : '動画を再生') : '検索'}
            >
              <Search size={19} strokeWidth={2} />
            </motion.button>
          </div>
        </form>

        {/* 検索ドロップダウン */}
        {isSearchFocused && (detectedLink || displayItems.length > 0) && (
          <div className={`absolute top-full left-0 right-0 mt-1.5 rounded-2xl shadow-xl py-2 z-[100] max-h-[440px] overflow-y-auto border ${isLiquid ? 'bg-black/90 border-white/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            {/* 動画ID検知時 */}
            {detectedLink && (detectedLink.type === 'video' || detectedLink.type === 'short') && (
              <div 
                onClick={() => handleOpenDetected(detectedLink)}
                className={`mx-2 mb-2 p-2.5 rounded-xl cursor-pointer transition-colors duration-150 group border ${isLiquid ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
              >
                <div className={`flex items-center justify-between pb-1.5 mb-2 border-b text-xs ${isLiquid ? 'border-white/10 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                  <span className={`font-medium ${isLiquid ? 'text-gray-200' : 'text-gray-700'}`}>
                    {detectedLink.type === 'short' ? 'リンク先: YouTubeショート' : 'リンク先: YouTube動画'}
                  </span>
                  <span className={`font-mono text-[11px] ${isLiquid ? 'text-gray-400' : 'text-gray-400'}`}>ID: {detectedLink.id}</span>
                </div>

                <div className="flex gap-3 items-center">
                  {/* 動画サムネイル */}
                  <div className="relative w-28 sm:w-36 aspect-video bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                    <img crossOrigin="anonymous"
                      src={`https://i.ytimg.com/vi/${detectedLink.id}/hqdefault.jpg`}
                      alt="サムネイル"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${detectedLink.id}/mqdefault.jpg`;
                      }}
                    />
                    {/* 再生アイコン（ホバー時） */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-white/90 text-gray-900 flex items-center justify-center shadow-sm">
                        <Play size={13} className="fill-gray-900 ml-0.5" />
                      </div>
                    </div>
                    {/* 再生時間 */}
                    {videoPreview?.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                        {videoPreview.duration}
                      </span>
                    )}
                  </div>

                  {/* 動画タイトル ＆ メタデータ */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {videoPreview?.title || (videoPreview?.loading ? 'タイトルを読み込み中...' : `YouTube動画 (${detectedLink.id})`)}
                    </h4>

                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                      {videoPreview?.authorAvatar && (
                        <img crossOrigin="anonymous" 
                          src={videoPreview.authorAvatar} 
                          alt={videoPreview.author || ''} 
                          className="w-4 h-4 rounded-full object-cover shrink-0" 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span className="truncate">{videoPreview?.author || 'YouTube'}</span>
                    </div>

                    <div className="mt-2 flex items-center">
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium group-hover:underline">
                        <Play size={11} className="fill-blue-600" />
                        この動画を再生
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* チャンネルID/ハンドル検知時: ホワイトテーマに合わせた自然なチャンネルカード */}
            {detectedLink && detectedLink.type === 'channel' && (
              <div 
                onClick={() => handleOpenDetected(detectedLink)}
                className="mx-2 mb-2 p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl cursor-pointer transition-colors duration-150 group"
              >
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-gray-100 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">リンク先: YouTubeチャンネル</span>
                  <span className="font-mono text-[11px] text-gray-400">{detectedLink.id}</span>
                </div>

                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
                    {channelPreview?.avatar ? (
                      <img crossOrigin="anonymous"
                        src={channelPreview.avatar}
                        alt="アバター"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={22} className="text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {channelPreview?.title || (channelPreview?.loading ? 'チャンネル情報を読み込み中...' : detectedLink.label)}
                    </h4>
                    {channelPreview?.subscribers && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        チャンネル登録者数: {channelPreview.subscribers}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center">
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium group-hover:underline">
                        <ArrowRight size={11} />
                        チャンネルページを開く
                      </span>
                    </div>
                  </div>
                </div>
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

