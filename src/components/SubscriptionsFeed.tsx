import React, { useEffect, useState } from 'react';
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
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const channelTitles = subscriptions.map(s => s.title).join(',');
        const data = await fetchJSON(`/api/subscriptions/feed?channels=${encodeURIComponent(channelTitles)}`);
        setFeedVideos(data);
      } catch (err) {
        console.error('Failed to fetch subscriptions feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [subscriptions]);

  const filteredVideos = selectedChannelId === 'all'
    ? feedVideos
    : feedVideos.filter(v => {
        const sub = subscriptions.find(s => s.id === selectedChannelId);
        return sub ? v.author.toLowerCase().includes(sub.title.toLowerCase()) : true;
      });

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
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-sm font-medium">指定したチャンネルの最新動画が見つかりませんでした。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
          {filteredVideos.map((video) => (
            <div key={video.videoId} className="relative group">
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
      )}
    </div>
  );
}
