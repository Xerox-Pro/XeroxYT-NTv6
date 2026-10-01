import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Share2,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  X,
  Music,
  Check,
  Loader2,
  CornerDownRight,
  MoreVertical,
} from 'lucide-react';
import { Video, Comment, CommentReply, ShortVideo, ChannelSubscription } from '../types';
import { formatNumberJP, fetchJSON } from '../utils';
import Avatar from './Avatar';

interface ShortsPageProps {
  subscriptions: ChannelSubscription[];
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onRecordHistory?: (video: Video) => void;
  onSelectChannel?: (channelIdOrName: string) => void;
}

export default function ShortsPage({
  subscriptions,
  onToggleSubscribe,
  onRecordHistory,
  onSelectChannel,
}: ShortsPageProps) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isFromChannel = searchParams.get('from') === 'channel';
  const channelIdParam = searchParams.get('channelId');

  // ショートのキュー
  const [shortsQueue, setShortsQueue] = useState<ShortVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentShort, setCurrentShort] = useState<ShortVideo | null>(null);
  const [loading, setLoading] = useState(true);

  // プレイヤー状態
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeCountDelta, setLikeCountDelta] = useState(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // コメントパネル
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [repliesData, setRepliesData] = useState<Record<string, CommentReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});

  // スクロール／スワイプ用制御
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const fetchingMoreRef = useRef(false);

  // 1. 初期ロード：チャンネルからかおすすめからかを判定してショートリストを構築
  useEffect(() => {
    let isMounted = true;

    const initShorts = async () => {
      setLoading(true);

      // チャンネルページのショートから来た場合
      if (isFromChannel) {
        try {
          const savedData = sessionStorage.getItem('xerox_channel_shorts');
          if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.shorts && Array.isArray(parsed.shorts) && parsed.shorts.length > 0) {
              const list: ShortVideo[] = parsed.shorts;
              setShortsQueue(list);

              // 指定IDまたは保存されたインデックスを探す
              let targetIdx = 0;
              if (id) {
                const foundIdx = list.findIndex((s) => s.videoId === id);
                if (foundIdx !== -1) targetIdx = foundIdx;
              } else if (typeof parsed.currentIndex === 'number') {
                targetIdx = parsed.currentIndex;
              }

              setCurrentIndex(targetIdx);
              setCurrentShort(list[targetIdx]);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Failed to parse channel shorts session', e);
        }
      }

      // 通常のおすすめショート取得
      try {
        // 過去の視聴履歴IDを取得
        let historyIds: string[] = [];
        try {
          const savedHist = localStorage.getItem('xerox_watch_history');
          if (savedHist) {
            const histList = JSON.parse(savedHist);
            if (Array.isArray(histList)) {
              historyIds = histList.slice(0, 5).map((h: any) => h.videoId).filter(Boolean);
            }
          }
        } catch {}

        const queryVideoId = id || '';
        const res = await fetchJSON(
          `/api/shorts/recommendations?videoId=${encodeURIComponent(queryVideoId)}&historyIds=${encodeURIComponent(historyIds.join(','))}`
        );

        if (isMounted) {
          let list: ShortVideo[] = [];
          if (res?.shorts && Array.isArray(res.shorts)) {
            list = res.shorts;
          }

          // もし指定IDがありリスト先頭になければ、先頭に個別取得して追加
          if (id) {
            const existsIdx = list.findIndex((s) => s.videoId === id);
            if (existsIdx === -1) {
              try {
                const singleRes = await fetchJSON(`/api/shorts/${encodeURIComponent(id)}`);
                if (singleRes && singleRes.videoId) {
                  list = [singleRes, ...list];
                }
              } catch {}
            } else if (existsIdx > 0) {
              // 指定IDを先頭または対象インデックスにする
              const [target] = list.splice(existsIdx, 1);
              list.unshift(target);
            }
          }

          if (list.length === 0 && id) {
            list = [
              {
                videoId: id,
                title: 'ショート動画',
                author: 'チャンネル',
                authorAvatar: '',
                viewCount: 0,
              },
            ];
          }

          setShortsQueue(list);
          setCurrentIndex(0);
          setCurrentShort(list[0] || null);

          // URLが単なる /shorts の場合は先頭IDを反映
          if (!id && list[0]?.videoId) {
            navigate(`/shorts/${list[0].videoId}`, { replace: true });
          }
        }
      } catch (err) {
        console.error('Failed to load shorts recs', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initShorts();

    return () => {
      isMounted = false;
    };
  }, [id, isFromChannel]);

  // 現在のショートが変わった時の処理（履歴追加・タイトル更新・状態リセット）
  useEffect(() => {
    if (!currentShort?.videoId) return;

    // タイトル反映
    document.title = `${currentShort.title || 'ショート'} - XeroxYT-NTv6`;

    // 視聴履歴に登録
    if (onRecordHistory) {
      onRecordHistory({
        videoId: currentShort.videoId,
        title: currentShort.title,
        author: currentShort.author,
        authorId: currentShort.authorId,
        authorAvatar: currentShort.authorAvatar,
        publishedText: 'ショート',
        viewCount: currentShort.viewCount || 0,
        lengthSeconds: 30,
        videoThumbnails: [
          { url: `https://i.ytimg.com/vi/${currentShort.videoId}/hqdefault.jpg` },
        ],
        type: 'video',
      });
    }

    // 状態リセット
    setIsLiked(false);
    setIsDisliked(false);
    setLikeCountDelta(0);
    setIsDescExpanded(false);
    setExpandedReplies({});
    setRepliesData({});

    // コメントが展開されていれば再取得
    if (isCommentsOpen) {
      fetchComments(currentShort.videoId);
    }
  }, [currentShort?.videoId]);

  // コメント取得関数
  const fetchComments = async (videoId: string) => {
    setLoadingComments(true);
    try {
      const res = await fetchJSON(`/api/video/${encodeURIComponent(videoId)}/comments?sort=top&page=1`);
      const items = Array.isArray(res) ? res : res.comments || [];
      setComments(items);
    } catch (e) {
      console.warn('Failed to fetch shorts comments', e);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  // コメントパネル開閉
  const toggleComments = () => {
    if (!isCommentsOpen && currentShort?.videoId) {
      fetchComments(currentShort.videoId);
    }
    setIsCommentsOpen(!isCommentsOpen);
  };

  // 返信の展開・取得
  const toggleRepliesForComment = async (commentId: string) => {
    const isCurrentlyExpanded = !!expandedReplies[commentId];
    if (isCurrentlyExpanded) {
      setExpandedReplies((prev) => ({ ...prev, [commentId]: false }));
      return;
    }

    // 既にデータ取得済みなら表示をオンにするのみ
    if (repliesData[commentId]) {
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
      return;
    }

    if (!currentShort?.videoId) return;

    setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetchJSON(
        `/api/video/${encodeURIComponent(currentShort.videoId)}/comment/${encodeURIComponent(commentId)}/replies`
      );
      if (res?.replies) {
        setRepliesData((prev) => ({ ...prev, [commentId]: res.replies }));
      }
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
    } catch (e) {
      console.warn('Failed to load comment replies', e);
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  // 次のショートへ進む（チャンネルの場合：1個古い動画、おすすめの場合：次の動画）
  const goToNextShort = useCallback(async () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < shortsQueue.length) {
      setCurrentIndex(nextIdx);
      const nextShort = shortsQueue[nextIdx];
      setCurrentShort(nextShort);
      navigate(
        `/shorts/${nextShort.videoId}${isFromChannel ? `?from=channel&channelId=${channelIdParam || ''}` : ''}`,
        { replace: true }
      );
    } else if (!isFromChannel && !fetchingMoreRef.current) {
      // おすすめショートの追加読み込み
      fetchingMoreRef.current = true;
      try {
        const lastId = currentShort?.videoId || '';
        const res = await fetchJSON(`/api/shorts/recommendations?videoId=${encodeURIComponent(lastId)}&page=2`);
        if (res?.shorts && Array.isArray(res.shorts) && res.shorts.length > 0) {
          const newItems = res.shorts.filter(
            (ns: ShortVideo) => !shortsQueue.some((s) => s.videoId === ns.videoId)
          );
          if (newItems.length > 0) {
            setShortsQueue((prev) => [...prev, ...newItems]);
            setCurrentIndex(nextIdx);
            setCurrentShort(newItems[0]);
            navigate(`/shorts/${newItems[0].videoId}`, { replace: true });
          }
        }
      } catch (e) {
        console.warn('Failed to load more shorts', e);
      } finally {
        fetchingMoreRef.current = false;
      }
    }
  }, [currentIndex, shortsQueue, isFromChannel, channelIdParam, currentShort, navigate]);

  // 前のショートへ戻る（チャンネルの場合：1個最新の動画、おすすめの場合：前の動画）
  const goToPrevShort = useCallback(() => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      const prevShort = shortsQueue[prevIdx];
      setCurrentShort(prevShort);
      navigate(
        `/shorts/${prevShort.videoId}${isFromChannel ? `?from=channel&channelId=${channelIdParam || ''}` : ''}`,
        { replace: true }
      );
    }
  }, [currentIndex, shortsQueue, isFromChannel, channelIdParam, navigate]);

  // マウスホイールによるスクロール切り替え（0.4秒のスロットルで誤連打防止）
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < 450) return;

      if (e.deltaY > 35) {
        lastScrollTime.current = now;
        goToNextShort();
      } else if (e.deltaY < -35) {
        lastScrollTime.current = now;
        goToPrevShort();
      }
    },
    [goToNextShort, goToPrevShort]
  );

  // キーボード操作（矢印上下）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goToNextShort();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goToPrevShort();
      } else if (e.key === 'm') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextShort, goToPrevShort]);

  // iPad・モバイル向けタッチスワイプ操作
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    const now = Date.now();

    if (now - lastScrollTime.current < 400) return;

    if (diff > 50) {
      // 上スワイプ（次へ）
      lastScrollTime.current = now;
      goToNextShort();
    } else if (diff < -50) {
      // 下スワイプ（前へ）
      lastScrollTime.current = now;
      goToPrevShort();
    }
  };

  // 高評価ボタン
  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCountDelta(0);
    } else {
      setIsLiked(true);
      setIsDisliked(false);
      setLikeCountDelta(1);
    }
  };

  const handleDislike = () => {
    if (isDisliked) {
      setIsDisliked(false);
    } else {
      setIsDisliked(true);
      setIsLiked(false);
      setLikeCountDelta(0);
    }
  };

  // 共有機能
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentShort?.title || 'YouTube Short',
          url: url,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // チャンネル登録状態チェック
  const isSubscribed = subscriptions.some(
    (s) =>
      (currentShort?.authorId && s.id === currentShort.authorId) ||
      (currentShort?.author && s.title.toLowerCase() === currentShort.author.toLowerCase())
  );

  const handleSubscribe = () => {
    if (currentShort) {
      onToggleSubscribe({
        id: currentShort.authorId || currentShort.author,
        title: currentShort.author,
        avatar: currentShort.authorAvatar || '',
      });
    }
  };

  if (loading && !currentShort) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-3" />
        <p className="text-sm font-medium text-gray-500">ショートを読み込み中...</p>
      </div>
    );
  }

  const rawLikeCount = currentShort?.likeCount || 5200;
  const numericLikes =
    typeof rawLikeCount === 'number'
      ? rawLikeCount
      : parseInt(String(rawLikeCount).replace(/\D/g, ''), 10) || 5200;
  const displayLikes = Math.max(0, numericLikes + likeCountDelta);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex-1 flex items-center justify-center min-h-[calc(100vh-64px)] bg-[#f8fafc] py-2 sm:py-4 px-2 select-none relative overflow-hidden"
    >
      {/* チャンネルコンテキスト通知バッジ */}
      {isFromChannel && (
        <div className="absolute top-3 left-4 z-20 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-gray-700 shadow-xs border border-gray-200/80 flex items-center gap-1.5">
          <span>チャンネルショート再生中</span>
          <span className="text-[11px] text-gray-400">
            ({currentIndex + 1} / {shortsQueue.length})
          </span>
        </div>
      )}

      {/* メインレイアウト（iPad & PC: 中央配置 + コメントパネル横並び） */}
      <div className="flex items-center justify-center gap-4 max-w-full h-full">
        {/* ショートプレイヤー本体コンテナ */}
        <div className="relative flex items-end justify-center">
          {/* 9:16 ビデオプレイヤーフレーム */}
          <div className="relative w-[340px] sm:w-[380px] md:w-[410px] aspect-[9/16] max-h-[82vh] sm:max-h-[85vh] bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-200/60">
            {currentShort && (
              <iframe
                key={currentShort.videoId}
                src={`https://www.youtube-nocookie.com/embed/${currentShort.videoId}?autoplay=1&loop=1&playlist=${currentShort.videoId}&controls=0&rel=0&modestbranding=1&playsinline=1&mute=${isMuted ? 1 : 0}`}
                title={currentShort.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full object-cover pointer-events-auto"
              />
            )}

            {/* 音声ミュート切り替えボタン */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xs transition-colors"
              title={isMuted ? 'ミュート解除' : 'ミュート'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* 下部情報オーバーレイ（YouTube公式UI配置） */}
            <div className="absolute inset-x-0 bottom-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white flex flex-col gap-2 pointer-events-auto">
              {/* チャンネル情報 & チャンネル登録ボタン */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() =>
                    onSelectChannel &&
                    onSelectChannel(currentShort?.authorId || currentShort?.author || '')
                  }
                  className="shrink-0 flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <Avatar
                    src={currentShort?.authorAvatar}
                    name={currentShort?.author || 'Short'}
                    channelId={currentShort?.authorId}
                    className="w-9 h-9 text-xs ring-2 ring-white/70 shadow-sm"
                  />
                  <span className="font-bold text-sm tracking-tight truncate max-w-[160px]">
                    @{currentShort?.author || 'チャンネル'}
                  </span>
                </button>

                <button
                  onClick={handleSubscribe}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    isSubscribed
                      ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-xs'
                      : 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm'
                  }`}
                >
                  {isSubscribed ? '登録済み' : 'チャンネル登録'}
                </button>
              </div>

              {/* タイトルと説明文 */}
              <div className="text-xs sm:text-[13px] leading-relaxed">
                <p className={`font-medium ${!isDescExpanded ? 'line-clamp-2' : ''}`}>
                  {currentShort?.title}
                </p>
                {currentShort?.description && (
                  <button
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-[11px] font-bold text-gray-300 hover:text-white mt-0.5 underline cursor-pointer"
                  >
                    {isDescExpanded ? '閉じる' : '...もっと見る'}
                  </button>
                )}
              </div>

              {/* 楽曲 / 音源情報 */}
              <div className="flex items-center gap-1.5 text-[11px] text-gray-200 mt-0.5 opacity-90">
                <Music size={12} className="shrink-0 animate-pulse" />
                <span className="truncate">
                  オリジナル音源 - {currentShort?.author || 'YouTube Shorts'}
                </span>
              </div>
            </div>
          </div>

          {/* 右側アクションバー（YouTube Shorts公式アイコン列） */}
          <div className="flex flex-col items-center gap-4 ml-3 mb-4 z-20">
            {/* 高評価 */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleLike}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
                  isLiked
                    ? 'bg-blue-600 text-white scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/80'
                }`}
                title="高評価"
              >
                <ThumbsUp size={20} fill={isLiked ? 'white' : 'none'} />
              </button>
              <span className="text-[11px] font-bold text-gray-600">
                {formatNumberJP(displayLikes)}
              </span>
            </div>

            {/* 低評価 */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleDislike}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
                  isDisliked
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/80'
                }`}
                title="低評価"
              >
                <ThumbsDown size={20} fill={isDisliked ? 'white' : 'none'} />
              </button>
              <span className="text-[11px] font-bold text-gray-600">低評価</span>
            </div>

            {/* コメントボタン */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={toggleComments}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
                  isCommentsOpen
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/80'
                }`}
                title="コメント"
              >
                <MessageSquare size={20} />
              </button>
              <span className="text-[11px] font-bold text-gray-600">
                {currentShort?.commentCount
                  ? String(currentShort.commentCount)
                  : comments.length > 0
                  ? String(comments.length)
                  : 'コメント'}
              </span>
            </div>

            {/* 共有ボタン */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleShare}
                className="w-11 h-11 rounded-full bg-white hover:bg-gray-100 text-gray-700 hover:text-gray-900 border border-gray-200/80 flex items-center justify-center transition-all duration-200 shadow-md"
                title="共有"
              >
                {copied ? <Check size={20} className="text-emerald-600" /> : <Share2 size={20} />}
              </button>
              <span className="text-[11px] font-bold text-gray-600">
                {copied ? 'コピー済' : '共有'}
              </span>
            </div>

            {/* 上下ナビゲーションボタン（PC & iPad対応） */}
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-200/80">
              <button
                onClick={goToPrevShort}
                disabled={currentIndex === 0}
                className="w-9 h-9 rounded-full bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 border border-gray-200 shadow-xs flex items-center justify-center transition-all"
                title={isFromChannel ? '最新の動画へ (上)' : '前のショート'}
              >
                <ChevronUp size={18} />
              </button>
              <button
                onClick={goToNextShort}
                className="w-9 h-9 rounded-full bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-xs flex items-center justify-center transition-all"
                title={isFromChannel ? '古い動画へ (下)' : '次のショート'}
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* コメントドロワー（YouTube公式デザイン：iPad/PCでは右側にスマート展開） */}
        <AnimatePresence>
          {isCommentsOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="w-[340px] sm:w-[380px] h-[82vh] sm:h-[85vh] bg-white rounded-2xl shadow-xl border border-gray-200/90 flex flex-col overflow-hidden z-30"
            >
              {/* コメントヘッダー */}
              <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">コメント</h3>
                  <span className="text-xs font-semibold text-gray-500">
                    {comments.length > 0 ? `${comments.length}件` : ''}
                  </span>
                </div>
                <button
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* コメント一覧スクロールエリア */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {loadingComments ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">コメントを読み込み中...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-center py-12 text-gray-400">コメントはまだありません。</p>
                ) : (
                  comments.map((c) => {
                    const hasReplies = Boolean(
                      c.hasReplies ||
                        (c.replyCount && c.replyCount !== 0 && c.replyCount !== '0')
                    );
                    const repliesCount = c.replyCount || 0;
                    const isRepliesOpen = !!expandedReplies[c.id];
                    const repliesList = repliesData[c.id] || [];
                    const isLoadingReplies = !!loadingReplies[c.id];

                    return (
                      <div key={c.id} className="flex flex-col gap-1.5">
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() =>
                              onSelectChannel &&
                              onSelectChannel(c.authorId || c.author)
                            }
                            className="shrink-0"
                          >
                            <Avatar
                              src={c.authorAvatar}
                              name={c.author}
                              channelId={c.authorId}
                              className="w-7 h-7 text-[11px]"
                            />
                          </button>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900 truncate">
                                {c.author}
                              </span>
                              <span className="text-[10px] text-gray-400 shrink-0">
                                {c.publishedTime}
                              </span>
                            </div>
                            <p className="text-gray-800 text-xs leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
                              {c.text}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                              <span className="flex items-center gap-1">
                                <ThumbsUp size={12} />
                                <span>{c.likeCount}</span>
                              </span>
                              <span className="hover:text-gray-900 cursor-pointer">返信</span>
                            </div>

                            {/* 返信展開ボタン（YouTubeデザイン） */}
                            {hasReplies && (
                              <button
                                onClick={() => toggleRepliesForComment(c.id)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 px-2 py-1 rounded-full self-start mt-1.5 transition-colors"
                              >
                                {isRepliesOpen ? (
                                  <ChevronUp size={12} />
                                ) : (
                                  <ChevronDown size={12} />
                                )}
                                <span>
                                  {isRepliesOpen
                                    ? '返信を非表示'
                                    : `${repliesCount}件の返信`}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 返信一覧（インデント表示） */}
                        {isRepliesOpen && (
                          <div className="pl-9 border-l-2 border-gray-100 ml-3.5 space-y-3 mt-2">
                            {isLoadingReplies ? (
                              <div className="flex items-center gap-2 py-2 text-gray-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                <span className="text-[11px]">返信を読み込み中...</span>
                              </div>
                            ) : repliesList.length === 0 ? (
                              <span className="text-[11px] text-gray-400">返信はありません</span>
                            ) : (
                              repliesList.map((reply) => (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <Avatar
                                    src={reply.authorAvatar}
                                    name={reply.author}
                                    channelId={reply.authorId}
                                    className="w-6 h-6 text-[10px] shrink-0"
                                  />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-gray-900 truncate">
                                        {reply.author}
                                      </span>
                                      <span className="text-[10px] text-gray-400 shrink-0">
                                        {reply.publishedTime}
                                      </span>
                                    </div>
                                    <p className="text-gray-800 text-xs leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
                                      {reply.text}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <ThumbsUp size={11} />
                                        <span>{reply.likeCount}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
