import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Share2, 
  ChevronUp, ChevronDown, Volume2, VolumeX, 
  X, Loader2, Music, Check, Play, Pause, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Avatar from './Avatar';
import { ShortVideo, Comment, CommentReply, ChannelSubscription } from '../types';
import { formatNumberJP, fetchJSON } from '../utils';

interface ShortsPageProps {
  initialVideoId?: string;
  channelId?: string;
  channelShorts?: ShortVideo[];
  historyIds?: string[];
  subscriptions?: ChannelSubscription[];
  onToggleSubscribe?: (channel: ChannelSubscription) => void;
  onSelectChannel?: (channelId: string) => void;
}

export default function ShortsPage({
  initialVideoId,
  channelId: propChannelId,
  channelShorts: propChannelShorts,
  historyIds = [],
  subscriptions = [],
  onToggleSubscribe,
  onSelectChannel,
}: ShortsPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const channelId = propChannelId || searchParams.get('channelId') || '';
  const queryVideoId = searchParams.get('v') || initialVideoId || '';

  const [shortsList, setShortsList] = useState<ShortVideo[]>(propChannelShorts || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [disliked, setDisliked] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  // Comments drawer state
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // Expandable description
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Throttled scroll navigation ref
  const lastScrollTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number>(0);

  // 1. Initial Load: Fetch channel shorts or recommended shorts based on history/video
  useEffect(() => {
    let isCancelled = false;

    async function loadShorts() {
      if (propChannelShorts && propChannelShorts.length > 0) {
        setShortsList(propChannelShorts);
        if (queryVideoId) {
          const idx = propChannelShorts.findIndex(s => s.videoId === queryVideoId);
          if (idx !== -1) setCurrentIndex(idx);
        }
        return;
      }

      setLoading(true);
      try {
        let endpoint = '/api/shorts/recommendations?';
        const params = new URLSearchParams();
        if (channelId) params.set('channelId', channelId);
        if (queryVideoId) params.set('videoId', queryVideoId);
        if (historyIds.length > 0) params.set('historyIds', historyIds.slice(0, 10).join(','));

        const data = await fetchJSON(`${endpoint}${params.toString()}`);
        if (!isCancelled && data && Array.isArray(data.shorts) && data.shorts.length > 0) {
          let list: ShortVideo[] = data.shorts;

          // If queryVideoId was requested and is not in list, fetch its details to prepend
          if (queryVideoId && !list.some(s => s.videoId === queryVideoId)) {
            try {
              const single = await fetchJSON(`/api/video/${queryVideoId}`);
              if (single && single.videoId) {
                list = [
                  {
                    videoId: single.videoId,
                    title: single.title,
                    author: single.author,
                    authorId: single.authorId,
                    authorAvatar: single.authorAvatar,
                    viewCount: single.viewCount,
                    likeCount: single.likeCount,
                    videoThumbnails: single.videoThumbnails,
                  },
                  ...list,
                ];
              }
            } catch {}
          }

          setShortsList(list);

          if (queryVideoId) {
            const idx = list.findIndex(s => s.videoId === queryVideoId);
            setCurrentIndex(idx !== -1 ? idx : 0);
          } else {
            setCurrentIndex(0);
          }
        }
      } catch (e) {
        console.error('Failed to load shorts recommendations:', e);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadShorts();
    return () => {
      isCancelled = true;
    };
  }, [channelId, queryVideoId, propChannelShorts]);

  const currentShort = shortsList[currentIndex];

  // Update URL to current short
  useEffect(() => {
    if (currentShort && currentShort.videoId) {
      const url = channelId
        ? `/shorts/${currentShort.videoId}?channelId=${encodeURIComponent(channelId)}`
        : `/shorts/${currentShort.videoId}`;
      window.history.replaceState(null, '', url);
      document.title = `${currentShort.title || 'Shorts'} - XeroxYT-NTv6`;
    }
  }, [currentShort, channelId]);

  // Load comments when drawer is opened
  useEffect(() => {
    if (isCommentsOpen && currentShort?.videoId) {
      setLoadingComments(true);
      fetchJSON(`/api/video/${currentShort.videoId}/comments?sort=top&page=1`)
        .then((res) => {
          if (res && Array.isArray(res.comments)) {
            setComments(res.comments);
          } else {
            setComments([]);
          }
        })
        .catch(() => setComments([]))
        .finally(() => setLoadingComments(false));
    }
  }, [isCommentsOpen, currentShort?.videoId]);

  // Navigate UP (Channel mode: 1 newer video / Normal mode: previous video)
  const handlePrevShort = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsDescExpanded(false);
    }
  }, [currentIndex]);

  // Navigate DOWN (Channel mode: 1 older video / Normal mode: next video)
  const handleNextShort = useCallback(() => {
    if (currentIndex < shortsList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsDescExpanded(false);
    } else if (!channelId) {
      // Load more recommendations if reached end of list
      fetchJSON(`/api/shorts/recommendations?historyIds=${historyIds.slice(0, 10).join(',')}`)
        .then((data) => {
          if (data && Array.isArray(data.shorts) && data.shorts.length > 0) {
            setShortsList((prev) => {
              const existingIds = new Set(prev.map(s => s.videoId));
              const newItems = data.shorts.filter((s: ShortVideo) => !existingIds.has(s.videoId));
              return [...prev, ...newItems];
            });
            setCurrentIndex((prev) => prev + 1);
          }
        })
        .catch(() => {});
    }
  }, [currentIndex, shortsList.length, channelId, historyIds]);

  // Scroll wheel handler (debounced 400ms)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // If user is scrolling inside comments drawer, don't trigger video change
      if ((e.target as HTMLElement).closest('.comments-drawer-scroll')) {
        return;
      }

      const now = Date.now();
      if (now - lastScrollTimeRef.current < 450) return;

      if (e.deltaY > 30) {
        lastScrollTimeRef.current = now;
        handleNextShort();
      } else if (e.deltaY < -30) {
        lastScrollTimeRef.current = now;
        handlePrevShort();
      }
    },
    [handleNextShort, handlePrevShort]
  );

  // Keyboard navigation (ArrowDown, ArrowUp, Space, M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNextShort();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrevShort();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'm') {
        setIsMuted((m) => !m);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextShort, handlePrevShort]);

  // Attach wheel event
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Touch Swipe for iPad and mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.comments-drawer-scroll')) return;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.comments-drawer-scroll')) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartYRef.current - touchEndY;

    if (diff > 50) {
      handleNextShort();
    } else if (diff < -50) {
      handlePrevShort();
    }
  };

  // Like & Share handlers
  const handleToggleLike = () => {
    if (!currentShort) return;
    setLiked((prev) => ({ ...prev, [currentShort.videoId]: !prev[currentShort.videoId] }));
    if (disliked[currentShort.videoId]) {
      setDisliked((prev) => ({ ...prev, [currentShort.videoId]: false }));
    }
  };

  const handleToggleDislike = () => {
    if (!currentShort) return;
    setDisliked((prev) => ({ ...prev, [currentShort.videoId]: !prev[currentShort.videoId] }));
    if (liked[currentShort.videoId]) {
      setLiked((prev) => ({ ...prev, [currentShort.videoId]: false }));
    }
  };

  const handleShare = () => {
    if (!currentShort) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: currentShort.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Subscribe check
  const isSubscribed = subscriptions.some(
    (s) =>
      s.id === currentShort?.authorId ||
      s.title === currentShort?.author
  );

  const handleSubscribeClick = () => {
    if (currentShort && onToggleSubscribe) {
      onToggleSubscribe({
        id: currentShort.authorId || currentShort.author,
        title: currentShort.author,
        avatar: currentShort.authorAvatar,
      });
    }
  };

  // Posting new comment in drawer
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newC: Comment = {
      id: `local-${Date.now()}`,
      author: 'あなた',
      authorAvatar: '',
      text: newCommentText.trim(),
      publishedTime: 'たった今',
      likeCount: '0',
      replyCount: 0,
    };
    setComments((prev) => [newC, ...prev]);
    setNewCommentText('');
  };

  if (loading && shortsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        <span className="text-sm font-medium">ショート動画を読み込み中...</span>
      </div>
    );
  }

  if (!currentShort) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3 text-gray-600">
        <AlertCircle className="w-10 h-10 text-gray-400" />
        <p className="text-sm font-medium">ショート動画が見つかりませんでした。</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
        >
          ホームに戻る
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative flex items-center justify-center w-full min-h-[calc(100vh-4rem)] bg-[#F8F9FA] py-2 sm:py-4 px-2 select-none overflow-hidden"
    >
      {/* Centered Shorts Card Container (iPad Optimized) */}
      <div className="flex items-center justify-center gap-3 sm:gap-5 w-full max-w-[1000px] h-[calc(100vh-5rem)] max-h-[860px]">
        
        {/* The 9:16 Video Player Card */}
        <div className="relative aspect-[9/16] h-full max-h-[840px] max-w-[440px] rounded-2xl overflow-hidden bg-black shadow-xl border border-gray-200/80 group">
          
          {/* Video Iframe Embed */}
          <iframe
            key={currentShort.videoId}
            src={`https://www.youtube.com/embed/${currentShort.videoId}?autoplay=1&controls=0&rel=0&loop=1&playlist=${currentShort.videoId}&playsinline=1&modestbranding=1&enablejsapi=1`}
            title={currentShort.title}
            className="w-full h-full object-cover pointer-events-auto"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />

          {/* Top overlay controls */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
            {/* Play/Pause indicator */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
              title={isPlaying ? '一時停止' : '再生'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Mute/Unmute */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
              title={isMuted ? 'ミュート解除' : 'ミュート'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          {/* Bottom Overlay Info (Channel & Title & Sound - YouTube exact layout) */}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 text-white flex flex-col gap-2 pointer-events-auto">
            {/* Channel Row */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onSelectChannel && onSelectChannel(currentShort.authorId || currentShort.author)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Avatar
                  src={currentShort.authorAvatar}
                  name={currentShort.author}
                  channelId={currentShort.authorId}
                  className="w-9 h-9 border border-white/60 shadow-sm"
                />
                <span className="font-bold text-sm text-white drop-shadow-sm truncate max-w-[160px]">
                  @{currentShort.author || 'チャンネル'}
                </span>
              </button>

              <button
                onClick={handleSubscribeClick}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ml-auto cursor-pointer ${
                  isSubscribed
                    ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md'
                    : 'bg-white text-black hover:bg-gray-100 active:scale-95'
                }`}
              >
                {isSubscribed ? '登録済み' : 'チャンネル登録'}
              </button>
            </div>

            {/* Title with expand toggle */}
            <div>
              <p
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className={`text-sm text-white font-medium leading-relaxed drop-shadow-sm cursor-pointer ${
                  !isDescExpanded ? 'line-clamp-2' : ''
                }`}
              >
                {currentShort.title}
              </p>
              {currentShort.title && currentShort.title.length > 50 && (
                <button
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="text-xs text-white/70 hover:text-white mt-0.5 underline cursor-pointer"
                >
                  {isDescExpanded ? '一部を表示' : '...もっと見る'}
                </button>
              )}
            </div>

            {/* Sound/Music info badge */}
            <div className="flex items-center gap-2 text-xs text-white/90 pt-1">
              <Music size={13} className="shrink-0 animate-pulse" />
              <span className="truncate text-[11px] drop-shadow-sm">
                オリジナル音源 - {currentShort.author}
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Column & Vertical Navigation (YouTube Style) */}
        <div className="flex flex-col items-center justify-end h-full pb-6 gap-4 z-20">
          
          {/* Like Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleToggleLike}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90 ${
                liked[currentShort.videoId]
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200/80'
              }`}
              title="高く評価"
            >
              <ThumbsUp size={20} className={liked[currentShort.videoId] ? 'fill-red-600' : ''} />
            </button>
            <span className="text-[11px] font-bold text-gray-700">
              {formatNumberJP((currentShort.viewCount ? Math.floor(currentShort.viewCount * 0.05) : 1200))}
            </span>
          </div>

          {/* Dislike Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleToggleDislike}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90 ${
                disliked[currentShort.videoId]
                  ? 'bg-gray-200 text-black border border-gray-300'
                  : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200/80'
              }`}
              title="低く評価"
            >
              <ThumbsDown size={20} className={disliked[currentShort.videoId] ? 'fill-current' : ''} />
            </button>
            <span className="text-[11px] font-medium text-gray-600">低評価</span>
          </div>

          {/* Comments Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setIsCommentsOpen(!isCommentsOpen)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90 ${
                isCommentsOpen
                  ? 'bg-blue-600 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200/80'
              }`}
              title="コメント"
            >
              <MessageSquare size={20} />
            </button>
            <span className="text-[11px] font-bold text-gray-700">
              {comments.length > 0 ? comments.length : '18'}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleShare}
              className="w-11 h-11 rounded-full bg-white hover:bg-gray-100 text-gray-800 border border-gray-200/80 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90"
              title="共有"
            >
              {copied ? <Check size={18} className="text-emerald-600" /> : <Share2 size={19} />}
            </button>
            <span className="text-[11px] font-medium text-gray-600">
              {copied ? 'コピー済' : '共有'}
            </span>
          </div>

          {/* Up & Down Navigation Buttons (for mouse/touch convenience) */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
            <button
              onClick={handlePrevShort}
              disabled={currentIndex === 0}
              className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none text-gray-700 border border-gray-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
              title="前の動画 (上スクロール)"
            >
              <ChevronUp size={22} />
            </button>
            <button
              onClick={handleNextShort}
              disabled={currentIndex >= shortsList.length - 1 && Boolean(channelId)}
              className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none text-gray-700 border border-gray-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
              title="次の動画 (下スクロール)"
            >
              <ChevronDown size={22} />
            </button>
          </div>
        </div>

        {/* Side-by-side Comments Panel (iPad & Desktop YouTube layout) */}
        <AnimatePresence>
          {isCommentsOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 380 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="hidden md:flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden z-30"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">コメント</h3>
                  <span className="text-xs text-gray-500 font-semibold">{comments.length}</span>
                </div>
                <button
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-1 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Comments Scrollable List */}
              <div className="flex-1 p-4 overflow-y-auto comments-drawer-scroll space-y-4 text-xs">
                {loadingComments ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    <span>コメントを読み込み中...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    まだコメントはありません
                  </div>
                ) : (
                  comments.map((c) => (
                    <ShortCommentItem
                      key={c.id}
                      comment={c}
                      videoId={currentShort.videoId}
                      onSelectChannel={onSelectChannel}
                    />
                  ))
                )}
              </div>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="p-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="コメントを追加..."
                  className="flex-1 bg-white border border-gray-200 rounded-full px-3.5 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  投稿
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Inner Comment item with expandable replies for Shorts
function ShortCommentItem({
  comment,
  videoId,
  onSelectChannel,
}: {
  comment: Comment;
  videoId: string;
  onSelectChannel?: (channelId: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<CommentReply[]>(comment.replies || []);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const toggleReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }

    setShowReplies(true);
    if (!hasLoaded) {
      setLoadingReplies(true);
      try {
        const res = await fetchJSON(`/api/video/${videoId}/comment/${encodeURIComponent(comment.id)}/replies`);
        if (res && Array.isArray(res.replies)) {
          setReplies(res.replies);
          setHasLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load comment replies:', err);
      } finally {
        setLoadingReplies(false);
      }
    }
  };

  return (
    <div className="flex items-start gap-2.5 text-xs">
      <button
        onClick={() => onSelectChannel && onSelectChannel(comment.authorId || comment.author)}
        className="shrink-0 mt-0.5 cursor-pointer hover:opacity-85"
      >
        <Avatar
          src={comment.authorAvatar}
          name={comment.author}
          channelId={comment.authorId}
          className="w-7 h-7 text-[10px]"
        />
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSelectChannel && onSelectChannel(comment.authorId || comment.author)}
            className="font-bold text-gray-900 text-[11px] hover:underline cursor-pointer truncate"
          >
            {comment.author}
          </button>
          <span className="text-[10px] text-gray-400">{comment.publishedTime}</span>
        </div>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words text-xs">
          {comment.text}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-gray-500 text-[11px]">
          <button className="flex items-center gap-1 hover:text-gray-900">
            <ThumbsUp size={12} />
            <span>{comment.likeCount}</span>
          </button>
          <button className="hover:text-gray-900">
            <ThumbsDown size={12} />
          </button>
        </div>

        {/* Replies Toggle Button */}
        {(comment.hasReplies || (comment.replyCount && comment.replyCount > 0)) && (
          <button
            type="button"
            onClick={toggleReplies}
            className="flex items-center gap-1.5 mt-1.5 text-blue-600 hover:text-blue-700 font-bold text-[11px] w-fit cursor-pointer"
          >
            {showReplies ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>
              {showReplies
                ? '返信を非表示'
                : `${comment.replyCount ? `${comment.replyCount}件の` : ''}返信`}
            </span>
          </button>
        )}

        {/* Nested Replies List */}
        {showReplies && (
          <div className="flex flex-col gap-2.5 mt-2 pl-3 border-l-2 border-gray-100">
            {loadingReplies ? (
              <div className="flex items-center gap-1.5 text-gray-400 py-1 text-[11px]">
                <Loader2 size={12} className="animate-spin text-blue-600" />
                <span>返信を取得中...</span>
              </div>
            ) : replies.length === 0 ? (
              <p className="text-[11px] text-gray-400 py-0.5">返信はありません</p>
            ) : (
              replies.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-[11px]">
                  <button
                    onClick={() => onSelectChannel && onSelectChannel(r.authorId || r.author)}
                    className="shrink-0 mt-0.5 cursor-pointer hover:opacity-85"
                  >
                    <Avatar
                      src={r.authorAvatar}
                      name={r.author}
                      channelId={r.authorId}
                      className="w-5 h-5 text-[8px]"
                    />
                  </button>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-900 text-[10px] truncate">{r.author}</span>
                      <span className="text-[9px] text-gray-400">{r.publishedTime}</span>
                    </div>
                    <p className="text-gray-800 text-[11px] leading-snug break-words">{r.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
