import React, { useEffect, useState, useRef } from 'react';
import { ShortVideo, ChannelSubscription } from '../types';
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Music, ChevronUp, ChevronDown, Bell, Loader2, Play, Volume2, VolumeX } from 'lucide-react';
import Avatar from './Avatar';

interface ShortsPlayerProps {
  historyKeywords?: string;
  onSelectChannel: (channelIdOrName: string) => void;
  subscriptions: ChannelSubscription[];
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onRecordShortHistory?: (short: ShortVideo) => void;
  onCacheShorts?: (shorts: ShortVideo[]) => void;
}

export default function ShortsPlayer({
  historyKeywords = '',
  onSelectChannel,
  subscriptions,
  onToggleSubscribe,
  onRecordShortHistory,
  onCacheShorts
}: ShortsPlayerProps) {
  const [shortsList, setShortsList] = useState<ShortVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchShorts = async () => {
      setLoading(true);
      try {
        const query = historyKeywords ? encodeURIComponent(historyKeywords) : '';
        const res = await fetch(`/api/shorts?keywords=${query}`);
        if (res.ok) {
          const data = await res.json();
          setShortsList(data);
          if (onCacheShorts) {
            onCacheShorts(data);
          }
        }
      } catch (err) {
        console.error("Failed to load shorts", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShorts();
  }, [historyKeywords]);

  const currentShort = shortsList[currentIndex];

  useEffect(() => {
    if (currentShort && onRecordShortHistory) {
      onRecordShortHistory(currentShort);
    }
  }, [currentShort]);

  const handleNext = () => {
    if (currentIndex < shortsList.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') handleNext();
      if (e.key === 'ArrowUp') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, shortsList.length]);

  const toggleLike = (id: string) => {
    setLiked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-white text-gray-900 gap-3">
        <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
        <p className="text-sm font-semibold text-gray-700">あなたへのおすすめShortsを準備中...</p>
      </div>
    );
  }

  if (!currentShort) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-white text-gray-900">
        <p className="text-base font-bold">Shorts動画が見つかりませんでした。</p>
      </div>
    );
  }

  const isSubscribed = subscriptions.some(s => 
    s.id === currentShort.authorId || s.title === currentShort.author
  );

  return (
    <div className="flex-1 bg-gray-100 flex items-center justify-center p-2 sm:p-6 min-h-[calc(100vh-3.5rem)] relative overflow-hidden select-none">
      <div className="flex items-center gap-4 sm:gap-6 relative max-w-full">
        {/* ショート動画プレーヤーカード (9:16) */}
        <div 
          ref={containerRef}
          className="relative w-[340px] sm:w-[380px] h-[600px] sm:h-[680px] bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-300 flex items-center justify-center shrink-0"
        >
          {/* iframe動画 */}
          <iframe
            key={currentShort.videoId}
            src={`https://www.youtube-nocookie.com/embed/${currentShort.videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${currentShort.videoId}&controls=0`}
            className="w-full h-full object-cover border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={currentShort.title}
          />

          {/* ミュート切り替えボタン (右上) */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute top-4 right-4 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all z-20"
            title={isMuted ? "ミュート解除" : "ミュート"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* 下部情報グラデーションオーバーレイ */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-16 flex flex-col gap-3 text-white z-10">
            {/* クリエイター情報 & 登録ボタン */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onSelectChannel(currentShort.authorId || currentShort.author)}
                className="hover:opacity-80 transition-opacity"
              >
                <Avatar
                  src={currentShort.authorAvatar}
                  name={currentShort.author}
                  className="w-9 h-9 text-xs border border-white/30"
                />
              </button>
              
              <button
                onClick={() => onSelectChannel(currentShort.authorId || currentShort.author)}
                className="font-bold text-sm text-white hover:underline truncate max-w-[140px]"
              >
                @{currentShort.author}
              </button>

              <button
                onClick={() => onToggleSubscribe({
                  id: currentShort.authorId || currentShort.author,
                  title: currentShort.author,
                  avatar: currentShort.authorAvatar
                })}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${
                  isSubscribed
                    ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md'
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {isSubscribed ? '登録済み' : 'チャンネル登録'}
              </button>
            </div>

            {/* タイトル */}
            <p className="text-sm font-medium line-clamp-2 leading-snug drop-shadow-sm">
              {currentShort.title}
            </p>

            {/* 関連BGMアイコン */}
            <div className="flex items-center gap-2 text-xs text-gray-300 font-medium pt-1">
              <Music size={13} className="animate-pulse" />
              <span className="truncate">オリジナル音声 - {currentShort.author}</span>
            </div>
          </div>
        </div>

        {/* 右側アクションボタン (YouTube Shorts標準) */}
        <div className="flex flex-col gap-5 items-center justify-end h-[500px]">
          {/* 高評価 */}
          <button 
            onClick={() => toggleLike(currentShort.videoId)}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`p-3 rounded-full transition-colors ${
              liked[currentShort.videoId] 
                ? 'bg-red-600 text-white' 
                : 'bg-white hover:bg-gray-200 text-gray-800 shadow-md border border-gray-200'
            }`}>
              <ThumbsUp size={22} className={liked[currentShort.videoId] ? 'fill-current' : ''} />
            </div>
            <span className="text-xs font-bold text-gray-700">
              {currentShort.likeCount || '10万'}
            </span>
          </button>

          {/* 低評価 */}
          <button className="flex flex-col items-center gap-1 group">
            <div className="p-3 bg-white hover:bg-gray-200 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200">
              <ThumbsDown size={22} />
            </div>
            <span className="text-xs font-bold text-gray-700">低評価</span>
          </button>

          {/* コメント */}
          <button className="flex flex-col items-center gap-1 group">
            <div className="p-3 bg-white hover:bg-gray-200 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200">
              <MessageSquare size={22} />
            </div>
            <span className="text-xs font-bold text-gray-700">
              {currentShort.commentCount || '520'}
            </span>
          </button>

          {/* 共有 */}
          <button className="flex flex-col items-center gap-1 group">
            <div className="p-3 bg-white hover:bg-gray-200 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200">
              <Share2 size={22} />
            </div>
            <span className="text-xs font-bold text-gray-700">共有</span>
          </button>

          {/* 上下ナビゲーションボタン */}
          <div className="flex flex-col gap-2 mt-auto pt-4">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-3 bg-white hover:bg-gray-200 disabled:opacity-40 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200"
              title="前のShorts (↑)"
            >
              <ChevronUp size={22} />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === shortsList.length - 1}
              className="p-3 bg-white hover:bg-gray-200 disabled:opacity-40 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200"
              title="次のShorts (↓)"
            >
              <ChevronDown size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
