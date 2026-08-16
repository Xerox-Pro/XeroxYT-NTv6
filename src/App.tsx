/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CategoryBar from './components/CategoryBar';
import VideoCard from './components/VideoCard';
import VideoPlayer from './components/VideoPlayer';
import ChannelPage from './components/ChannelPage';
import ShortsPlayer from './components/ShortsPlayer';
import SubscriptionsFeed from './components/SubscriptionsFeed';
import LibraryPage from './components/LibraryPage';
import HistoryPage from './components/HistoryPage';
import DebugAPI from './components/DebugAPI';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import { Video, ChannelSubscription, WatchHistoryItem, UserPlaylist, ShortVideo, UserInfo } from './types';
import { localAI } from './lib/intelligence';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchJSON } from './utils';

declare global {
  interface Window {
    google: any;
  }
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<'home' | 'search' | 'video' | 'channel' | 'shorts' | 'subscriptions' | 'library' | 'history' | 'debug'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<{ userCode: string, verificationUrl: string } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // Cache for static video/channel data
  const [videoCache, setVideoCache] = useState<Record<string, Video | ShortVideo>>(() => {
    try {
      const saved = localStorage.getItem('xerox_video_cache');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // AI Analysis Cache
  const [aiInterests, setAiInterests] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_ai_interests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Auth state
  const [userInfo, setUserInfo] = useState<UserInfo | null>(() => {
    try {
      const saved = localStorage.getItem('xerox_user_info');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1280);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setView('home');
      fetchRecommendations(1, false);
    } else if (path === '/results') {
      const q = searchParams.get('search_query');
      if (q) {
        setSearchQuery(q);
        setView('search');
        fetchSearch(q, 1, false);
      }
    } else if (path === '/watch') {
      const v = searchParams.get('v');
      const list = searchParams.get('list');
      if (v) {
        setCurrentVideoId(v);
        setCurrentPlaylistId(list);
        setView('video');
      }
    } else if (path.startsWith('/channel/')) {
      const channelId = path.replace('/channel/', '');
      setSelectedChannelId(channelId);
      setView('channel');
    } else if (path === '/shorts') {
      setView('shorts');
    } else if (path === '/feed/subscriptions') {
      setView('subscriptions');
    } else if (path === '/feed/library') {
      setView('library');
    } else if (path === '/feed/history') {
      setView('history');
    } else if (path === '/debug/api') {
      setView('debug');
    }
  }, [location.pathname, searchParams]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      setIsMobile(mobile);
      if (width < 1280) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 無限スクロール用ページ制御
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const isFetchingMore = useRef(false);

  // モーダル
  const [playlistModalVideo, setPlaylistModalVideo] = useState<Video | null>(null);

  // 連続再生キュー
  const [currentPlaylistQueue, setCurrentPlaylistQueue] = useState<Video[]>([]);
  const [playlistQueueIndex, setPlaylistQueueIndex] = useState<number>(-1);

  // Subscriptions state saved in LocalStorage
  const [subscriptions, setSubscriptions] = useState<ChannelSubscription[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_subscriptions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Watch history
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_watch_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // User Playlists saved in LocalStorage
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_user_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('xerox_subscriptions', JSON.stringify(subscriptions));
    } catch (e) {
      console.error(e);
    }
  }, [subscriptions]);

  useEffect(() => {
    try {
      localStorage.setItem('xerox_watch_history', JSON.stringify(watchHistory));
    } catch (e) {
      console.error(e);
    }
  }, [watchHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('xerox_user_playlists', JSON.stringify(playlists));
    } catch (e) {
      console.error(e);
    }
  }, [playlists]);

  // 閲覧履歴（通常動画）記録
  const handleRecordHistory = (video: Video) => {
    setWatchHistory(prev => {
      const filtered = prev.filter(item => item.videoId !== video.videoId);
      const newItem: WatchHistoryItem = {
        videoId: video.videoId,
        title: video.title,
        author: video.author,
        authorAvatar: video.authorAvatar,
        thumbnailUrl: video.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
        lengthSeconds: video.lengthSeconds,
        viewCount: video.viewCount,
        timestamp: Date.now(),
        type: 'video'
      };
      return [newItem, ...filtered].slice(0, 50);
    });
  };

  // 閲覧履歴（ショート動画）記録
  const handleRecordShortHistory = (short: ShortVideo) => {
    setWatchHistory(prev => {
      const filtered = prev.filter(item => item.videoId !== short.videoId);
      const newItem: WatchHistoryItem = {
        videoId: short.videoId,
        title: short.title,
        author: short.author,
        authorAvatar: short.authorAvatar,
        thumbnailUrl: `https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`,
        timestamp: Date.now(),
        type: 'short'
      };
      return [newItem, ...filtered].slice(0, 50);
    });
  };

  const handleToggleSubscribe = (channel: ChannelSubscription) => {
    setSubscriptions((prev) => {
      const exists = prev.some(s => s.id === channel.id || s.title === channel.title);
      if (exists) {
        return prev.filter(s => s.id !== channel.id && s.title !== channel.title);
      } else {
        return [...prev, channel];
      }
    });
  };

  // 閲覧履歴からキーワード抽出（登録チャンネルや高評価動画、視聴履歴を深層分析）
  const getHistoryKeywords = (): string => {
    const historyData = watchHistory.slice(0, 20);
    
    // AIの提案履歴があればそれを優先的に含める
    let baseKeywords = aiInterests.slice(0, 5).join(' ');
    
    // ローカルAIの分析結果も加味する (独自AIによる分析)
    const localKeywords = localAI.getTopSuggestedQueries(8).join(' ');
    if (localKeywords) baseKeywords += ' ' + localKeywords;

    if (historyData.length === 0 && !searchQuery && !baseKeywords && subscriptions.length === 0) return "";

    // タイトルから単語を抽出
    const words = historyData
      .map(h => h.title)
      .join(' ')
      .replace(/[【】\[\]\(\)（）!！?？、。]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !['動画', '最新', 'の', 'は', 'で', 'を', 'に', 'と', 'が', 'て', 'た', '！', '#shorts', 'shorts'].includes(w.toLowerCase()));

    // 出現頻度順にソートして上位を取得
    const counts: Record<string, number> = {};
    words.forEach(w => counts[w] = (counts[w] || 0) + 1);
    
    const sortedKeywords = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);

    // 視聴履歴のチャンネル名＋登録チャンネル名
    const historyChannels = historyData.map(h => h.author);
    const subChannels = subscriptions.map(s => s.title);
    const allChannels = Array.from(new Set([...historyChannels, ...subChannels])).slice(0, 6);

    const base = searchQuery ? [searchQuery] : [];
    const finalKeywords = Array.from(new Set([...base, ...sortedKeywords, ...allChannels])).join(' ');
    
    return finalKeywords;
  };

  // おすすめ動画データ読み込み (ページ別)

  useEffect(() => {
    if (userInfo) {
      localStorage.setItem('xerox_user_info', JSON.stringify(userInfo));
    } else {
      localStorage.removeItem('xerox_user_info');
    }
  }, [userInfo]);

  useEffect(() => {
    localStorage.setItem('xerox_video_cache', JSON.stringify(videoCache));
  }, [videoCache]);

  useEffect(() => {
    localStorage.setItem('xerox_ai_interests', JSON.stringify(aiInterests));
  }, [aiInterests]);

  const updateCache = (videos: (Video | ShortVideo)[]) => {
    setVideoCache(prev => {
      const next = { ...prev };
      let changed = false;
      videos.forEach(v => {
        if (!next[v.videoId]) {
          next[v.videoId] = v;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  };

  const isPollingRef = useRef(false);

  const handleLogin = async () => {
    try {
      const data = await fetchJSON('/api/auth/signin');
      setAuthFlow(data);
      setIsPolling(true);
      isPollingRef.current = true;
      
      // Start polling
      startPolling();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
    }
  };

  const startPolling = async () => {
    let success = false;
    while (!success && isPollingRef.current) {
      try {
        const data = await fetchJSON('/api/auth/poll');
        if (data.success) {
          setUserInfo(data.user);
          setAuthFlow(null);
          setIsPolling(false);
          isPollingRef.current = false;
          success = true;
          setView('home');
        } else if (data.status === 'pending') {
          // Still waiting for user, just continue polling
          console.log('Login pending...');
        }
      } catch (err: any) {
        console.error('Poll error:', err);
        setIsPolling(false);
        isPollingRef.current = false;
        break;
      }
      if (!success && isPollingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  };

  const handleLogout = async () => {
    try {
      await fetchJSON('/api/auth/logout', { method: 'POST' });
      setUserInfo(null);
      setSubscriptions([]);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleGoHome = useCallback(() => {
    setSelectedCategory('すべて');
    setPage(1);
    if (location.pathname !== '/') {
      navigate('/');
    } else {
      setView('home');
      fetchRecommendations(1, false);
    }
  }, [location.pathname, navigate]);

  const fetchRecommendations = async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const keywords = getHistoryKeywords();
      const historyIds = watchHistory.slice(0, 20).map(h => h.videoId).join(',');
      const refreshNonce = Date.now() + Math.floor(Math.random() * 1000000);
      let data = [];
      
      // If logged in, prioritize liked content for the first page
      if (userInfo && pageNum === 1) {
        try {
          data = await fetchJSON('/api/user/liked-videos');
          updateCache(data);
        } catch (err) {
          console.warn('Failed to fetch liked videos for recommendations', err);
        }
      }

      const result = await fetchJSON(`/api/recommendations?keywords=${encodeURIComponent(keywords)}&historyIds=${encodeURIComponent(historyIds)}&page=${pageNum}&refreshNonce=${refreshNonce}`);
      const publicData = result.videos || [];
      
      // AIの分析結果を保存
      if (result.aiKeywords && result.aiKeywords.length > 0) {
        setAiInterests(result.aiKeywords);
      }
      
      updateCache(publicData);
      
      // Combine personalized data (if any) with public recommendations
      const combinedData = [...data, ...publicData];
      
      // Remove duplicates
      const uniqueMap = new Map();
      combinedData.forEach(v => {
        if (v && v.videoId && !uniqueMap.has(v.videoId)) {
          uniqueMap.set(v.videoId, v);
        }
      });
      const finalData = Array.from(uniqueMap.values());

      if (append) {
        setVideos(prev => {
          const existingIds = new Set(prev.map(v => v.videoId));
          const newVideos = finalData.filter((v: Video) => v && v.videoId && !existingIds.has(v.videoId));
          return [...prev, ...newVideos];
        });
      } else {
        setVideos(finalData);
      }
      setHasMore(finalData.length > 0);
    } catch (err: any) {
      console.error(err);
      if (!append) setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingMore.current = false;
    }
  };

  // 検索動画データ読み込み (ページ別)
  const fetchSearch = async (q: string, pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setView('search');
    }
    setError('');

    try {
      const data = await fetchJSON(`/api/search?q=${encodeURIComponent(q)}&page=${pageNum}`);
      updateCache(data);

      if (append) {
        setVideos(prev => {
          const existingIds = new Set(prev.map(v => v.videoId));
          const newVideos = data.filter((v: Video) => !existingIds.has(v.videoId));
          return [...prev, ...newVideos];
        });
      } else {
        setVideos(data);
      }
      setHasMore(data.length > 0);
    } catch (err: any) {
      console.error(err);
      if (!append) setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingMore.current = false;
    }
  };

  useEffect(() => {
    if (view === 'home') {
      setPage(1);
      fetchRecommendations(1, false);
    }
  }, [view]);

  // 無限スクロール検知
  const handleScroll = useCallback(() => {
    if (view !== 'home' && view !== 'search') return;
    if (loading || loadingMore || !hasMore || isFetchingMore.current) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const totalHeight = document.documentElement.scrollHeight;

    // スクロール位置が下部近辺（1000px以内）に達したら次のページを事前取得
    if (scrollTop + windowHeight >= totalHeight - 1000) {
      isFetchingMore.current = true;
      const nextPage = page + 1;
      setPage(nextPage);

      if (view === 'home') {
        fetchRecommendations(nextPage, true);
      } else if (view === 'search') {
        fetchSearch(searchQuery, nextPage, true);
      }
    }
  }, [view, loading, loadingMore, hasMore, page, searchQuery]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleSearch = (q: string) => {
    navigate(`/results?search_query=${encodeURIComponent(q)}`);
  };

  const handleSelectCategory = (category: string) => {
    if (!category || category === 'すべて' || category === 'あなたへのおすすめ') {
      navigate('/');
    } else {
      navigate(`/results?search_query=${encodeURIComponent(category)}`);
    }
  };

  const handleVideoSelect = (videoId: string, videoObj?: Video) => {
    if (videoObj) {
      localAI.processVideoInteraction(videoObj, 1.0);
      updateCache([videoObj]);
    } else if (videoId && videoCache[videoId]) {
      localAI.processVideoInteraction(videoCache[videoId], 1.0);
    }
    
    const playlistId = videoObj?.playlistId || (videoId && videoCache[videoId] ? (videoCache[videoId] as Video).playlistId : null);
    navigate(`/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ''}`);
  };

  const handleSelectChannel = (channelIdOrName: string) => {
    navigate(`/channel/${channelIdOrName}`);
  };

  // プレイリスト操作関数群
  const handleCreatePlaylist = (title: string, description?: string): string => {
    const newPl: UserPlaylist = {
      id: `pl-${Date.now()}`,
      title,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      videos: []
    };
    setPlaylists(prev => [newPl, ...prev]);
    return newPl.id;
  };

  const handleDeletePlaylist = (id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const handleToggleVideoInPlaylist = (playlistId: string, video: Video) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      const exists = pl.videos.some(v => v.videoId === video.videoId);
      const updatedVideos = exists
        ? pl.videos.filter(v => v.videoId !== video.videoId)
        : [...pl.videos, video];
      return {
        ...pl,
        videos: updatedVideos,
        updatedAt: Date.now()
      };
    }));
  };

  const handleRemoveVideoFromPlaylist = (playlistId: string, videoId: string) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      return {
        ...pl,
        videos: pl.videos.filter(v => v.videoId !== videoId),
        updatedAt: Date.now()
      };
    }));
  };

  const handleReorderPlaylistVideo = (playlistId: string, fromIndex: number, toIndex: number) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      if (toIndex < 0 || toIndex >= pl.videos.length) return pl;
      const list = [...pl.videos];
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return { ...pl, videos: list, updatedAt: Date.now() };
    }));
  };

  const handleStartPlaylistPlay = (playlist: UserPlaylist, shuffle: boolean = false) => {
    let playList = [...playlist.videos];
    if (shuffle) {
      playList = playList.sort(() => Math.random() - 0.5);
    }
    if (playList.length > 0) {
      setCurrentPlaylistQueue(playList);
      setPlaylistQueueIndex(0);
      handleVideoSelect(playList[0].videoId, playList[0]);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans antialiased selection:bg-red-100 selection:text-red-800">
      {/* ナビゲーションバー */}
      <Navbar
        onSearch={handleSearch}
        onHome={handleGoHome}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        initialSearchQuery={searchQuery}
        userInfo={userInfo}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 pt-14">
        {/* サイドバー */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentView={view}
          onHome={handleGoHome}
          onShorts={() => setView('shorts')}
          onSubscriptions={() => setView('subscriptions')}
          onLibrary={() => setView('library')}
          onHistory={() => setView('history')}
          subscriptions={subscriptions}
          onSelectChannel={handleSelectChannel}
          onDebugAPI={() => navigate('/debug/api')}
        />

        {/* メインコンテンツビュー */}
        <main
          className={`flex-1 transition-all duration-200 min-w-0 ${
            isSidebarOpen ? 'md:ml-64' : (isMobile ? 'ml-0' : 'md:ml-18')
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full"
            >
              {/* カテゴリーバー（ホーム ＆ 検索画面のみ） */}
              {(view === 'home' || view === 'search') && (
                <CategoryBar
                  selectedCategory={selectedCategory}
                  onSelectCategory={handleSelectCategory}
                />
              )}

          {/* ビュー分岐 */}
          {view === 'video' && currentVideoId ? (
            <VideoPlayer
              videoId={currentVideoId}
              playlistId={currentPlaylistId || undefined}
              onVideoSelect={(id, v) => handleVideoSelect(id, v)}
              onSelectChannel={handleSelectChannel}
              subscriptions={subscriptions}
              onToggleSubscribe={handleToggleSubscribe}
              onRecordHistory={handleRecordHistory}
              onOpenAddToPlaylist={(video) => setPlaylistModalVideo(video)}
              onCacheVideo={(v) => updateCache([v])}
            />
          ) : view === 'channel' && selectedChannelId ? (
            <ChannelPage
              channelId={selectedChannelId}
              onVideoSelect={(id) => handleVideoSelect(id)}
              subscriptions={subscriptions}
              onToggleSubscribe={handleToggleSubscribe}
              onSelectChannel={handleSelectChannel}
            />
          ) : view === 'shorts' ? (
            <ShortsPlayer
              historyKeywords={getHistoryKeywords()}
              onSelectChannel={handleSelectChannel}
              subscriptions={subscriptions}
              onToggleSubscribe={handleToggleSubscribe}
              onRecordShortHistory={handleRecordShortHistory}
              onCacheShorts={(shorts) => updateCache(shorts)}
            />
          ) : view === 'subscriptions' ? (
            <SubscriptionsFeed
              subscriptions={subscriptions}
              onVideoSelect={(id, v) => handleVideoSelect(id, v)}
              onSelectChannel={handleSelectChannel}
              onToggleSubscribe={handleToggleSubscribe}
              onOpenAddToPlaylist={(v) => setPlaylistModalVideo(v)}
            />
          ) : view === 'library' ? (
            <LibraryPage
              playlists={playlists}
              history={watchHistory}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onRemoveVideoFromPlaylist={handleRemoveVideoFromPlaylist}
              onReorderPlaylistVideo={handleReorderPlaylistVideo}
              onStartPlaylistPlay={handleStartPlaylistPlay}
              onVideoSelect={(id) => handleVideoSelect(id)}
              onNavigateToHistory={() => setView('history')}
            />
          ) : view === 'history' ? (
            <HistoryPage
              history={watchHistory}
              onVideoSelect={(id) => handleVideoSelect(id)}
              onClearHistory={() => setWatchHistory([])}
              onRemoveHistoryItem={(id) => setWatchHistory(prev => prev.filter(i => i.videoId !== id))}
              onSelectChannel={handleSelectChannel}
            />
          ) : view === 'debug' ? (
            <DebugAPI />
          ) : loading && videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-3 bg-white">
              <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
              <span className="text-sm font-medium text-gray-600">動画を読み込み中...</span>
            </div>
          ) : error && videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-gray-700 gap-3 bg-white">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={() => view === 'search' ? fetchSearch(searchQuery) : fetchRecommendations(1)}
                className="mt-2 px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
              >
                再読み込み
              </button>
            </div>
          ) : (
            /* ホーム ＆ 検索結果 グリッド ＆ 無限スクロール */
            <div className="p-4 sm:p-6 max-w-[2200px] mx-auto bg-white min-h-screen">
              {view === 'search' && (
                <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-6 border-b border-gray-200 pb-3">
                  "{searchQuery}" の検索結果
                </h2>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
                {videos.map((video, idx) => (
                  <div key={`${video.videoId}-${idx}`} className="relative group">
                    <VideoCard
                      video={video}
                      onClick={() => handleVideoSelect(video.videoId, video)}
                      onSelectChannel={handleSelectChannel}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistModalVideo(video);
                      }}
                      className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-bold shadow-md"
                      title="再生リストに保存"
                    >
                      + 保存
                    </button>
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
            </div>
          )
        }
        </motion.div>
      </AnimatePresence>
        </main>
      </div>

      {/* プレイリスト保存モーダル */}
      {playlistModalVideo && (
        <AddToPlaylistModal
          video={playlistModalVideo}
          playlists={playlists}
          onClose={() => setPlaylistModalVideo(null)}
          onToggleVideoInPlaylist={handleToggleVideoInPlaylist}
          onCreatePlaylist={handleCreatePlaylist}
        />
      )}

      {/* YouTube Auth Flow Modal */}
      {authFlow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4 font-sans">YouTube ログイン</h2>
            <p className="text-gray-600 mb-6 leading-relaxed text-sm">
              以下のURLにアクセスし、お手元のデバイスでコードを入力して承認してください。
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
              <a 
                href={authFlow.verificationUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-red-600 font-bold text-lg hover:underline block mb-3 break-all"
              >
                {authFlow.verificationUrl}
              </a>
              <div className="text-3xl font-mono font-black text-gray-800 tracking-widest bg-white py-3 border border-gray-200 rounded-lg">
                {authFlow.userCode}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 font-medium">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                承認を待機中...
              </div>
              <button 
                onClick={() => { setAuthFlow(null); setIsPolling(false); isPollingRef.current = false; }}
                className="text-gray-500 text-xs hover:text-gray-800 font-bold uppercase tracking-wider mt-2"
              >
                キャンセル
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
