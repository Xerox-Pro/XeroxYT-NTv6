import {sortSubscriptions} from '../lib/subscriptionOrder.mjs';
import {fetchSubscriptionPage} from '../lib/subscriptionFeed.mjs';
import VideoThumbnail from './VideoThumbnail';
import VideoSkeleton from './VideoSkeleton';
import CompactError from './CompactError';
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
  const [typeFilter,setTypeFilter] = useState('すべて');
  const [manage,setManage] = useState(false);
  const [error,setError] = useState('');
  const isFetchingMore = useRef(false);

  const requestVersion = useRef(0);

  const fetchFeed = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    const version = append ? requestVersion.current : ++requestVersion.current;
    setError('');
    try {
      const result = await fetchSubscriptionPage(subscriptions, selectedChannelId, pageNum, fetchJSON);
      if (version !== requestVersion.current) return;
      const data: Video[] = result.videos;

      if (append) {
        setFeedVideos(prev => {
          const existingIds = new Set(prev.map(v => v.videoId));
          const newVideos = (data || []).filter(v => v && v.videoId && !existingIds.has(v.videoId));
          return sortSubscriptions([...prev, ...newVideos]);
        });
      } else {
        setFeedVideos(data || []);
      }

      setHasMore(result.hasMore);
    } catch (err) {
      if (version !== requestVersion.current) return;
      console.error('Failed to fetch subscriptions feed:', err);
      setError(err instanceof Error ? err.message : '読み込めませんでした。');
      if (!append) setFeedVideos([]);
    } finally {
      if (version !== requestVersion.current) return;
      setLoading(false);
      setLoadingMore(false);
      isFetchingMore.current = false;
    }
  }, [subscriptions, selectedChannelId]);

  // Selected channel / subscriptions change -> reload page 1
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setPage(1);
    setHasMore(true);
    fetchFeed(1, false);
    return () => { requestVersion.current++; };
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

  const shortVideos=feedVideos.filter(v=>v.isShort || String(v.type)==='short');
  const visibleVideos=feedVideos.filter(v=>{const short=v.isShort || String(v.type)==='short';if(typeFilter==='ショート')return short;if(typeFilter==='ライブ')return v.isLive;if(typeFilter==='今日'){const text=v.publishedText||'';return /今日|秒前|分前|時間前|second|minute|hour|today/i.test(text)||new Date(text).toDateString()===new Date().toDateString();}return !short;});
  return (
    <div className="subscription-feed flex-1 max-w-[1800px] w-full mx-auto p-4 md:p-8 bg-white min-h-screen select-none">
      <div className="subscription-header">
        <div className="subscription-channels">
          <div className="subscription-channel-scroll no-scrollbar">
            {subscriptions.map(sub=><button type="button" key={sub.id} className={`subscription-avatar ${selectedChannelId===sub.id?'selected':''}`} onClick={()=>setSelectedChannelId(sub.id)} aria-pressed={selectedChannelId===sub.id}><Avatar src={sub.avatar} name={sub.title} channelId={sub.id} className="w-16 h-16 text-xl"/><span>{sub.title}</span></button>)}
          </div>
          <button type="button" className="subscription-all" onClick={()=>{setSelectedChannelId('all');setManage(true);}}>すべて</button>
        </div>
        {selectedChannelId!=='all'&&<button type="button" className="subscription-reset" onClick={()=>setSelectedChannelId('all')}>すべてのチャンネルに戻る</button>}
        <div className="subscription-filter-scroll no-scrollbar" aria-label="登録チャンネルの表示フィルター">{['すべて','今日','動画','ショート','ライブ'].map(type=><button type="button" key={type} aria-pressed={typeFilter===type} onClick={()=>setTypeFilter(type)}>{type}</button>)}</div>
      </div>
      {manage&&<div className="subscription-manage-backdrop" onClick={()=>setManage(false)}><section role="dialog" aria-modal="true" aria-label="登録チャンネルの一覧" onClick={e=>e.stopPropagation()}><header><strong>登録チャンネル</strong><button type="button" onClick={()=>setManage(false)}>閉じる</button></header>{subscriptions.map(sub=><div key={sub.id}><button type="button" onClick={()=>{setManage(false);onSelectChannel(sub.id);}}><Avatar src={sub.avatar} name={sub.title} channelId={sub.id} className="w-10 h-10 text-sm"/><span>{sub.title}</span></button><button type="button" onClick={()=>onToggleSubscribe(sub)}>登録解除</button></div>)}</section></div>}

      {/* 最新動画グリッド */}
      {loading ? (
        <VideoSkeleton gridClassName="subscription-video-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8"/>
      ) : error ? (<CompactError error={error} onRetry={()=>fetchFeed(1,false)}/>) : visibleVideos.length === 0 && !(typeFilter==='すべて'&&shortVideos.length) ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-sm font-medium">この条件で表示できる動画がありません。</p>{hasMore&&<button type="button" className="mt-4 text-blue-600" onClick={loadMore}>続きを確認</button>}
        </div>
      ) : (
        <>
          {typeFilter==='すべて'&&shortVideos.length>0&&<section className="subscription-shorts"><h2>ショート</h2><div className="shorts-shelf-scroll">{shortVideos.map(video=><button type="button" key={video.videoId} className="shorts-cover" onClick={()=>onVideoSelect(video.videoId,video)}><div className="aspect-[9/16] rounded-xl overflow-hidden relative"><VideoThumbnail videoId={video.videoId} fallback={video.videoThumbnails?.[0]?.url} sizes="220px"/><span>{video.title}</span></div></button>)}</div></section>}
          <div className="subscription-video-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
            {visibleVideos.map((video, idx) => (
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
