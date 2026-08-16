import React, { useEffect, useState } from 'react';
import { Channel, ChannelSubscription, Video } from '../types';
import { Loader2, Bell, AlertCircle, Play, Layers, Search, ChevronRight, Zap } from 'lucide-react';
import VideoCard from './VideoCard';
import Avatar from './Avatar';
import { formatNumberJP, formatDuration, fetchJSON } from '../utils';

interface ChannelPageProps {
  channelId: string;
  onVideoSelect: (videoId: string) => void;
  subscriptions: ChannelSubscription[];
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onSelectChannel: (channelIdOrName: string) => void;
}

export default function ChannelPage({
  channelId,
  onVideoSelect,
  subscriptions,
  onToggleSubscribe,
  onSelectChannel
}: ChannelPageProps) {
  const [channelData, setChannelData] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'videos' | 'shorts' | 'playlists'>('home');
  const [videoSort, setVideoSort] = useState<'latest' | 'popular'>('latest');

  useEffect(() => {
    const fetchChannel = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJSON(`/api/channel/${encodeURIComponent(channelId)}`);
        setChannelData(data);
      } catch (err: any) {
        setError(err.message || 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchChannel();
  }, [channelId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3 bg-white text-gray-900">
        <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
        <span className="text-sm font-medium text-gray-600">チャンネル情報を読み込み中...</span>
      </div>
    );
  }

  if (error || !channelData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white text-gray-900">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 mb-1">チャンネルが見つかりませんでした</h3>
        <p className="text-sm text-gray-600 max-w-md mb-4">{error || '指定されたチャンネルの読み込みに失敗しました。'}</p>
      </div>
    );
  }

  const isSubscribed = subscriptions.some(s => s.id === channelData.id || s.title === channelData.title);

  const handleSubClick = () => {
    onToggleSubscribe({
      id: channelData.id,
      title: channelData.title,
      avatar: channelData.avatar
    });
  };

  const getSortedVideos = (vList: Video[]) => {
    if (videoSort === 'popular') {
      return [...vList].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }
    return vList;
  };

  const tabs = [
    { id: 'home', label: 'ホーム' },
    { id: 'videos', label: '動画' },
    { id: 'shorts', label: 'ショート' },
    { id: 'playlists', label: '再生リスト' }
  ];

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto pb-16 bg-white text-gray-900 min-h-[calc(100vh-3.5rem)] select-none">
      {/* 1. チャンネルバナー */}
      {channelData.banner ? (
        <div className="w-full h-32 sm:h-48 md:h-60 overflow-hidden bg-gray-100 relative">
          <img
            src={channelData.banner}
            alt={`${channelData.title} Banner`}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-28 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-300 border-b border-gray-200"></div>
      )}

      {/* 2. チャンネル情報ヘッダー */}
      <div className="px-4 md:px-12 py-6 border-b border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Avatar
            src={channelData.avatar}
            name={channelData.title}
            className="w-20 h-20 sm:w-28 sm:h-28 text-3xl shadow-md ring-2 ring-gray-100 shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight truncate">
                {channelData.title}
              </h1>
              <span className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</span>
            </div>
            
            <p className="text-xs sm:text-sm text-gray-600 font-normal mb-2 flex items-center gap-2">
              <span className="font-semibold text-gray-800">@{channelData.title.replace(/\s+/g, '').toLowerCase()}</span>
              <span>•</span>
              <span>{channelData.subCountText || '登録者数 非公開'}</span>
              <span>•</span>
              <span>{channelData.videosCountText || `${channelData.videos.length} 本の動画`}</span>
            </p>

            {channelData.description && (
              <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 max-w-3xl leading-relaxed mb-4">
                {channelData.description}
              </p>
            )}

            <button
              onClick={handleSubClick}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-2xs ${
                isSubscribed
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                  : 'bg-black hover:bg-gray-800 text-white active:scale-95'
              }`}
            >
              {isSubscribed ? (
                <>
                  <Bell size={16} />
                  <span>登録済み</span>
                </>
              ) : (
                <span>チャンネル登録</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. タブナビゲーション (ホーム, 動画, ショート, 再生リスト) */}
      <div className="px-4 md:px-12 border-b border-gray-200 bg-white sticky top-14 z-20">
        <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 text-sm sm:text-base font-bold relative transition-colors duration-200 whitespace-nowrap ${
                  isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
                {/* アクティブ表示のスムーズな下線インジケーター */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-full transition-all duration-300 animate-in fade-in"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. タブ別コンテンツ表示 */}
      <div className="px-4 md:px-12 pt-8">
        {/* ================= タブ: ホーム ================= */}
        {activeTab === 'home' && (
          <div className="flex flex-col gap-10">
            {/* 1. フィーチャード動画 (YouTube公式風大カード) */}
            {channelData.featuredVideo && (
              <div className="flex flex-col md:flex-row gap-6 p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200/80 hover:border-gray-300 transition-all duration-300">
                <div 
                  onClick={() => onVideoSelect(channelData.featuredVideo!.videoId)}
                  className="w-full md:w-[480px] aspect-video rounded-xl overflow-hidden bg-black relative group cursor-pointer shrink-0 shadow-sm"
                >
                  <img
                    src={channelData.featuredVideo.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${channelData.featuredVideo.videoId}/hqdefault.jpg`}
                    alt={channelData.featuredVideo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded font-medium">
                    {formatDuration(channelData.featuredVideo.lengthSeconds)}
                  </div>
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                      <Play size={20} className="fill-black ml-1 text-black" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <h3 
                    onClick={() => onVideoSelect(channelData.featuredVideo!.videoId)}
                    className="text-lg sm:text-xl font-bold text-gray-900 leading-snug line-clamp-2 hover:text-blue-600 cursor-pointer transition-colors mb-2"
                  >
                    {channelData.featuredVideo.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 mb-3">
                    {formatNumberJP(channelData.featuredVideo.viewCount)}回視聴 • {channelData.featuredVideo.publishedText}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 line-clamp-3 leading-relaxed mb-4">
                    {channelData.description || '最新の動画をチェックしてみてください！'}
                  </p>
                  <button
                    onClick={() => onVideoSelect(channelData.featuredVideo!.videoId)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline max-w-max"
                  >
                    <span>動画を視聴する</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* 2. おすすめ動画グリッド */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">おすすめ</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {channelData.videos.slice(0, 8).map((video) => (
                  <VideoCard
                    key={video.videoId}
                    video={video}
                    onClick={() => onVideoSelect(video.videoId)}
                    onSelectChannel={onSelectChannel}
                  />
                ))}
              </div>
            </div>

            {/* 3. ショート動画ピックアップ */}
            {channelData.shortVideos && channelData.shortVideos.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={20} className="text-red-600 fill-red-600" />
                  <h2 className="text-lg font-bold text-gray-900">ショート</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {channelData.shortVideos.slice(0, 6).map((short) => (
                    <div
                      key={short.videoId}
                      onClick={() => onVideoSelect(short.videoId)}
                      className="group cursor-pointer flex flex-col gap-2"
                    >
                      <div className="aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 relative shadow-2xs border border-gray-200">
                        <img
                          src={short.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`}
                          alt={short.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent text-white">
                          <p className="text-xs font-bold line-clamp-2 leading-snug">{short.title}</p>
                          <span className="text-[10px] text-gray-300 mt-1 block">
                            {formatNumberJP(short.viewCount || 100000)}回視聴
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= タブ: 動画 ================= */}
        {activeTab === 'videos' && (
          <div>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVideoSort('latest')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    videoSort === 'latest' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  最新順
                </button>
                <button
                  onClick={() => setVideoSort('popular')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    videoSort === 'popular' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  人気の動画
                </button>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {channelData.videos.length} 本の動画
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
              {getSortedVideos(channelData.videos).map((video) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  onClick={() => onVideoSelect(video.videoId)}
                  onSelectChannel={onSelectChannel}
                />
              ))}
            </div>
          </div>
        )}

        {/* ================= タブ: ショート ================= */}
        {activeTab === 'shorts' && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {(channelData.shortVideos || channelData.videos.slice(0, 6)).map((short) => (
                <div
                  key={short.videoId}
                  onClick={() => onVideoSelect(short.videoId)}
                  className="group cursor-pointer flex flex-col gap-2"
                >
                  <div className="aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 relative shadow-2xs border border-gray-200">
                    <img
                      src={short.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`}
                      alt={short.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                      <p className="text-xs font-bold line-clamp-2 leading-snug">{short.title}</p>
                      <span className="text-[10px] text-gray-300 mt-1 block">
                        {formatNumberJP(short.viewCount || 500000)}回視聴
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= タブ: 再生リスト ================= */}
        {activeTab === 'playlists' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(channelData.playlists || []).map((pl) => (
              <div key={pl.id} className="group cursor-pointer flex flex-col gap-2">
                <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 relative border border-gray-200 shadow-2xs">
                  <img
                    src={pl.thumbnail}
                    alt={pl.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1">
                    <Layers size={22} />
                    <span className="text-xs font-bold">{pl.videoCount}本</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                    {pl.title}
                  </h4>
                  <span className="text-xs text-gray-500">{pl.updatedAt || '再生リスト'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
