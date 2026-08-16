import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Channel, ChannelSubscription, Video, CommunityPost, ReleaseItem } from '../types';
import { 
  Loader2, Bell, AlertCircle, Play, Layers, ChevronRight, 
  Zap, Radio, Disc, MessageSquare, ThumbsUp, Check, Users
} from 'lucide-react';
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

type TabType = 'home' | 'videos' | 'shorts' | 'live' | 'releases' | 'community' | 'playlists';

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
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [videoSort, setVideoSort] = useState<'latest' | 'popular'>('latest');

  // Pagination state for Videos & Shorts
  const [videoList, setVideoList] = useState<Video[]>([]);
  const [shortList, setShortList] = useState<Video[]>([]);
  const [videoPage, setVideoPage] = useState(1);
  const [shortPage, setShortPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [hasMoreShorts, setHasMoreShorts] = useState(true);

  // Poll vote state for community tab
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchChannel = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJSON(`/api/channel/${encodeURIComponent(channelId)}`);
        setChannelData(data);
        setVideoList(data.videos || []);
        setShortList(data.shortVideos || []);
        setVideoPage(1);
        setShortPage(1);
        setHasMoreVideos(true);
        setHasMoreShorts(true);
      } catch (err: any) {
        setError(err.message || 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchChannel();
  }, [channelId]);

  // Load next page of videos or shorts
  const loadMore = useCallback(async () => {
    if (loadingMore || !channelData) return;
    const targetChannelParam = channelData.id || channelId || channelData.title;

    if (activeTab === 'videos' && hasMoreVideos) {
      setLoadingMore(true);
      try {
        const nextPage = videoPage + 1;
        const res = await fetchJSON(`/api/channel/${encodeURIComponent(targetChannelParam)}/tab/videos?page=${nextPage}`);
        if (res.videos && res.videos.length > 0) {
          setVideoList((prev) => {
            const existingIds = new Set(prev.map(v => v.videoId));
            const newItems = res.videos.filter((v: Video) => !existingIds.has(v.videoId));
            return [...prev, ...newItems];
          });
          setVideoPage(nextPage);
        } else {
          setHasMoreVideos(false);
        }
      } catch (e) {
        console.error('Failed to load more videos', e);
        setHasMoreVideos(false);
      } finally {
        setLoadingMore(false);
      }
    } else if (activeTab === 'shorts' && hasMoreShorts) {
      setLoadingMore(true);
      try {
        const nextPage = shortPage + 1;
        const res = await fetchJSON(`/api/channel/${encodeURIComponent(targetChannelParam)}/tab/shorts?page=${nextPage}`);
        if (res.videos && res.videos.length > 0) {
          setShortList((prev) => {
            const existingIds = new Set(prev.map(v => v.videoId));
            const newItems = res.videos.filter((v: Video) => !existingIds.has(v.videoId));
            return [...prev, ...newItems];
          });
          setShortPage(nextPage);
        } else {
          setHasMoreShorts(false);
        }
      } catch (e) {
        console.error('Failed to load more shorts', e);
        setHasMoreShorts(false);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [activeTab, loadingMore, channelData, videoPage, shortPage, hasMoreVideos, hasMoreShorts, channelId]);

  // Infinite scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      if (activeTab !== 'videos' && activeTab !== 'shorts') return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.offsetHeight - 400;

      if (scrollPosition >= threshold) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab, loadMore]);

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

  const tabs: { id: TabType; label: string; icon?: React.ReactNode }[] = [
    { id: 'home', label: 'ホーム' },
    { id: 'videos', label: '動画' },
    { id: 'shorts', label: 'ショート', icon: <Zap size={14} className="text-red-500 fill-red-500" /> },
    { id: 'live', label: 'ライブ配信', icon: <Radio size={14} className="text-red-500" /> },
    { id: 'releases', label: 'リリース', icon: <Disc size={14} /> },
    { id: 'community', label: 'コミュニティ', icon: <MessageSquare size={14} /> },
    { id: 'playlists', label: '再生リスト', icon: <Layers size={14} /> }
  ];

  const handleVote = (pollId: string, optionIndex: number) => {
    setVotedPolls(prev => ({ ...prev, [pollId]: optionIndex }));
  };

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
              <span>{channelData.videosCountText || `${videoList.length} 本の動画`}</span>
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

      {/* 3. タブナビゲーション */}
      <div className="px-4 md:px-12 border-b border-gray-200 bg-white sticky top-14 z-20">
        <div className="flex items-center gap-6 md:gap-8 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3.5 text-sm sm:text-base font-bold relative transition-colors duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                  isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
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
            {/* フィーチャード動画 */}
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

            {/* おすすめ動画グリッド（チャンネル一覧内はチャンネル名非表示） */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">おすすめ動画</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {videoList.slice(0, 8).map((video) => (
                  <VideoCard
                    key={video.videoId}
                    video={video}
                    onClick={() => onVideoSelect(video.videoId)}
                    onSelectChannel={onSelectChannel}
                    hideChannelInfo={true}
                  />
                ))}
              </div>
            </div>

            {/* ショート動画ピックアップ */}
            {shortList.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={20} className="text-red-600 fill-red-600" />
                  <h2 className="text-lg font-bold text-gray-900">ショート動画</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {shortList.slice(0, 6).map((short) => (
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
                {videoList.length} 本の動画
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
              {getSortedVideos(videoList).map((video) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  onClick={() => onVideoSelect(video.videoId)}
                  onSelectChannel={onSelectChannel}
                  hideChannelInfo={true}
                />
              ))}
            </div>

            {/* スクロール時の2ページ目読み込みインジケーター */}
            {loadingMore && (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-600">
                <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                <span className="text-xs font-bold">次の動画を読み込んでいます...</span>
              </div>
            )}

            {!loadingMore && hasMoreVideos && (
              <div className="text-center pt-8">
                <button
                  onClick={loadMore}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-full transition-colors border border-gray-200"
                >
                  もっと動画を読み込む
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= タブ: ショート ================= */}
        {activeTab === 'shorts' && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {shortList.map((short) => (
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

            {loadingMore && (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-600">
                <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                <span className="text-xs font-bold">次のショートを読み込んでいます...</span>
              </div>
            )}

            {!loadingMore && hasMoreShorts && (
              <div className="text-center pt-8">
                <button
                  onClick={loadMore}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-full transition-colors border border-gray-200"
                >
                  もっとショートを読み込む
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= タブ: ライブ配信 ================= */}
        {activeTab === 'live' && (
          <div>
            {(channelData.liveVideos && channelData.liveVideos.length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {channelData.liveVideos.map((live) => (
                  <div 
                    key={live.videoId} 
                    onClick={() => onVideoSelect(live.videoId)}
                    className="group cursor-pointer flex flex-col gap-2"
                  >
                    <div className="aspect-video rounded-xl overflow-hidden bg-black relative border border-gray-200 shadow-2xs">
                      <img
                        src={live.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${live.videoId}/hqdefault.jpg`}
                        alt={live.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {live.isLive ? (
                        <>
                          <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs animate-pulse">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            <span>LIVE</span>
                          </div>
                          {live.liveViewerCount && live.liveViewerCount > 0 ? (
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1">
                              <Users size={11} />
                              <span>{formatNumberJP(live.liveViewerCount)}人 視聴中</span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1">
                          <span>{live.lengthSeconds > 0 ? formatDuration(live.lengthSeconds) : 'アーカイブ'}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                        {live.title}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {live.isLive ? '配信中' : (live.publishedText ? `${live.publishedText} • ライブ配信アーカイブ` : 'ライブ配信アーカイブ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-gray-500 flex flex-col items-center gap-2">
                <Radio className="w-10 h-10 text-gray-400" />
                <p className="text-sm font-medium">現在配信中のライブまたはアーカイブはありません</p>
              </div>
            )}
          </div>
        )}

        {/* ================= タブ: リリース ================= */}
        {activeTab === 'releases' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {(channelData.releases || []).map((rel) => (
                <div key={rel.id} className="group cursor-pointer flex flex-col gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-200/80 hover:border-gray-300 transition-all">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-200 relative shadow-2xs">
                    <img
                      src={rel.thumbnail}
                      alt={rel.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      {rel.type}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                      {rel.title}
                    </h4>
                    <span className="text-xs text-gray-500">{rel.releaseDate} • {rel.trackCount}曲</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= タブ: コミュニティ ================= */}
        {activeTab === 'community' && (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            {(channelData.communityPosts || []).map((post: CommunityPost) => {
              const selectedOption = votedPolls[post.id];
              return (
                <div key={post.id} className="p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-4">
                  {/* 投稿者ヘッダー */}
                  <div className="flex items-center gap-3">
                    <Avatar src={post.authorAvatar || channelData.avatar} name={post.author} className="w-10 h-10 text-sm" />
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-gray-900">{post.author}</span>
                      <span className="text-xs text-gray-500">{post.publishedTime}</span>
                    </div>
                  </div>

                  {/* 投稿本文 */}
                  <p className="text-sm text-gray-800 font-normal leading-relaxed whitespace-pre-wrap">
                    {post.text}
                  </p>

                  {/* アンケート */}
                  {post.votePoll && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 flex flex-col gap-2.5">
                      <p className="font-bold text-xs text-gray-800">{post.votePoll.question}</p>
                      <div className="flex flex-col gap-2">
                        {post.votePoll.options.map((opt, idx) => {
                          const isSelected = selectedOption === idx;
                          const isVoted = selectedOption !== undefined;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleVote(post.id, idx)}
                              className={`relative overflow-hidden w-full text-left p-3 rounded-xl text-xs font-semibold border transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                              }`}
                            >
                              {isVoted && (
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-blue-100/60 -z-0 transition-all duration-500"
                                  style={{ width: `${opt.votesPercent}%` }}
                                />
                              )}
                              <div className="relative z-10 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  {isSelected && <Check size={14} className="text-blue-600 font-bold" />}
                                  {opt.text}
                                </span>
                                {isVoted && (
                                  <span className="font-bold text-gray-700">{opt.votesPercent}%</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[11px] text-gray-500">{post.votePoll.totalVotes.toLocaleString()} 票</span>
                    </div>
                  )}

                  {/* フッター */}
                  <div className="flex items-center gap-6 pt-2 border-t border-gray-100 text-xs text-gray-500">
                    <button className="flex items-center gap-1.5 hover:text-gray-900 font-bold">
                      <ThumbsUp size={15} />
                      <span>{formatNumberJP(post.likeCount)}</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-gray-900 font-bold">
                      <MessageSquare size={15} />
                      <span>{formatNumberJP(post.commentCount)}</span>
                    </button>
                  </div>
                </div>
              );
            })}
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
