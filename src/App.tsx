
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CategoryBar from './components/CategoryBar';
import VideoCard from './components/VideoCard';
import VideoPlayer from './components/VideoPlayer';
import ChannelPage from './components/ChannelPage';
import SubscriptionsFeed from './components/SubscriptionsFeed';
import LibraryPage from './components/LibraryPage';
import HistoryPage from './components/HistoryPage';
import DebugAPI from './components/DebugAPI';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import { Video, ChannelSubscription, WatchHistoryItem, UserPlaylist, ShortVideo, UserInfo } from './types';
import { localAI } from './lib/intelligence';
import { Loader2, AlertCircle, ListMusic, History } from 'lucide-react';
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

  const [view, setView] = useState<'home' | 'search' | 'video' | 'channel' | 'subscriptions' | 'library' | 'history' | 'debug'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<{ userCode: string, verificationUrl: string } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [menuOpenVideoId, setMenuOpenVideoId] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const [videoCache, setVideoCache] = useState<Record<string, Video | ShortVideo>>(() => {
    try {
      const saved = localStorage.getItem('xerox_video_cache');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [aiInterests, setAiInterests] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_ai_interests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    window.innerWidth >= 1280 || (window.innerWidth >= 768 && window.matchMedia('(orientation: landscape)').matches)
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 && !window.matchMedia('(orientation: landscape)').matches);

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
      let v = searchParams.get('v');
      let list = searchParams.get('list');
      
      if (v && v.startsWith('RD') && v.length >= 13) {
        list = list || v;
        const match = v.match(/RD(?:MM)?([a-zA-Z0-9_-]{11})/);
        v = match ? match[1] : v.substring(v.length - 11);
      }

      if (v) {
        setCurrentVideoId(v);
        setCurrentPlaylistId(list);
        setView('video');
      }
    } else if (path.startsWith('/channel/')) {
      const channelId = path.replace('/channel/', '');
      setSelectedChannelId(channelId);
      setView('channel');
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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname, location.search, view, currentVideoId, selectedChannelId, selectedCategory]);

  useEffect(() => {
    if (view === 'search' && searchQuery) {
      document.title = `${searchQuery} - XeroxYT-NTv6`;
    } else if (view === 'home') {
      document.title = 'XeroxYT-NTv6';
    } else if (view === 'subscriptions') {
      document.title = '登録チャンネル - XeroxYT-NTv6';
    } else if (view === 'library') {
      document.title = 'ライブラリ - XeroxYT-NTv6';
    } else if (view === 'history') {
      document.title = '履歴 - XeroxYT-NTv6';
    }
  }, [view, searchQuery]);

  useEffect(() => {
    if (view === 'home') {
      const width = window.innerWidth;
      if (width >= 1280) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    } else {
      setIsSidebarOpen(false);
    }
  }, [view]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      const mobile = width < 768 && !isLandscape;
      setIsMobile(mobile);
      if (view === 'home') {
        if (width >= 1280) {
          setIsSidebarOpen(true);
        } else {
          setIsSidebarOpen(false);
        }
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [view]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const isFetchingMore = useRef(false);

  const [playlistModalVideo, setPlaylistModalVideo] = useState<Video | null>(null);

  const [currentPlaylistQueue, setCurrentPlaylistQueue] = useState<Video[]>([]);
  const [playlistQueueIndex, setPlaylistQueueIndex] = useState<number>(-1);

  const [subscriptions, setSubscriptions] = useState<ChannelSubscription[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_subscriptions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_watch_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_user_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const skipNextSync = useRef(false);

  useEffect(() => {
    const initSync = async () => {
      const credentialId = localStorage.getItem('webauthn_credential_id');
      if (credentialId) {
        setUserInfo({ 
          name: 'Sync User', 
          email: 'Logged in with TouchID',
          avatar: `https://ui-avatars.com/api/?name=User&background=random`
        });
        setIsSyncing(true);
        try {
          const res = await fetchJSON('/api/sync/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credentialId })
          });
          if (res.data) {
            skipNextSync.current = true;
            if (res.data.subscriptions) setSubscriptions(res.data.subscriptions);
            if (res.data.watchHistory) setWatchHistory(res.data.watchHistory);
            if (res.data.userPlaylists) setPlaylists(res.data.userPlaylists);
            setTimeout(() => { skipNextSync.current = false; }, 1000);
          }
        } catch (e) {
          console.error('Initial sync failed', e);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    initSync();
  }, []);

  const performServerSync = async (data: any) => {
    const credentialId = localStorage.getItem('webauthn_credential_id');
    if (!credentialId || skipNextSync.current) return;
    try {
      await fetchJSON('/api/sync/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId, data })
      });
    } catch (e) {
      console.error('Failed to sync to server', e);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('xerox_subscriptions', JSON.stringify(subscriptions));
    } catch (e) {
      console.error(e);
    }
    performServerSync({ subscriptions, watchHistory, userPlaylists: playlists });
  }, [subscriptions]);

  useEffect(() => {
    try {
      localStorage.setItem('xerox_watch_history', JSON.stringify(watchHistory));
    } catch (e) {
      console.error(e);
    }
    performServerSync({ subscriptions, watchHistory, userPlaylists: playlists });
  }, [watchHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('xerox_user_playlists', JSON.stringify(playlists));
    } catch (e) {
      console.error(e);
    }
    performServerSync({ subscriptions, watchHistory, userPlaylists: playlists });
  }, [playlists]);

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

  const getHistoryKeywords = (): string => {
    const historyData = watchHistory.slice(0, 20);
    
    let baseKeywords = aiInterests.slice(0, 5).join(' ');
    
    const localKeywords = localAI.getTopSuggestedQueries(8).join(' ');
    if (localKeywords) baseKeywords += ' ' + localKeywords;

    if (historyData.length === 0 && !searchQuery && !baseKeywords && subscriptions.length === 0) return "";

    const words = historyData
      .map(h => h.title)
      .join(' ')
      .replace(/[【】\[\]\(\)（）!！?？、。]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !['動画', '最新', 'の', 'は', 'で', 'を', 'に', 'と', 'が', 'て', 'た', '！'].includes(w.toLowerCase()));

    const counts: Record<string, number> = {};
    words.forEach(w => counts[w] = (counts[w] || 0) + 1);
    
    const sortedKeywords = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);

    const historyChannels = historyData.map(h => h.author);
    const subChannels = subscriptions.map(s => s.title);
    const allChannels = Array.from(new Set([...historyChannels, ...subChannels])).slice(0, 6);

    const base = searchQuery ? [searchQuery] : [];
    const finalKeywords = Array.from(new Set([...base, ...sortedKeywords, ...allChannels])).join(' ');
    
    return finalKeywords;
  };


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
      setIsSyncing(true);
      const { authenticatePasskey, registerPasskey } = await import('./utils/webauthn');
      
      let credentialId: string;
      try {
        credentialId = await authenticatePasskey();
      } catch (authErr) {
        console.log('No existing passkey found, registering new one...');
        credentialId = await registerPasskey();
      }

      localStorage.setItem('webauthn_credential_id', credentialId);
      
      const res = await fetchJSON('/api/sync/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId })
      });

      if (res.data) {
        skipNextSync.current = true;
        if (res.data.subscriptions) setSubscriptions(res.data.subscriptions);
        if (res.data.watchHistory) setWatchHistory(res.data.watchHistory);
        if (res.data.userPlaylists) setPlaylists(res.data.userPlaylists);
        setTimeout(() => { skipNextSync.current = false; }, 1000);
      } else {
        await performServerSync({ subscriptions, watchHistory, userPlaylists: playlists });
      }

      setUserInfo({ 
        name: 'Sync User', 
        email: 'Logged in with TouchID',
        avatar: `https://ui-avatars.com/api/?name=User&background=random`
      });

    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('webauthn_credential_id');
    setUserInfo(null);
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
      
      if (result.aiKeywords && result.aiKeywords.length > 0) {
        setAiInterests(result.aiKeywords);
      }
      
      updateCache(publicData);
      
      const combinedData = [...data, ...publicData];
      
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

  const handleScroll = useCallback(() => {
    if (view !== 'home' && view !== 'search') return;
    if (loading || loadingMore || !hasMore || isFetchingMore.current) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const totalHeight = document.documentElement.scrollHeight;

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

  const homeMixCards = useMemo(() => {
    if (view !== 'home' || !watchHistory || watchHistory.length === 0) return [];

    const artistMap = new Map<string, { count: number; videos: WatchHistoryItem[] }>();
    const videoRepeatMap = new Map<string, { count: number; item: WatchHistoryItem }>();

    for (const item of watchHistory) {
      const author = (item.author || '').trim();
      if (author && author !== 'Unknown' && author !== 'チャンネル') {
        if (!artistMap.has(author)) {
          artistMap.set(author, { count: 0, videos: [] });
        }
        const aData = artistMap.get(author)!;
        aData.count += 1;
        aData.videos.push(item);
      }

      if (item.videoId) {
        if (!videoRepeatMap.has(item.videoId)) {
          videoRepeatMap.set(item.videoId, { count: 0, item });
        }
        videoRepeatMap.get(item.videoId)!.count += 1;
      }
    }

    const cards: Video[] = [];

    const sortedRepeats = Array.from(videoRepeatMap.values()).sort((a, b) => b.count - a.count);
    if (sortedRepeats.length > 0) {
      const topRepeat = sortedRepeats[0].item;
      cards.push({
        videoId: topRepeat.videoId,
        title: `マイミックスリスト - あなたのリピート曲`,
        author: `YouTube`,
        authorAvatar: topRepeat.authorAvatar,
        type: 'mix',
        playlistId: `RDMM${topRepeat.videoId}`,
        videoThumbnails: [{ url: topRepeat.thumbnailUrl || `https://i.ytimg.com/vi/${topRepeat.videoId}/hqdefault.jpg`, width: 480, height: 360 }],
        viewCount: 0,
        publishedText: 'YouTubeが作成',
        lengthSeconds: 0,
      });
    }

    const sortedArtists = Array.from(artistMap.entries()).sort((a, b) => b[1].count - a[1].count);
    for (let i = 0; i < Math.min(2, sortedArtists.length); i++) {
      const [author, data] = sortedArtists[i];
      const topVideo = data.videos[0];
      if (topVideo && !cards.some(c => c.playlistId === `RD${topVideo.videoId}`)) {
        cards.push({
          videoId: topVideo.videoId,
          title: `ミックスリスト - ${author}`,
          author: `YouTube`,
          authorAvatar: topVideo.authorAvatar,
          type: 'mix',
          playlistId: `RD${topVideo.videoId}`,
          videoThumbnails: [{ url: topVideo.thumbnailUrl || `https://i.ytimg.com/vi/${topVideo.videoId}/hqdefault.jpg`, width: 480, height: 360 }],
          viewCount: 0,
          publishedText: 'ミックスリスト',
          lengthSeconds: 0,
        });
      }
    }

    return cards;
  }, [view, watchHistory]);

  const blendedHomeVideos = useMemo(() => {
    if (view !== 'home' || homeMixCards.length === 0) {
      return videos;
    }
    const result: Video[] = [...videos];
    if (homeMixCards[0]) {
      result.splice(1, 0, homeMixCards[0]);
    }
    if (homeMixCards[1]) {
      result.splice(5, 0, homeMixCards[1]);
    }
    if (homeMixCards[2]) {
      result.splice(9, 0, homeMixCards[2]);
    }
    return result;
  }, [videos, homeMixCards, view]);

  const handleVideoSelect = (videoId: string, videoObj?: Video, explicitPlaylistId?: string | null) => {
    if (videoObj) {
      localAI.processVideoInteraction(videoObj, 1.0);
      updateCache([videoObj]);
    } else if (videoId && videoCache[videoId]) {
      localAI.processVideoInteraction(videoCache[videoId], 1.0);
    }
    
    const playlistId = explicitPlaylistId !== undefined ? explicitPlaylistId : (videoObj?.playlistId || (videoId && videoCache[videoId] ? (videoCache[videoId] as Video).playlistId : null));
    navigate(`/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ''}`);
  };

  const handleSelectChannel = (channelIdOrName: string) => {
    navigate(`/channel/${channelIdOrName}`);
  };

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

  const handleImportYouTubePlaylist = (importedPlaylist: UserPlaylist) => {
    setPlaylists(prev => [importedPlaylist, ...prev]);
  };

  const handleUpdatePlaylistInfo = (id: string, title: string, description?: string) => {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, title, description, updatedAt: Date.now() } : p));
  };

  const handleAddVideosToPlaylist = (playlistId: string, videos: Video[]) => {
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, videos, updatedAt: Date.now() } : p));
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
      
      <div className="w-full shrink-0 sticky top-0 z-50 bg-white">
        <Navbar
          onSearch={handleSearch}
          onHome={handleGoHome}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          initialSearchQuery={searchQuery}
          userInfo={userInfo}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex flex-1 relative items-start">
        
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentView={view}
          onHome={handleGoHome}
          onSubscriptions={() => setView('subscriptions')}
          onLibrary={() => setView('library')}
          onHistory={() => setView('history')}
          subscriptions={subscriptions}
          onSelectChannel={handleSelectChannel}
          onDebugAPI={() => navigate('/debug/api')}
        />

        
        <main
          className="flex-1 transition-all duration-200 min-w-0"
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
              
              {(view === 'home' || view === 'search') && (
                <CategoryBar
                  selectedCategory={selectedCategory}
                  onSelectCategory={handleSelectCategory}
                />
              )}

          
          {view === 'video' && currentVideoId ? (
            <VideoPlayer
              videoId={currentVideoId}
              playlistId={currentPlaylistId || undefined}
              onVideoSelect={handleVideoSelect}
              onSelectChannel={handleSelectChannel}
              subscriptions={subscriptions}
              onToggleSubscribe={handleToggleSubscribe}
              onRecordHistory={handleRecordHistory}
              onOpenAddToPlaylist={(video) => setPlaylistModalVideo(video)}
              onCacheVideo={(v) => updateCache([v])}
              watchHistory={watchHistory}
            />
          ) : view === 'channel' && selectedChannelId ? (
            <ChannelPage
              channelId={selectedChannelId}
              onVideoSelect={(id) => handleVideoSelect(id)}
              subscriptions={subscriptions}
              onToggleSubscribe={handleToggleSubscribe}
              onSelectChannel={handleSelectChannel}
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
              onImportYouTubePlaylist={handleImportYouTubePlaylist}
              onUpdatePlaylistInfo={handleUpdatePlaylistInfo}
              onAddVideosToPlaylist={handleAddVideosToPlaylist}
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
            <div className="p-4 sm:p-6 md:p-8 max-w-[2000px] mx-auto min-h-screen">
              {view === 'search' && (
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold">「{searchQuery}」の検索結果</h2>
                  <span className="text-sm text-gray-500 font-medium">{videos.length}件の動画</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
                {(view === 'home' ? blendedHomeVideos : videos).map((video, idx) => (
                  <div key={`${video.videoId}-${video.playlistId || ''}-${idx}`} className="relative group">
                    <VideoCard
                      video={video}
                      onClick={() => handleVideoSelect(video.videoId, video)}
                      onOpenMenu={(e) => {
                        e.stopPropagation();
                        setMenuOpenVideoId(video.videoId);
                      }}
                      onSelectChannel={handleSelectChannel}
                    />
                    
                    <AnimatePresence>
                      {menuOpenVideoId === video.videoId && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-10 right-2 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 min-w-[200px]"
                        >
                          <button
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistModalVideo(video);
                              setMenuOpenVideoId(null);
                            }}
                          >
                            <ListMusic size={18} />
                            プレイリストに保存
                          </button>
                          <button
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecordHistory(video);
                              setMenuOpenVideoId(null);
                            }}
                          >
                            <History size={18} />
                            履歴に追加
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {loading && videos.length > 0 && (
                <div className="flex justify-center my-12">
                  <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                </div>
              )}
              
              {!loading && videos.length > 0 && (
                <div className="h-20" ref={observerTarget} />
              )}
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {playlistModalVideo && (
          <AddToPlaylistModal
            video={playlistModalVideo}
            playlists={playlists}
            onCreatePlaylist={handleCreatePlaylist}
            onToggleVideoInPlaylist={handleToggleVideoInPlaylist}
            onClose={() => setPlaylistModalVideo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

