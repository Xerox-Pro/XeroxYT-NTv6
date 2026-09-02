import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Music2, 
  ChevronUp, 
  ChevronDown, 
  UserPlus, 
  Check, 
  X, 
  Send,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Sparkles
} from 'lucide-react';
import { ShortVideo, ChannelSubscription, Comment } from '../types';
import { fetchJSON, formatNumberJP } from '../utils';
import Avatar from './Avatar';

interface ShortsViewerProps {
  onVideoSelect?: (videoId: string, videoObj?: any) => void;
  onSelectChannel?: (channelId: string) => void;
  subscriptions?: ChannelSubscription[];
  onToggleSubscribe?: (channel: ChannelSubscription) => void;
  onRecordHistory?: (short: ShortVideo) => void;
}

export default function ShortsViewer({
  onVideoSelect,
  onSelectChannel,
  subscriptions = [],
  onToggleSubscribe,
  onRecordHistory
}: ShortsViewerProps) {
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ステート
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [dislikedMap, setDislikedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({});

  // コメントドロワー
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // 共有モーダル
  const [showShareToast, setShowShareToast] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isTransitioning = useRef<boolean>(false);

  // Shorts動画一覧の初期取得
  useEffect(() => {
    let isSubscribed = true;

    const fetchShortsData = async () => {
      setLoading(true);
      try {
        const res = await fetchJSON(`/api/shorts?page=1`);
        if (isSubscribed && res.shorts && Array.isArray(res.shorts) && res.shorts.length > 0) {
          setShorts(res.shorts);
          // 初期ライクカウントの保持
          const initialLikes: Record<string, number> = {};
          res.shorts.forEach((s: ShortVideo) => {
            let num = 0;
            if (typeof s.likeCount === 'number') num = s.likeCount;
            else if (typeof s.likeCount === 'string') {
              const parsed = parseInt(s.likeCount.replace(/[^0-9]/g, ''), 10);
              num = isNaN(parsed) ? Math.floor(Math.random() * 5000) + 1200 : parsed;
            } else {
              num = Math.floor(Math.random() * 8000) + 2000;
            }
            initialLikes[s.videoId] = num;
          });
          setLikeCountMap(initialLikes);
        }
      } catch (err) {
        console.error("Shorts fetch error:", err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    fetchShortsData();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // 次のページを追加入力
  const loadMoreShorts = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetchJSON(`/api/shorts?page=${nextPage}`);
      if (res.shorts && Array.isArray(res.shorts) && res.shorts.length > 0) {
        setShorts(prev => {
          const existingIds = new Set(prev.map(s => s.videoId));
          const newItems = res.shorts.filter((s: ShortVideo) => !existingIds.has(s.videoId));
          return [...prev, ...newItems];
        });
        setPage(nextPage);
        if (res.shorts.length < 5) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error("Failed to load more shorts:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const currentShort = shorts[currentIndex];

  // 閲覧履歴記録
  useEffect(() => {
    if (currentShort && onRecordHistory) {
      onRecordHistory(currentShort);
    }
  }, [currentIndex, currentShort]);

  // 残りわずかになったら追加ロード
  useEffect(() => {
    if (shorts.length > 0 && currentIndex >= shorts.length - 3) {
      loadMoreShorts();
    }
  }, [currentIndex, shorts.length]);

  // キーボード操作 (Up / Down 矢印で切り替え)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentOpen) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 'm') {
        e.preventDefault();
        setIsMuted(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, shorts.length, isCommentOpen]);

  const goToNext = () => {
    if (isTransitioning.current) return;
    if (currentIndex < shorts.length - 1) {
      isTransitioning.current = true;
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
      setIsCommentOpen(false);
      setTimeout(() => { isTransitioning.current = false; }, 300);
    }
  };

  const goToPrev = () => {
    if (isTransitioning.current) return;
    if (currentIndex > 0) {
      isTransitioning.current = true;
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
      setIsCommentOpen(false);
      setTimeout(() => { isTransitioning.current = false; }, 300);
    }
  };

  // ホイールスクロール操作
  const handleWheel = (e: React.WheelEvent) => {
    if (isCommentOpen) return;
    if (Math.abs(e.deltaY) < 30) return;
    if (e.deltaY > 0) {
      goToNext();
    } else {
      goToPrev();
    }
  };

  // タッチスワイプ操作
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isCommentOpen) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  // いいね操作
  const handleToggleLike = (videoId: string) => {
    const isCurrentlyLiked = !!likedMap[videoId];
    setLikedMap(prev => ({ ...prev, [videoId]: !isCurrentlyLiked }));
    setDislikedMap(prev => ({ ...prev, [videoId]: false }));
    setLikeCountMap(prev => ({
      ...prev,
      [videoId]: (prev[videoId] || 0) + (isCurrentlyLiked ? -1 : 1)
    }));
  };

  // ディスライク操作
  const handleToggleDislike = (videoId: string) => {
    const isCurrentlyDisliked = !!dislikedMap[videoId];
    setDislikedMap(prev => ({ ...prev, [videoId]: !isCurrentlyDisliked }));
    if (likedMap[videoId]) {
      setLikedMap(prev => ({ ...prev, [videoId]: false }));
      setLikeCountMap(prev => ({ ...prev, [videoId]: (prev[videoId] || 1) - 1 }));
    }
  };

  // チャンネル登録トグル
  const isSubscribed = currentShort ? subscriptions.some(s => s.title === currentShort.author || (s.id && s.id === currentShort.authorId)) : false;

  const handleSubClick = () => {
    if (!currentShort || !onToggleSubscribe) return;
    onToggleSubscribe({
      id: currentShort.authorId || `ch-${currentShort.author}`,
      title: currentShort.author,
      avatar: currentShort.authorAvatar
    });
  };

  // コメント取得
  const handleOpenComments = async () => {
    if (!currentShort) return;
    setIsCommentOpen(true);
    setLoadingComments(true);
    try {
      const data = await fetchJSON(`/api/video/${currentShort.videoId}/comments`);
      setComments(data || []);
    } catch (e) {
      console.error("Shorts comment load error:", e);
    } finally {
      setLoadingComments(false);
    }
  };

  // コメント追加
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      author: 'あなた',
      text: newCommentText.trim(),
      publishedTime: 'たった今',
      likeCount: 0
    };
    setComments(prev => [newComment, ...prev]);
    setNewCommentText('');
  };

  // 共有
  const handleShare = () => {
    if (!currentShort) return;
    const url = `${window.location.origin}/watch?v=${currentShort.videoId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2500);
    });
  };

  if (loading && shorts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] bg-black text-white gap-3">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
        <p className="text-sm font-medium text-gray-300">Shorts を読み込み中...</p>
      </div>
    );
  }

  if (!currentShort) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] bg-black text-white gap-3">
        <p className="text-sm font-medium text-gray-400">Shorts 動画が見つかりませんでした。</p>
      </div>
    );
  }

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = `https://www.youtubeeducation.com/embed/${currentShort.videoId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${currentShort.videoId}&playsinline=1&enablejsapi=1${originUrl ? `&origin=${encodeURIComponent(originUrl)}` : ''}`;

  return (
    <div 
      className="relative w-full h-[calc(100vh-56px)] bg-black text-white overflow-hidden flex items-center justify-center select-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      ref={containerRef}
    >
      {/* メインプレビュー画面カード (YouTube Shorts 公式アスペクト比 9:16) */}
      <div className="relative w-full max-w-[420px] h-full sm:h-[calc(100vh-72px)] sm:max-h-[820px] sm:rounded-2xl overflow-hidden bg-gray-900 shadow-2xl flex items-center justify-center border border-gray-800/50">
        
        {/* Iframe 動画プレイヤー */}
        <iframe
          key={currentShort.videoId}
          src={embedUrl}
          title={currentShort.title}
          className="w-full h-full object-cover pointer-events-none scale-[1.05]"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />

        {/* タップオーバーレイ (一時停止 / 再生切り替え) */}
        <div 
          onClick={() => setIsPlaying(prev => !prev)}
          className="absolute inset-0 cursor-pointer z-10 flex items-center justify-center bg-black/0 active:bg-black/10 transition-colors"
        >
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 animate-fade-in shadow-lg">
              <Play size={32} className="ml-1 fill-white" />
            </div>
          )}
        </div>

        {/* 上部グラデーション ＆ コントロール */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent z-20 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-red-600/90 text-xs font-bold text-white tracking-wider flex items-center gap-1 shadow-md">
              <Sparkles size={12} /> Shorts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-colors"
              title={isMuted ? "消音解除" : "ミュート"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>

        {/* 右側アクションバー (高評価 / コメント / シェア / チャンネル) */}
        <div className="absolute right-3 bottom-16 sm:bottom-20 z-20 flex flex-col items-center gap-5 pointer-events-auto">
          {/* 高評価ボタン */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => handleToggleLike(currentShort.videoId)}
              className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${
                likedMap[currentShort.videoId] 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/40' 
                  : 'bg-black/40 hover:bg-black/60 text-white'
              }`}
            >
              <ThumbsUp size={22} className={likedMap[currentShort.videoId] ? 'fill-white' : ''} />
            </button>
            <span className="text-xs font-semibold drop-shadow-md">
              {(likeCountMap[currentShort.videoId] || 0).toLocaleString()}
            </span>
          </div>

          {/* 低評価ボタン */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => handleToggleDislike(currentShort.videoId)}
              className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${
                dislikedMap[currentShort.videoId] 
                  ? 'bg-gray-800 text-red-400' 
                  : 'bg-black/40 hover:bg-black/60 text-white'
              }`}
            >
              <ThumbsDown size={22} className={dislikedMap[currentShort.videoId] ? 'fill-red-400' : ''} />
            </button>
            <span className="text-[11px] font-medium text-gray-300 drop-shadow-md">
              低評価
            </span>
          </div>

          {/* コメントボタン */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleOpenComments}
              className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90"
            >
              <MessageCircle size={22} />
            </button>
            <span className="text-xs font-semibold drop-shadow-md">
              コメント
            </span>
          </div>

          {/* 共有ボタン */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleShare}
              className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90"
            >
              <Share2 size={22} />
            </button>
            <span className="text-xs font-semibold drop-shadow-md">
              共有
            </span>
          </div>
        </div>

        {/* 下部動画詳細オーバーレイ */}
        <div className="absolute left-0 right-16 bottom-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-20 flex flex-col gap-2.5 pointer-events-auto">
          {/* チャンネル情報 ＆ 登録ボタン */}
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => onSelectChannel?.(currentShort.authorId || currentShort.author)}
              className="flex items-center gap-2 text-left group"
            >
              <Avatar src={currentShort.authorAvatar} name={currentShort.author} className="w-9 h-9 border border-white/20 shadow-md shrink-0" />
              <span className="text-sm font-bold text-white group-hover:underline truncate max-w-[140px]">
                @{currentShort.author}
              </span>
            </button>

            <button
              onClick={handleSubClick}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md shrink-0 flex items-center gap-1 ${
                isSubscribed 
                  ? 'bg-gray-800/80 text-gray-200 border border-gray-600 hover:bg-gray-700' 
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
              {isSubscribed ? (
                <>
                  <Check size={13} /> 登録済み
                </>
              ) : (
                <>
                  <UserPlus size={13} /> 登録
                </>
              )}
            </button>
          </div>

          {/* タイトル */}
          <h2 className="text-sm text-gray-100 font-medium line-clamp-2 leading-snug drop-shadow-sm">
            {currentShort.title}
          </h2>

          {/* BGM / 音源情報 */}
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Music2 size={13} className="animate-spin text-red-400 shrink-0" style={{ animationDuration: '4s' }} />
            <span className="truncate max-w-[200px]">
              {currentShort.author} - オリジナル音源
            </span>
          </div>
        </div>
      </div>

      {/* デスクトップ用 上下移動ナビゲーションボタン */}
      <div className="hidden lg:flex flex-col gap-3 absolute right-6 top-1/2 -translate-y-1/2 z-30">
        <button
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className={`w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700/60 text-white flex items-center justify-center shadow-xl transition-all ${
            currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-800 hover:scale-105 active:scale-95'
          }`}
          title="前の動画 (↑)"
        >
          <ChevronUp size={24} />
        </button>
        <span className="text-xs font-bold text-gray-400 text-center">
          {currentIndex + 1} / {shorts.length}
        </span>
        <button
          onClick={goToNext}
          disabled={currentIndex >= shorts.length - 1}
          className={`w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700/60 text-white flex items-center justify-center shadow-xl transition-all ${
            currentIndex >= shorts.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-800 hover:scale-105 active:scale-95'
          }`}
          title="次の動画 (↓)"
        >
          <ChevronDown size={24} />
        </button>
      </div>

      {/* 共有完了トースト */}
      {showShareToast && (
        <div className="absolute top-20 bg-gray-900/95 text-white border border-gray-700 px-4 py-2.5 rounded-xl shadow-2xl z-50 text-xs font-medium animate-fade-in flex items-center gap-2">
          <Check size={16} className="text-green-400" />
          <span>動画のリンクをクリップボードにコピーしました！</span>
        </div>
      )}

      {/* コメント・ドロワーモーダル */}
      {isCommentOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full sm:w-[420px] h-full bg-gray-900 text-white border-l border-gray-800 flex flex-col shadow-2xl animate-slide-left">
            {/* ヘッダー */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MessageCircle size={18} className="text-red-500" />
                コメント ({comments.length})
              </h3>
              <button
                onClick={() => setIsCommentOpen(false)}
                className="p-1 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* コメント書き込みフォーム */}
            <form onSubmit={handleAddComment} className="p-3 border-b border-gray-800 flex gap-2">
              <input
                type="text"
                placeholder="コメントを追加..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center shrink-0"
              >
                <Send size={14} />
              </button>
            </form>

            {/* コメントリスト */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
              {loadingComments ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  <span className="text-xs">コメントを読み込み中...</span>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs">
                  まだコメントはありません。最初のコメントを投稿してみましょう！
                </div>
              ) : (
                comments.map((comm) => (
                  <div key={comm.id} className="flex gap-3 text-xs">
                    <Avatar src={comm.authorAvatar} name={comm.author} className="w-7 h-7 text-xs shrink-0" />
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-200">@{comm.author}</span>
                        <span className="text-[10px] text-gray-500">{comm.publishedTime}</span>
                      </div>
                      <p className="text-gray-300 leading-relaxed break-words">{comm.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
