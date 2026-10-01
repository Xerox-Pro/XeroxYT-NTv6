import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Share2, 
  ChevronUp, ChevronDown, Volume2, VolumeX, Play, Pause, X, Loader2, ArrowLeft 
} from 'lucide-react';
import Avatar from './Avatar';
import { fetchJSON } from '../utils';
import { Comment } from '../types';

interface ShortItem {
  videoId: string;
  title: string;
  author: string;
  authorId?: string;
  authorAvatar?: string;
  viewCount?: number;
  publishedText?: string;
  lengthSeconds?: number;
}

interface ShortsPageProps {
  initialVideoId?: string | null;
  channelIdForQueue?: string | null;
  watchHistory?: any[];
  onBackToHome: () => void;
  onSelectChannel: (channelId: string) => void;
}

export default function ShortsPage({
  initialVideoId,
  channelIdForQueue,
  watchHistory = [],
  onBackToHome,
  onSelectChannel
}: ShortsPageProps) {
  const [shortsList, setShortsList] = useState<ShortItem[]>([]);
  const [currentIndex, setCurrentVideoIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Player controls
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Likes & interactions state
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [dislikedMap, setDislikedMap] = useState<Record<string, boolean>>({});

  // Comments drawer state
  const [isCommentsOpen, setIsCommentsOpen] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState<string>('');
  const [commentSort, setCommentSort] = useState<'top' | 'newest'>('top');
  const [openRepliesMap, setOpenRepliesMap] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);

  const currentVideo = shortsList[currentIndex];

  // 1. Fetch Shorts queue
  useEffect(() => {
    async function loadShorts() {
      setLoading(true);
      setError('');
      try {
        let list: ShortItem[] = [];

        // CASE A: Comming from a Channel Page (チャンネルのショートを再生)
        if (channelIdForQueue) {
          console.log(`[Shorts] Loading shorts for channel: ${channelIdForQueue}`);
          const chData = await fetchJSON(`/api/channel/${channelIdForQueue}/tab/shorts`).catch(() => null);
          const rawVideos = chData?.videos || chData?.shortVideos || [];
          
          if (rawVideos.length > 0) {
            // Sort channel shorts chronologically (assuming first in list is latest, index 0 is newest)
            list = rawVideos.map((v: any) => ({
              videoId: v.videoId,
              title: v.title || 'ショート動画',
              author: v.author || chData?.title || 'チャンネル',
              authorId: v.authorId || channelIdForQueue,
              authorAvatar: v.authorAvatar || chData?.avatar || '',
              viewCount: v.viewCount,
              publishedText: v.publishedText
            }));
          }
        }

        // CASE B: Normal load / history-based recommendations
        if (list.length === 0) {
          const historyIds = watchHistory.map(h => h.videoId).filter(Boolean).join(',');
          console.log(`[Shorts] Loading recommendations based on watch history: ${historyIds}`);
          const recs = await fetchJSON(`/api/shorts/recommendations?historyIds=${encodeURIComponent(historyIds)}`);
          if (Array.isArray(recs) && recs.length > 0) {
            list = recs;
          }
        }

        // Prepend specific video if requested
        if (initialVideoId) {
          const alreadyExistsIdx = list.findIndex(v => v.videoId === initialVideoId);
          if (alreadyExistsIdx >= 0) {
            list.splice(alreadyExistsIdx, 1);
          }
          // Fetch simple basic info for initialVideoId to build its ShortItem
          const basic = await fetchJSON(`/api/video/${initialVideoId}`).catch(() => null);
          const firstItem: ShortItem = {
            videoId: initialVideoId,
            title: basic?.title || 'ショート動画',
            author: basic?.author || 'チャンネル',
            authorId: basic?.authorId,
            authorAvatar: basic?.authorAvatar || '',
            viewCount: basic?.viewCount
          };
          list.unshift(firstItem);
        }

        if (list.length === 0) {
          throw new Error('ショート動画を取得できませんでした。');
        }

        setShortsList(list);
        setCurrentVideoIndex(0);
      } catch (err: any) {
        setError(err.message || '読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    }

    loadShorts();
  }, [initialVideoId, channelIdForQueue]);

  // Load comments when active video changes or sort shifts
  useEffect(() => {
    if (!currentVideo?.videoId || !isCommentsOpen) return;
    async function loadComments() {
      setLoadingComments(true);
      try {
        const res = await fetchJSON(`/api/video/${currentVideo.videoId}/comments?sort=${commentSort}&page=1`);
        const list = Array.isArray(res) ? res : res.comments || [];
        setComments(list);
      } catch (e) {
        console.warn('Failed to fetch comments for short', e);
      } finally {
        setLoadingComments(false);
      }
    }
    loadComments();
  }, [currentVideo?.videoId, isCommentsOpen, commentSort]);

  // Next / Prev actions
  const handleNext = useCallback(() => {
    if (currentIndex < shortsList.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
      setIsCommentsOpen(false);
    }
  }, [currentIndex, shortsList.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentVideoIndex(prev => prev - 1);
      setIsCommentsOpen(false);
    }
  }, [currentIndex]);

  // Handle Wheel scroll (YouTube Shorts style swipe gesture)
  const handleWheel = (e: React.WheelEvent) => {
    if (isCommentsOpen) return; // Ignore scrolling when commenting
    e.preventDefault();

    if (scrollTimeoutRef.current) return;

    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;
    }, 800); // 800ms throttle

    if (e.deltaY > 30) {
      // Scroll down -> next older video (or next in list)
      handleNext();
    } else if (e.deltaY < -30) {
      // Scroll up -> next newer video (or prev in list)
      handlePrev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentsOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, isCommentsOpen]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !currentVideo?.videoId) return;

    const newCommentObj: Comment = {
      id: Math.random().toString(),
      author: '自分',
      text: commentInput,
      publishedTime: 'たった今',
      likeCount: 0,
      replies: []
    };

    setComments(prev => [newCommentObj, ...prev]);
    setCommentInput('');
  };

  const toggleReplies = (commentId: string) => {
    setOpenRepliesMap(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-2" />
        <p className="text-sm font-semibold text-gray-700">ショートを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-white px-4">
        <div className="text-red-500 font-bold mb-3">エラーが発生しました</div>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button 
          onClick={onBackToHome}
          className="px-5 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-800 transition-colors"
        >
          ホームに戻る
        </button>
      </div>
    );
  }

  if (!currentVideo) return null;

  return (
    <div 
      ref={containerRef}
      onWheel={handleWheel}
      className="flex-1 min-h-screen bg-white flex flex-col items-center select-none overflow-hidden pb-12 pt-3"
    >
      {/* Top Header Panel */}
      <div className="w-full max-w-[1024px] px-4 flex items-center justify-between mb-2">
        <button 
          onClick={onBackToHome}
          className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 transition-colors font-bold text-sm cursor-pointer"
        >
          <ArrowLeft size={18} />
          <span>戻る</span>
        </button>
        <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-1">
          <Play size={16} className="text-red-600 fill-red-600" />
          <span>Shorts</span>
        </h1>
        <div className="w-12" />
      </div>

      {/* Main iPad-optimized Layout */}
      <div className="flex-1 flex items-center justify-center w-full max-w-[1024px] px-2 relative md:gap-6">
        
        {/* Scroll Helper Navigation Buttons (Descriptive & Accessible) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2 z-10">
          <button 
            disabled={currentIndex === 0}
            onClick={handlePrev}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 text-gray-700 transition-all shadow-md cursor-pointer"
            title="最新の動画へスクロール"
          >
            <ChevronUp size={22} />
          </button>
          <button 
            disabled={currentIndex === shortsList.length - 1}
            onClick={handleNext}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 text-gray-700 transition-all shadow-md cursor-pointer"
            title="古い動画へスクロール"
          >
            <ChevronDown size={22} />
          </button>
        </div>

        {/* Video Box Container (iPad Optimized size 9:16) */}
        <div className="relative w-full max-w-[390px] h-[640px] md:h-[680px] bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          
          {/* Iframe Youtube Embed configured nicely for Shorts */}
          <iframe
            key={currentVideo.videoId + (isPlaying ? '-playing' : '-paused')}
            src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${currentVideo.videoId}&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0`}
            className="w-full h-full pointer-events-none object-cover absolute top-0 left-0"
            allow="autoplay; encrypted-media"
            title={currentVideo.title}
          />

          {/* Iframe Clickable Shield/Toggler to Play/Pause & Volume */}
          <div 
            onClick={() => setIsPlaying(!isPlaying)}
            className="absolute inset-0 bg-transparent cursor-pointer z-10"
          />

          {/* Audio State Icon overlay */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all z-20 cursor-pointer"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Pause overlay icon if paused */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 z-10 pointer-events-none">
              <Play size={48} className="text-white fill-white opacity-90 scale-90" />
            </div>
          )}

          {/* Description & Channel Overlay (Bottom Left) */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pb-5 flex flex-col gap-2.5 text-white z-20 pointer-events-none select-none">
            
            {/* Channel info */}
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentVideo.authorId) onSelectChannel(currentVideo.authorId);
                }}
                className="pointer-events-auto cursor-pointer flex items-center gap-2 hover:opacity-90"
              >
                <Avatar 
                  src={currentVideo.authorAvatar} 
                  name={currentVideo.author} 
                  channelId={currentVideo.authorId}
                  className="w-9 h-9 border border-white/20" 
                />
                <span className="font-bold text-sm tracking-wide shadow-sm truncate max-w-[140px]">
                  @{currentVideo.author}
                </span>
              </button>
              <span className="text-[10px] bg-red-600 font-extrabold px-1.5 py-0.5 rounded-sm shrink-0">SHORTS</span>
            </div>

            {/* Video Title */}
            <p className="text-xs md:text-sm font-medium leading-relaxed line-clamp-2 pr-4 text-gray-100 font-sans tracking-wide">
              {currentVideo.title}
            </p>
          </div>
        </div>

        {/* Action Panel on the Right Side (iPad Optimized) */}
        <div className="flex flex-col gap-5 items-center ml-2 md:ml-0 z-20">
          
          {/* Like */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                const vid = currentVideo.videoId;
                setLikedMap(prev => ({ ...prev, [vid]: !prev[vid] }));
                setDislikedMap(prev => ({ ...prev, [vid]: false }));
              }}
              className={`p-3.5 rounded-full shadow-lg transition-all cursor-pointer ${
                likedMap[currentVideo.videoId] 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              }`}
            >
              <ThumbsUp size={20} className={likedMap[currentVideo.videoId] ? 'fill-white' : ''} />
            </button>
            <span className="text-[10px] font-bold text-gray-600 mt-1">高評価</span>
          </div>

          {/* Dislike */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                const vid = currentVideo.videoId;
                setDislikedMap(prev => ({ ...prev, [vid]: !prev[vid] }));
                setLikedMap(prev => ({ ...prev, [vid]: false }));
              }}
              className={`p-3.5 rounded-full shadow-lg transition-all cursor-pointer ${
                dislikedMap[currentVideo.videoId] 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              }`}
            >
              <ThumbsDown size={20} className={dislikedMap[currentVideo.videoId] ? 'fill-white' : ''} />
            </button>
            <span className="text-[10px] font-bold text-gray-600 mt-1">低評価</span>
          </div>

          {/* Comments */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsCommentsOpen(true)}
              className="p-3.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 shadow-lg transition-all cursor-pointer"
            >
              <MessageSquare size={20} />
            </button>
            <span className="text-[10px] font-bold text-gray-600 mt-1">コメント</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${currentVideo.videoId}`);
                alert('リンクをコピーしました！');
              }}
              className="p-3.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 shadow-lg transition-all cursor-pointer"
            >
              <Share2 size={20} />
            </button>
            <span className="text-[10px] font-bold text-gray-600 mt-1">共有</span>
          </div>
        </div>

      </div>

      {/* Slide-over Comments Drawer Panel */}
      {isCommentsOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-[420px] bg-white h-full flex flex-col shadow-2xl relative animate-slide-left">
            
            {/* Drawer Header */}
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-gray-900">
                コメント {comments.length > 0 ? `(${comments.length})` : ''}
              </h2>
              <div className="flex items-center gap-3">
                <select
                  value={commentSort}
                  onChange={(e) => setCommentSort(e.target.value as 'top' | 'newest')}
                  className="text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 font-semibold text-gray-700"
                >
                  <option value="top">評価順</option>
                  <option value="newest">新しい順</option>
                </select>
                <button 
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-950 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Comments List Container */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {loadingComments ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-1.5">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold">読み込み中...</span>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-xs text-gray-500 py-12 font-medium">
                  まだコメントはありません。
                </div>
              ) : (
                comments.map((comment) => {
                  const hasReplies = comment.replies && comment.replies.length > 0;
                  const replies = comment.replies || [];
                  const repliesVisible = openRepliesMap[comment.id];

                  return (
                    <div key={comment.id} className="flex flex-col gap-1 border-b border-gray-50 pb-3">
                      <div className="flex items-start gap-2.5">
                        <Avatar
                          src={comment.authorAvatar}
                          name={comment.author}
                          channelId={comment.authorId}
                          className="w-7 h-7 text-[10px]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[11px] text-gray-900 truncate">
                              {comment.author}
                            </span>
                            <span className="text-[9px] text-gray-500">{comment.publishedTime}</span>
                          </div>
                          <p className="text-xs text-gray-800 whitespace-pre-wrap break-words mt-0.5 leading-relaxed font-normal">
                            {comment.text}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                            <button className="flex items-center gap-1 hover:text-gray-900 font-semibold cursor-pointer">
                              <ThumbsUp size={11} />
                              <span>{comment.likeCount}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Comment Replies section */}
                      {hasReplies && (
                        <div className="pl-9 mt-1">
                          <button
                            onClick={() => toggleReplies(comment.id)}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-500 cursor-pointer py-0.5"
                          >
                            <span>{repliesVisible ? '▲ 返信を隠す' : `▼ 返信 ${replies.length} 件を表示`}</span>
                          </button>

                          {repliesVisible && (
                            <div className="flex flex-col gap-3 mt-2 border-l border-gray-100 pl-3">
                              {replies.map((reply) => (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <Avatar
                                    src={reply.authorAvatar}
                                    name={reply.author}
                                    channelId={reply.authorId}
                                    className="w-5 h-5 text-[8px]"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-[10px] text-gray-900 truncate">
                                        {reply.author}
                                      </span>
                                      <span className="text-[8px] text-gray-500">{reply.publishedTime}</span>
                                    </div>
                                    <p className="text-xs text-gray-800 leading-normal whitespace-pre-wrap mt-0.5">
                                      {reply.text}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form at bottom */}
            <form onSubmit={handleAddComment} className="p-3 border-t border-gray-100 flex gap-2.5 items-center">
              <Avatar name="自分" className="w-8 h-8 text-xs border border-gray-200" />
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="コメントを追加..."
                className="flex-1 outline-none border-b border-gray-300 focus:border-gray-900 py-1 text-xs text-gray-900"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-100 disabled:text-gray-400 text-white text-[11px] font-bold rounded-full transition-colors cursor-pointer"
              >
                送信
              </button>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
