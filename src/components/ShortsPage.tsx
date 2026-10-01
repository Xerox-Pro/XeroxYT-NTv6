import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Share2, Volume2, VolumeX, 
  ChevronUp, ChevronDown, Play, Pause, Maximize2, Sparkles, History,
  Send, X, Loader2, Music, Check, UserPlus, UserCheck, CornerDownRight, Heart
} from 'lucide-react';
import { ShortVideo, WatchHistoryItem, ChannelSubscription, Comment, Video } from '../types';
import { fetchJSON, formatNumberJP } from '../utils';
import Avatar from './Avatar';
import { motion, AnimatePresence } from 'motion/react';

interface ShortsPageProps {
  watchHistory: WatchHistoryItem[];
  subscriptions: ChannelSubscription[];
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onSelectChannel: (channelIdOrName: string) => void;
  onVideoSelect: (videoId: string, videoObj?: Video) => void;
  initialShortId?: string | null;
}

export default function ShortsPage({
  watchHistory,
  subscriptions,
  onToggleSubscribe,
  onSelectChannel,
  onVideoSelect,
  initialShortId
}: ShortsPageProps) {
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState<'play' | 'pause' | null>(null);

  // Likes & dislikes per short
  const [likedShorts, setLikedShorts] = useState<Record<string, boolean>>({});
  const [dislikedShorts, setDislikedShorts] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Comment Drawer State
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Reply state in comment drawer
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [repliesMap, setRepliesMap] = useState<Record<string, Comment[]>>({});
  const [loadingRepliesMap, setLoadingRepliesMap] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isScrollingRef = useRef(false);

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  // 1. おすすめショート動画の取得（過去の視聴履歴に基づく）
  const fetchShortsRecommendations = useCallback(async (pageNum: number, isInitial = false) => {
    if (!isInitial && (loadingMore || !hasMore)) return;
    
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      // 過去に見た動画の情報をペイロードとして送信
      const historyPayload = (watchHistory || []).slice(0, 10).map((h) => ({
        videoId: h.videoId,
        title: h.title,
        author: h.author,
        authorId: (h as any).authorId,
      }));

      const res = await fetchJSON('/api/shorts/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyPayload,
          page: pageNum,
          limit: 10,
        }),
      });

      const newShorts: ShortVideo[] = Array.isArray(res?.shorts) ? res.shorts : [];

      if (isInitial) {
        // initialShortId が指定されている場合は先頭に配置
        if (initialShortId && !newShorts.some((s) => s.videoId === initialShortId)) {
          const customInitial: ShortVideo = {
            videoId: initialShortId,
            title: 'ショート動画',
            author: 'クリエイター',
            thumbnailUrl: `https://i.ytimg.com/vi/${initialShortId}/hqdefault.jpg`,
          };
          setShorts([customInitial, ...newShorts]);
        } else {
          setShorts(newShorts);
        }
        setActiveIndex(0);
      } else {
        setShorts((prev) => {
          const existingIds = new Set(prev.map((s) => s.videoId));
          const unique = newShorts.filter((s) => !existingIds.has(s.videoId));
          return [...prev, ...unique];
        });
      }

      setHasMore(Boolean(res?.hasMore && newShorts.length > 0));
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load shorts recommendations:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [watchHistory, initialShortId, loadingMore, hasMore]);

  // 初回ロード
  useEffect(() => {
    fetchShortsRecommendations(1, true);
  }, []);

  // 2. スクロール監視とアクティブな動画の特定（IntersectionObserver）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index) && index !== activeIndex) {
              setActiveIndex(index);
              setIsPlaying(true);
            }
          }
        });
      },
      {
        root: container,
        threshold: [0.6],
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [shorts, activeIndex]);

  // 残り少なくなったら次のページを自動読み込み
  useEffect(() => {
    if (shorts.length > 0 && activeIndex >= shorts.length - 3 && hasMore && !loadingMore) {
      fetchShortsRecommendations(page + 1, false);
    }
  }, [activeIndex, shorts.length, hasMore, loadingMore, page, fetchShortsRecommendations]);

  // 3. キーボードナビゲーション（↑/↓ でショート切り替え、Space で再生/一時停止、M でミュート）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力欄にフォーカスがある時は無視
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, shorts.length]);

  // 4. マウスホイールによる縦スクロール切り替え
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let wheelTimeout: NodeJS.Timeout | null = null;
    const handleWheel = (e: WheelEvent) => {
      // コメントドロワー内部スクロール時はショート送りを行わない
      if ((e.target as HTMLElement)?.closest('.comment-drawer-content')) return;

      if (Math.abs(e.deltaY) > 20) {
        e.preventDefault();
        if (wheelTimeout) return;
        wheelTimeout = setTimeout(() => {
          wheelTimeout = null;
        }, 400);

        if (e.deltaY > 0) {
          scrollToIndex(activeIndex + 1);
        } else {
          scrollToIndex(activeIndex - 1);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [activeIndex, shorts.length]);

  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        scrollToIndex(activeIndex + 1);
      } else {
        scrollToIndex(activeIndex - 1);
      }
    }
  };

  // 指定インデックスへスムーズスクロール
  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= shorts.length || isScrollingRef.current) return;
    isScrollingRef.current = true;
    const targetEl = itemRefs.current[index];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveIndex(index);
    }
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 450);
  };

  // 再生/一時停止トグル
  const togglePlayPause = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      setShowPlayIcon(next ? 'play' : 'pause');
      setTimeout(() => setShowPlayIcon(null), 700);
      return next;
    });
  };

  // 高評価（いいね）トグル
  const handleToggleLike = (videoId: string) => {
    setLikedShorts((prev) => {
      const isCurrentlyLiked = Boolean(prev[videoId]);
      if (!isCurrentlyLiked) {
        setDislikedShorts((d) => ({ ...d, [videoId]: false }));
      }
      return { ...prev, [videoId]: !isCurrentlyLiked };
    });
  };

  // 低評価トグル
  const handleToggleDislike = (videoId: string) => {
    setDislikedShorts((prev) => {
      const isCurrentlyDisliked = Boolean(prev[videoId]);
      if (!isCurrentlyDisliked) {
        setLikedShorts((l) => ({ ...l, [videoId]: false }));
      }
      return { ...prev, [videoId]: !isCurrentlyDisliked };
    });
  };

  // シェア機能
  const handleShare = async (short: ShortVideo) => {
    const url = `${window.location.origin}/shorts/${short.videoId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: short.title,
          text: `${short.title} - XeroxYT Shorts`,
          url,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast('リンクをクリップボードにコピーしました！');
    } catch {
      showToast('URL: ' + url);
    }
  };

  // コメント読み込み
  const handleOpenComments = async (videoId: string) => {
    setIsCommentDrawerOpen(true);
    setLoadingComments(true);
    try {
      const res = await fetchJSON(`/api/video/${videoId}/comments?sort=top&page=1`);
      const commentList = Array.isArray(res) ? res : res.comments || [];
      setComments(commentList);
    } catch (err) {
      console.error('Failed to load comments for short:', err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  // コメント返信の展開読み込み
  const handleToggleReplies = async (videoId: string, commentId: string) => {
    if (repliesMap[commentId]) {
      setRepliesMap((prev) => {
        const copy = { ...prev };
        delete copy[commentId];
        return copy;
      });
      return;
    }

    setLoadingRepliesMap((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetchJSON(`/api/video/${videoId}/comments/${commentId}/replies?page=1`);
      const list = Array.isArray(res?.replies) ? res.replies : [];
      setRepliesMap((prev) => ({ ...prev, [commentId]: list }));
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingRepliesMap((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  // コメント投稿
  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    const newComment: Comment = {
      id: 'local_c_' + Date.now(),
      author: 'あなた',
      authorAvatar: '',
      text: commentText.trim(),
      publishedTime: 'たった今',
      likeCount: '0',
      replyCount: 0,
    };

    setComments((prev) => [newComment, ...prev]);
    setCommentText('');
    setSubmittingComment(false);
    showToast('コメントを投稿しました');
  };

  // 返信投稿
  const handleSubmitReply = (commentId: string) => {
    if (!replyText.trim()) return;
    const newReply: Comment = {
      id: 'local_r_' + Date.now(),
      author: 'あなた',
      authorAvatar: '',
      text: replyText.trim(),
      publishedTime: 'たった今',
      likeCount: '0',
      replyCount: 0,
    };

    setRepliesMap((prev) => ({
      ...prev,
      [commentId]: [...(prev[commentId] || []), newReply],
    }));
    setReplyText('');
    setOpenReplyId(null);
    showToast('返信を投稿しました');
  };

  const currentShort = shorts[activeIndex];

  // チャンネル登録状態判定
  const isSubscribed = currentShort?.authorId 
    ? subscriptions.some((s) => s.id === currentShort.authorId)
    : false;

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-[#0A0A0C] text-white flex justify-center items-center overflow-hidden select-none">
      {/* トースト通知 */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-18 z-60 px-4 py-2.5 bg-gray-900/95 border border-white/20 text-white rounded-full text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2"
          >
            <Check size={14} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ローディング表示 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-3 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-medium">過去の視聴履歴からショートを厳選中...</p>
        </div>
      ) : shorts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center p-6 max-w-md">
          <Sparkles size={36} className="text-amber-400" />
          <h2 className="text-lg font-bold">ショート動画が見つかりませんでした</h2>
          <p className="text-xs text-gray-400">
            動画をいくつか視聴すると、あなたの好みに合わせたショート動画がここにレコメンドされます。
          </p>
        </div>
      ) : (
        <>
          {/* メインリールコンテナ (縦スクロール・スナップスクロール) */}
          <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar flex flex-col items-center"
          >
            {shorts.map((short, index) => {
              const isActive = index === activeIndex;
              const isLiked = Boolean(likedShorts[short.videoId]);
              const isDisliked = Boolean(dislikedShorts[short.videoId]);

              return (
                <div
                  key={`${short.videoId}_${index}`}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  data-index={index}
                  className="w-full h-full shrink-0 flex items-center justify-center snap-start snap-always py-2 sm:py-4 px-2"
                >
                  <div className="relative flex items-center gap-3 sm:gap-4 md:gap-5 w-full max-w-[540px] justify-center h-full">
                    {/* 縦型動画カード (9:16) */}
                    <div 
                      onClick={togglePlayPause}
                      className="relative w-full max-w-[360px] sm:max-w-[390px] md:max-w-[410px] aspect-[9/16] max-h-[calc(100vh-5.5rem)] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 group cursor-pointer"
                    >
                      {/* 動画プレイヤー (アクティブ時のみ埋め込み再生) */}
                      {isActive ? (
                        <iframe
                          src={`/edu/${short.videoId}?autoplay=1&enablejsapi=1&rel=0`}
                          className="w-full h-full border-0 pointer-events-none"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          title={short.title}
                        />
                      ) : (
                        <img
                          src={short.thumbnailUrl || `https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`}
                          alt={short.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}

                      {/* 再生/一時停止中央フィードバックアイコン */}
                      <AnimatePresence>
                        {showPlayIcon && isActive && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                          >
                            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                              {showPlayIcon === 'play' ? <Play size={28} className="fill-white translate-x-0.5" /> : <Pause size={28} className="fill-white" />}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* 上部オーバーレイ: 音声ミュートボタン & 視聴履歴レコメンドバッジ */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                        {/* 過去の視聴履歴からの推薦バッジ */}
                        {short.basedOn ? (
                          <div className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-[11px] text-amber-300 border border-amber-400/30 max-w-[75%] truncate shadow-md"
                            title={`過去に視聴した「${short.basedOn.title}」に基づいたおすすめショートです`}
                          >
                            <Sparkles size={12} className="shrink-0 text-amber-400" />
                            <span className="truncate">関連: {short.basedOn.title}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-[10px] text-gray-300">
                            <span>おすすめ</span>
                          </div>
                        )}

                        {/* ミュート切替ボタン */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMuted((prev) => !prev);
                          }}
                          className="pointer-events-auto p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-transform active:scale-90"
                          title={isMuted ? 'ミュート解除 (M)' : 'ミュート (M)'}
                        >
                          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                      </div>

                      {/* 下部情報オーバーレイ (チャンネル名、タイトル、音源情報) */}
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2 z-20 pointer-events-auto"
                      >
                        {/* チャンネル情報 & チャンネル登録ボタン */}
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => onSelectChannel(short.authorId || short.author)}
                            className="shrink-0 hover:opacity-90 transition-opacity"
                          >
                            <Avatar
                              src={short.authorAvatar}
                              name={short.author}
                              channelId={short.authorId}
                              className="w-8 h-8 rounded-full border border-white/20 shadow-xs"
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectChannel(short.authorId || short.author)}
                            className="font-bold text-xs sm:text-sm text-white hover:underline truncate max-w-[150px] sm:max-w-[180px] text-left"
                          >
                            {short.author}
                          </button>

                          {/* チャンネル登録ボタン */}
                          <button
                            type="button"
                            onClick={() => {
                              onToggleSubscribe({
                                id: short.authorId || short.author,
                                title: short.author,
                                avatar: short.authorAvatar,
                              });
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ml-auto ${
                              isSubscribed
                                ? 'bg-white/20 hover:bg-white/30 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white shadow-md'
                            }`}
                          >
                            {isSubscribed ? '登録済み' : 'チャンネル登録'}
                          </button>
                        </div>

                        {/* 動画タイトル */}
                        <p className="text-xs sm:text-sm font-medium text-white line-clamp-2 leading-snug drop-shadow-xs">
                          {short.title}
                        </p>

                        {/* 音源タグ */}
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
                          <Music size={12} className="animate-spin" style={{ animationDuration: '6s' }} />
                          <span className="truncate">オリジナル音源 - {short.author}</span>
                        </div>
                      </div>

                      {/* 下部再生プログレスバー */}
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-30">
                        {isActive && isPlaying && (
                          <div className="h-full bg-red-600 animate-pulse w-full origin-left" />
                        )}
                      </div>
                    </div>

                    {/* 右サイドのアクションボタン群 (高評価、低評価、コメント、共有、通常プレイヤーで開く) */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="flex flex-col items-center gap-4 sm:gap-5 self-end pb-4 shrink-0"
                    >
                      {/* いいね (ThumbsUp) */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleLike(short.videoId)}
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isLiked
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-105'
                              : 'bg-gray-800/80 hover:bg-gray-700/80 text-white'
                          }`}
                          title="高評価"
                        >
                          <ThumbsUp size={19} className={isLiked ? 'fill-white' : ''} />
                        </button>
                        <span className="text-[11px] font-semibold text-gray-300">
                          {isLiked ? '高評価済' : (short.likeCount || '高評価')}
                        </span>
                      </div>

                      {/* 低評価 (ThumbsDown) */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleDislike(short.videoId)}
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isDisliked
                              ? 'bg-gray-700 text-white scale-105'
                              : 'bg-gray-800/80 hover:bg-gray-700/80 text-white'
                          }`}
                          title="低評価"
                        >
                          <ThumbsDown size={19} className={isDisliked ? 'fill-white' : ''} />
                        </button>
                        <span className="text-[11px] font-semibold text-gray-300">低評価</span>
                      </div>

                      {/* コメントボタン */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenComments(short.videoId)}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-800/80 hover:bg-gray-700/80 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105"
                          title="コメントを表示"
                        >
                          <MessageSquare size={19} />
                        </button>
                        <span className="text-[11px] font-semibold text-gray-300">
                          {short.commentCount || 'コメント'}
                        </span>
                      </div>

                      {/* 共有ボタン */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleShare(short)}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-800/80 hover:bg-gray-700/80 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105"
                          title="共有"
                        >
                          <Share2 size={19} />
                        </button>
                        <span className="text-[11px] font-semibold text-gray-300">共有</span>
                      </div>

                      {/* 通常の動画プレイヤーで開く */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onVideoSelect(short.videoId)}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-800/80 hover:bg-gray-700/80 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105"
                          title="通常プレイヤーで全画面再生"
                        >
                          <Maximize2 size={18} />
                        </button>
                        <span className="text-[11px] font-semibold text-gray-300">開く</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* スクロール下部ローディング */}
            {loadingMore && (
              <div className="py-6 flex items-center justify-center gap-2 text-gray-400 text-xs">
                <Loader2 size={18} className="animate-spin text-red-500" />
                <span>次のショート動画を読み込み中...</span>
              </div>
            )}
          </div>

          {/* デスクトップ用 次へ / 前へ フローティング操作ボタン */}
          <div className="hidden lg:flex flex-col gap-3 fixed right-6 top-1/2 -translate-y-1/2 z-40">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => scrollToIndex(activeIndex - 1)}
              className="w-12 h-12 rounded-full bg-gray-800/90 hover:bg-gray-700 border border-white/10 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl hover:scale-110 active:scale-95"
              title="前のショート動画 (↑)"
            >
              <ChevronUp size={24} />
            </button>
            <button
              type="button"
              disabled={activeIndex >= shorts.length - 1}
              onClick={() => scrollToIndex(activeIndex + 1)}
              className="w-12 h-12 rounded-full bg-gray-800/90 hover:bg-gray-700 border border-white/10 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl hover:scale-110 active:scale-95"
              title="次のショート動画 (↓)"
            >
              <ChevronDown size={24} />
            </button>
          </div>
        </>
      )}

      {/* ─── コメントドロワー (スライドオーバーパネル) ─── */}
      <AnimatePresence>
        {isCommentDrawerOpen && currentShort && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            {/* 背景クリックで閉じる */}
            <div 
              onClick={() => setIsCommentDrawerOpen(false)} 
              className="flex-1 cursor-pointer" 
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-[420px] h-full bg-[#18181C] border-l border-white/10 text-white flex flex-col shadow-2xl"
            >
              {/* コメントヘッダー */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">コメント</h3>
                  <span className="text-xs text-gray-400 font-medium">
                    {comments.length > 0 ? `${comments.length.toLocaleString()}件` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCommentDrawerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* コメント一覧 */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {loadingComments ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400 text-xs">
                    <Loader2 size={24} className="animate-spin text-red-500" />
                    <span>コメントを読み込み中...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-xs">
                    まだコメントはありません。最初のコメントを投稿しましょう！
                  </div>
                ) : (
                  comments.map((c) => {
                    const replies = repliesMap[c.id];
                    const isLoadingReplies = loadingRepliesMap[c.id];

                    return (
                      <div key={c.id} className="flex flex-col gap-2 text-xs">
                        <div className="flex items-start gap-2.5">
                          <Avatar
                            src={c.authorAvatar}
                            name={c.author}
                            channelId={c.authorId}
                            className="w-7 h-7 text-[10px] rounded-full shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-200 truncate">{c.author}</span>
                              <span className="text-[10px] text-gray-500 shrink-0">{c.publishedTime}</span>
                            </div>
                            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap break-words text-xs">
                              {c.text}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-gray-400 text-[11px]">
                              <button className="flex items-center gap-1 hover:text-white">
                                <ThumbsUp size={12} />
                                <span>{c.likeCount || '0'}</span>
                              </button>
                              <button 
                                onClick={() => setOpenReplyId(openReplyId === c.id ? null : c.id)}
                                className="hover:text-white font-semibold"
                              >
                                返信
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 返信入力フォーム */}
                        {openReplyId === c.id && (
                          <div className="ml-9 mt-1 flex flex-col gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder={`@${c.author} に返信...`}
                              className="w-full bg-transparent text-xs text-white focus:outline-hidden py-1 border-b border-white/20 focus:border-blue-500"
                            />
                            <div className="flex justify-end gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenReplyId(null);
                                  setReplyText('');
                                }}
                                className="px-2.5 py-1 text-gray-400 hover:text-white"
                              >
                                キャンセル
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSubmitReply(c.id)}
                                disabled={!replyText.trim()}
                                className="px-3 py-1 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 disabled:opacity-50"
                              >
                                返信
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 返信表示トグル */}
                        {(c.hasReplies || (c.replyCount && c.replyCount > 0) || replies) && (
                          <div className="ml-9">
                            <button
                              type="button"
                              onClick={() => handleToggleReplies(currentShort.videoId, c.id)}
                              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 py-0.5"
                            >
                              <CornerDownRight size={12} />
                              <span>
                                {replies
                                  ? '返信を非表示'
                                  : `${c.replyCount ? `${c.replyCount}件の返信` : '返信を表示'}`}
                              </span>
                            </button>

                            {/* 返信一覧 */}
                            {isLoadingReplies ? (
                              <div className="py-2 flex items-center gap-1.5 text-gray-500 text-[11px]">
                                <Loader2 size={12} className="animate-spin text-blue-500" />
                                <span>返信を読み込み中...</span>
                              </div>
                            ) : (
                              replies && (
                                <div className="mt-2 pl-3 border-l border-white/15 flex flex-col gap-2.5">
                                  {replies.map((r) => (
                                    <div key={r.id} className="flex items-start gap-2">
                                      <Avatar
                                        src={r.authorAvatar}
                                        name={r.author}
                                        channelId={r.authorId}
                                        className="w-5 h-5 text-[9px] rounded-full shrink-0 mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-gray-200 text-[11px]">{r.author}</span>
                                          <span className="text-[10px] text-gray-500">{r.publishedTime}</span>
                                        </div>
                                        <p className="text-gray-300 text-[11px] leading-relaxed break-words">
                                          {r.text}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* コメント投稿バー */}
              <form onSubmit={handleSubmitComment} className="p-3 border-t border-white/10 bg-[#121215] flex items-center gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="コメントを追加..."
                  className="flex-1 bg-white/10 text-xs text-white rounded-full px-4 py-2.5 focus:outline-hidden focus:ring-1 focus:ring-red-500"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="p-2.5 rounded-full bg-red-600 text-white disabled:opacity-40 hover:bg-red-700 transition-colors"
                >
                  {submittingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
