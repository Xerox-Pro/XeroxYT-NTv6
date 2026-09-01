import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ShortVideo, ChannelSubscription } from '../types';
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Music, ChevronUp, ChevronDown, Bell, Loader2, Play, Volume2, VolumeX } from 'lucide-react';
import { fetchJSON } from '../utils';
import Avatar from './Avatar';

interface ShortsPlayerProps {
  historyKeywords?: string;
  onSelectChannel: (channelIdOrName: string) => void;
  subscriptions: ChannelSubscription[];
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onRecordShortHistory?: (short: ShortVideo) => void;
  onCacheShorts?: (shorts: ShortVideo[]) => void;
}

const EDU_QUERY = "?mute=0&controls=0&start=0&origin=https%3A%2F%2Fcreate.kahoot.it&playsinline=1&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&fs=1&cc_load_policy=0&embed_config=%7B%22enc%22%3A%22AXH1ezkHzTyXd4X3k3e1Ycjh-eskpB6OmPDxYUDffkfgTCY9R6VjpqCuZjy9W3rNaiXOG312zEGCZ3hiOigXiv-Yzj028pgvIvoi1pH3aClyxZHLCVIIZ7eDV56Xo0XU4pUozocgw0f2jPmu3FK9uMUMD1lX2imAFQ%3D%3D%22%2C%22hideTitle%22%3Atrue%7D&enablejsapi=1&widgetid=1&forigin=https%3A%2F%2Fcreate.kahoot.it%2Flearner%2Fcb8cb5ae-d835-4c4a-bc2d-9cc78519d646%2Fcourse%2F6fba06e3-1f76-47a8-9a4a-53c53eb86286%2F0&aoriginsup=1&vf=6";

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
  const [page, setPage] = useState(1);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  const fetchShorts = async (pageNum: number, append = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!append) setLoading(true);
    try {
      const query = historyKeywords ? encodeURIComponent(historyKeywords) : '';
      const data = await fetchJSON(`/api/shorts?keywords=${query}&page=${pageNum}`);
      if (append) {
        setShortsList(prev => [...prev, ...data]);
      } else {
        setShortsList(data);
      }
      if (onCacheShorts && !append) {
        onCacheShorts(data);
      }
    } catch (err) {
      console.error("Failed to load shorts", err);
    } finally {
      if (!append) setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    setPage(1);
    fetchShorts(1, false);
  }, [historyKeywords]);

  useEffect(() => {
    const currentShort = shortsList[currentIndex];
    if (currentShort && onRecordShortHistory) {
      onRecordShortHistory(currentShort);
    }
    
    // 無限スクロールのトリガー (残り3つになったら次をロード)
    if (shortsList.length > 0 && currentIndex >= shortsList.length - 3) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchShorts(nextPage, true);
    }
  }, [currentIndex, shortsList]);

  // Intersection Observer によるスワイプ検知
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute('data-index'));
          if (!isNaN(index)) {
            setCurrentIndex(index);
          }
        }
      });
    }, { threshold: 0.6 });

    const container = containerRef.current;
    if (container) {
      const children = container.querySelectorAll('.short-item');
      children.forEach(child => observer.observe(child));
    }

    return () => observer.disconnect();
  }, [shortsList]); // リストが更新されるたびに監視を再設定

  const scrollTo = (index: number) => {
    if (containerRef.current) {
      const el = containerRef.current.querySelector(`[data-index="${index}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNext = () => scrollTo(currentIndex + 1);
  const handlePrev = () => scrollTo(currentIndex - 1);

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

  if (shortsList.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-white text-gray-900">
        <p className="text-base font-bold">Shorts動画が見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-gray-100 h-[calc(100vh-3.5rem)] overflow-y-scroll snap-y snap-mandatory no-scrollbar relative select-none"
    >
      {shortsList.map((short, index) => {
        const isActive = index === currentIndex;
        // パフォーマンスのため、アクティブな動画とその前後のみiframeをレンダリングする
        const isNearby = Math.abs(index - currentIndex) <= 1;
        const isSubscribed = subscriptions.some(s => s.id === short.authorId || s.title === short.author);

        return (
          <div 
            key={short.videoId + index} 
            data-index={index}
            className="short-item w-full h-full snap-start flex items-center justify-center p-2 sm:p-6 shrink-0 relative"
          >
            <div className="flex items-center gap-4 sm:gap-6 relative max-w-full">
              {/* ショート動画プレーヤーカード (9:16) */}
              <div className="relative w-[340px] sm:w-[380px] h-[600px] sm:h-[680px] bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-300 flex items-center justify-center shrink-0">
                {isNearby ? (
                  <iframe
                    src={`https://www.youtubeeducation.com/embed/${short.videoId}${EDU_QUERY}&autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${short.videoId}`}
                    className="w-full h-full object-cover border-0 pointer-events-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={short.title}
                  />
                ) : (
                  <img src={short.thumbnail} alt={short.title} className="w-full h-full object-cover opacity-50" />
                )}

                {/* ミュート切り替えボタン (右上) */}
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                  className="absolute top-4 right-4 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all z-20 cursor-pointer pointer-events-auto"
                  title={isMuted ? "ミュート解除" : "ミュート"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                {/* 下部情報グラデーションオーバーレイ */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-16 flex flex-col gap-3 text-white z-10 pointer-events-none">
                  {/* クリエイター情報 & 登録ボタン */}
                  <div className="flex items-center gap-2.5 pointer-events-auto">
                    <button onClick={() => onSelectChannel(short.authorId || short.author)} className="hover:opacity-80 transition-opacity">
                      <Avatar src={short.authorAvatar} name={short.author} className="w-9 h-9 text-xs border border-white/30" />
                    </button>
                    <button onClick={() => onSelectChannel(short.authorId || short.author)} className="font-bold text-sm text-white hover:underline truncate max-w-[140px]">
                      @{short.author}
                    </button>
                    <button
                      onClick={() => onToggleSubscribe({ id: short.authorId || short.author, title: short.author, avatar: short.authorAvatar })}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${isSubscribed ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md' : 'bg-white text-black hover:bg-gray-200'}`}
                    >
                      {isSubscribed ? '登録済み' : 'チャンネル登録'}
                    </button>
                  </div>
                  {/* タイトル */}
                  <p className="text-sm font-medium line-clamp-2 leading-snug drop-shadow-sm pointer-events-auto">
                    {short.title}
                  </p>
                  {/* 関連BGMアイコン */}
                  <div className="flex items-center gap-2 text-xs text-gray-300 font-medium pt-1">
                    <Music size={13} className="animate-pulse" />
                    <span className="truncate">オリジナル音声 - {short.author}</span>
                  </div>
                </div>
                
                {/* 画面全体をクリックで再生・一時停止等に使うための不可視レイヤー (必要に応じて) */}
                <div className="absolute inset-0 z-0"></div>
              </div>

              {/* 右側アクションボタン (YouTube Shorts標準) */}
              <div className="flex flex-col gap-5 items-center justify-end h-[500px]">
                {/* 高評価 */}
                <button onClick={() => toggleLike(short.videoId)} className="flex flex-col items-center gap-1 group">
                  <div className={`p-3 rounded-full transition-colors ${liked[short.videoId] ? 'bg-red-600 text-white' : 'bg-white hover:bg-gray-200 text-gray-800 shadow-md border border-gray-200'}`}>
                    <ThumbsUp size={22} className={liked[short.videoId] ? 'fill-current' : ''} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{short.likeCount || '10万'}</span>
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
                  <span className="text-xs font-bold text-gray-700">{short.commentCount || '520'}</span>
                </button>
                {/* 共有 */}
                <button className="flex flex-col items-center gap-1 group">
                  <div className="p-3 bg-white hover:bg-gray-200 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200">
                    <Share2 size={22} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">共有</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
