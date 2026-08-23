import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ChannelSubscription, Video } from '../types';
import VideoCard from './VideoCard';
import Avatar from './Avatar';
import { Loader2, BellRing, Sparkles, Check } from 'lucide-react';
import { fetchJSON } from '../utils';

interface SubscriptionsFeedProps {
  subscriptions: ChannelSubscription[];
  onVideoSelect: (videoId: string, videoObj?: Video) => void;
  onSelectChannel: (channelIdOrName: string) => void;
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onOpenAddToPlaylist?: (video: Video) => void;
}

export default function SubscriptionsFeed({
  subscriptions,
  onVideoSelect,
  onSelectChannel,
  onToggleSubscribe,
  onOpenAddToPlaylist
}: SubscriptionsFeedProps) {
  const [feedVideos, setFeedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const isFetchingMore = useRef(false);

  const getTargetChannelTitle = useCallback(() => {
    if (selectedChannelId === 'all') return 'all';
    const sub = subscriptions.find(s => s.id === selectedChannelId);
    return sub ? sub.title : selectedChannelId;
  }, [selectedChannelId, subscriptions]);

  const fetchFeed = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const channelTitles = subscriptions.map(s => s.title).join(',');
      const selectedTitle = getTargetChannelTitle();
      const url = `/api/subscriptions/feed?channels=${encodeURIComponent(channelTitles)}&selectedChannel=${encodeURIComponent(selectedTitle)}&page=${pageNum}`;
      const data: Video[] = await fetchJSON(url);

      if (append) {
        setFeedVideos(prev => {
          const existingIds = new Set(prev.map(v => v.videoId));
          const newVideos = (data || []).filter(v => v && v.videoId && !existingIds.has(v.videoId));
          return [...prev, ...newVideos];
        });
      } else {
        setFeedVideos(data || []);
      }

      setHasMore((data || []).length > 0);
    } catch (err) {
      console.error('Failed to fetch subscriptions feed:', err);
      if (!append) setFeedVideos([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingMore.current = false;
    }
  }, [subscriptions, getTargetChannelTitle]);

  // Selected channel / subscriptions change -> reload page 1
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setPage(1);
    setHasMore(true);
    fetchFeed(1, false);
  }, [selectedChannelId, subscriptions, fetchFeed]);

  // Load next page
  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || isFetchingMore.current) return;
    isFetchingMore.current = true;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeed(nextPage, true);
  }, [loading, loadingMore, hasMore, page, fetchFeed]);

  // Scroll listener for infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore || !hasMore || isFetchingMore.current) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.offsetHeight - 600;

      if (scrollPosition >= threshold) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, loadMore]);

  if (subscriptions.length === 0) {
    return (
      <div className="flex-1 max-w-5xl mx-auto px-4 py-24 flex flex-col items-center justify-center text-center select-none">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 border border-red-100">
          <BellRing size={32} />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">登録チャンネルがありません</h2>
        <p className="text-sm text-gray-600 max-w-md mb-8 leading-relaxed">
          お気に入りのチャンネルを登録すると、新しい動画を最新順でここでチェックできます。
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-[1800px] w-full mx-auto p-4 md:p-8 bg-white min-h-screen select-none">
      {/* 登録チャンネル ヘッダー ＆ チャンネルチップフィルター */}
      <div className="mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <BellRing size={22} className="text-red-600" />
            <span>登録チャンネルの最新動画</span>
          </h1>
          <span className="text-xs font-semibold text-gray-500">{subscriptions.length} チャンネル登録中</span>
        </div>

        {/* 横スクロール可能な登録チャンネルリスト */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          <button
            onClick={() => setSelectedChannelId('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              selectedChannelId === 'all'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すべての登録チャンネル
          </button>

          {subscriptions.map((sub) => {
            const isSelected = selectedChannelId === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedChannelId(sub.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 border ${
                  isSelected
                    ? 'bg-black text-white border-black shadow-2xs'
                    : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Avatar src={sub.avatar} name={sub.title} className="w-6 h-6 text-[10px]" />
                <span>{sub.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 最新動画グリッド */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
          <span className="text-sm font-medium text-gray-600">最新動画をロード中...</span>
        </div>
      ) : feedVideos.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-sm font-medium">指定したチャンネルの最新動画が見つかりませんでした。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
            {feedVideos.map((video, idx) => (
              <div key={`${video.videoId}-${idx}`} className="relative group">
                <VideoCard
                  video={video}
                  onClick={() => onVideoSelect(video.videoId, video)}
                  onSelectChannel={onSelectChannel}
                />
                {onOpenAddToPlaylist && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAddToPlaylist(video);
                    }}
                    className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-bold flex items-center gap-1 shadow-md"
                    title="プレイリストに追加"
                  >
                    + 保存
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 無限スクロールローディングスピナー */}
          {loadingMore && (
            <div className="flex items-center justify-center py-10 gap-3 text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              <span className="text-xs font-bold">次の動画を読み込んでいます...</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
