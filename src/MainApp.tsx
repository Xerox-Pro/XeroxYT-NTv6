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
import VideoSkeleton from './components/VideoSkeleton';
import TopProgressBar from './components/TopProgressBar';
import VideoPlayer from './components/VideoPlayer';
import ChannelPage from './components/ChannelPage';
import SubscriptionsFeed from './components/SubscriptionsFeed';
import LibraryPage from './components/LibraryPage';
import HistoryPage from './components/HistoryPage';
import DebugAPI from './components/DebugAPI';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import DetectedSearchHeader from './components/DetectedSearchHeader';
import { Video, ChannelSubscription, WatchHistoryItem, UserPlaylist, ShortVideo, UserInfo } from './types';
import { localAI } from './lib/intelligence';
import { Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchJSON, parseYouTubeUrl } from './utils';

declare global {
  interface Window {
    google: any;
  }
}

export default function MainApp() {
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
  const [authError, setAuthError] = useState<string | null>(null);
  
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    window.innerWidth >= 1280 || (window.innerWidth >= 768 && window.matchMedia('(orientation: landscape)').matches)
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 && !window.matchMedia('(orientation: landscape)').matches);

  const recommendationRequestIdRef = useRef(0);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setView('home');
      fetchRecommendations(1, false);
    } else if (path.startsWith('/shorts/')) {
      const parts = path.split('/');
      const shortId = parts[2]?.split('?')[0];
      if (shortId) {
        navigate(`/watch?v=${encodeURIComponent(shortId)}`, { replace: true });
      }
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
      const parts = path.split('/');
      const channelId = parts[2];
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

  const [youtubeHistory, setYoutubeHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // User Playlists saved in LocalStorage
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => {
    try {
      const saved = localStorage.getItem('xerox_user_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // YouTube Authenticated Features State
  const [youtubePlaylists, setYoutubePlaylists] = useState<any[]>([]);
  const [watchLaterVideos, setWatchLaterVideos] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState<boolean>(false);

  const fetchYoutubeAuthData = async () => {
    const ytCreds = localStorage.getItem('xerox_youtube_credentials');
    if (!ytCreds) return;

    try {
      const channelInfo = await fetchJSON('/api/user/channel-info');
      if (channelInfo && channelInfo.id) {
        setUserInfo(prev => {
          if (!prev) return null;
          const updated = {
            ...prev,
            handle: channelInfo.handle,
            subscriberCount: channelInfo.subscriberCount,
            videoCount: channelInfo.videoCount,
            bannerUrl: channelInfo.bannerUrl,
            picture: channelInfo.avatar || prev.picture
          };
          localStorage.setItem('xerox_user_info', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.warn('Failed to fetch YouTube channel info:', e);
    }

    try {
      const ytPlaylists = await fetchJSON('/api/user/playlists');
      if (Array.isArray(ytPlaylists)) {
        setYoutubePlaylists(ytPlaylists);
      }
    } catch (e) {
      console.warn('Failed to fetch YouTube playlists:', e);
    }

    try {
      const wlVideos = await fetchJSON('/api/user/watch-later');
      if (Array.isArray(wlVideos)) {
        setWatchLaterVideos(wlVideos);
      }
    } catch (e) {
      console.warn('Failed to fetch Watch Later videos:', e);
    }

    try {
      const countRes = await fetchJSON('/api/user/notifications/unread-count');
      if (countRes && typeof countRes.count === 'number') {
        setUnreadNotificationsCount(countRes.count);
      }
    } catch (e) {
      console.warn('Failed to fetch unread notifications count:', e);
    }

    try {
      const notifs = await fetchJSON('/api/user/notifications');
      if (Array.isArray(notifs)) {
        setNotifications(notifs);
      }
    } catch (e) {
      console.warn('Failed to fetch notifications list:', e);
    }
  };

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

  useEffect(() => {
    if (view === 'history') {
      const ytCreds = localStorage.getItem('xerox_youtube_credentials');
      if (ytCreds && userInfo) {
        setLoadingHistory(true);
        fetchJSON('/api/user/history')
          .then((data) => {
            if (Array.isArray(data)) {
              setYoutubeHistory(data.map((v: any) => ({
                videoId: v.videoId,
                title: v.title,
                author: v.author,
                authorAvatar: v.authorAvatar,
                thumbnailUrl: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                lengthSeconds: v.lengthSeconds || 0,
                viewCount: v.viewCount || 0,
                timestamp: v.timestamp || Date.now(),
                type: 'video'
              })));
            }
          })
          .catch((err) => console.error('Failed to fetch YouTube history:', err))
          .finally(() => setLoadingHistory(false));
      } else {
        setYoutubeHistory([]);
      }
    }
  }, [view, userInfo]);

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
      .filter(w => w.length >= 2 && !['動画', '最新', 'の', 'は', 'で', 'を', 'に', 'と', 'が', 'て', 'た', '！'].includes(w.toLowerCase()));

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
          const cleanVideo = { ...v };
          if ('recommendedVideos' in cleanVideo) {
            delete cleanVideo.recommendedVideos;
          }
          next[v.videoId] = cleanVideo;
          changed = true;
        }
      });
      // キャッシュの上限を設けてクラッシュを防ぐ (最大150件)
      const keys = Object.keys(next);
      if (keys.length > 150) {
        keys.slice(0, keys.length - 150).forEach(k => delete next[k]);
        changed = true;
      }
      return changed ? next : prev;
    });
  };

  const isPollingRef = useRef(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setAuthError(null);
      const data = await fetchJSON('/api/auth/signin');
      if (data && data.userCode && data.verificationUrl) {
        setAuthFlow({
          userCode: data.userCode,
          verificationUrl: data.verificationUrl
        });
        setIsPolling(true);
        isPollingRef.current = true;
      } else {
        throw new Error('Googleログイン処理の開始に失敗しました。');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || 'ログイン処理に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPolling || !authFlow) return;

    let timer: NodeJS.Timeout;
    const poll = async () => {
      if (!isPollingRef.current) return;
      try {
        console.log('[Auth] Polling authentication status...');
        const res = await fetchJSON('/api/auth/poll');
        if (res && res.success && res.user) {
          console.log('[Auth] Successfully authenticated!', res.user);
          const uInfo = {
            name: res.user.name,
            email: res.user.email || 'authenticated@youtube.com',
            picture: res.user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(res.user.name)}&background=random`
          };
          setUserInfo(uInfo);
          localStorage.setItem('xerox_user_info', JSON.stringify(uInfo));
          if (res.credentials) {
            localStorage.setItem('xerox_youtube_credentials', JSON.stringify(res.credentials));
          }
          setAuthFlow(null);
          setIsPolling(false);
          isPollingRef.current = false;
          
          // Force refreshing recommendations with their new personal home feed
          setPage(1);
          fetchRecommendations(1, false);
          
          // Sync Subscribed Channels on login
          try {
            const subChannels = await fetchJSON('/api/user/subscriptions');
            if (Array.isArray(subChannels)) {
              setSubscriptions(subChannels.map(c => ({
                id: c.id,
                title: c.title,
                avatar: c.avatar
              })));
            }
          } catch (e) {
            console.warn('Failed to sync subscriptions on login:', e);
          }

          // Fetch additional YouTube features data
          fetchYoutubeAuthData();
        } else if (res && res.status === 'error') {
          console.error('[Auth] Polling returned error:', res.error);
          setAuthError(res.error || '認証中にエラーが発生しました。最初からやり直してください。');
          setIsPolling(false);
          isPollingRef.current = false;
        } else {
          // If pending, poll again
          timer = setTimeout(poll, 6000);
        }
      } catch (err: any) {
        console.error('[Auth] Poll failed:', err);
        // Retry polling
        timer = setTimeout(poll, 6000);
      }
    };

    timer = setTimeout(poll, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [isPolling, authFlow]);

  useEffect(() => {
    const initYtAuth = async () => {
      const ytCreds = localStorage.getItem('xerox_youtube_credentials');
      if (ytCreds && userInfo) {
        // Sync subscribed channels on load
        try {
          const subChannels = await fetchJSON('/api/user/subscriptions');
          if (Array.isArray(subChannels) && subChannels.length > 0) {
            setSubscriptions(subChannels.map(c => ({
              id: c.id,
              title: c.title,
              avatar: c.avatar
            })));
          }
        } catch (e) {
          console.warn('Initial subscriptions sync failed:', e);
        }

        // Fetch additional YouTube features data
        fetchYoutubeAuthData();
      }
    };
    initYtAuth();
  }, [userInfo]);

  const handleLogout = async () => {
    try {
      await fetchJSON('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {}
    localStorage.removeItem('xerox_youtube_credentials');
    localStorage.removeItem('xerox_user_info');
    localStorage.removeItem('webauthn_credential_id');
    setUserInfo(null);
    setSubscriptions([]);
    setWatchHistory([]);
    setYoutubePlaylists([]);
    setWatchLaterVideos([]);
    setNotifications([]);
    setUnreadNotificationsCount(0);
    setShowNotificationsMenu(false);
    setPage(1);
    fetchRecommendations(1, false);
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
    const currentReqId = ++recommendationRequestIdRef.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setVideos([]);
    }
    setError('');

    try {
      const keywords = getHistoryKeywords();
      const historyIds = watchHistory.slice(0, 20).map(h => h.videoId).join(',');
      const userHashtags = JSON.stringify(localAI.getHashtagsMap());
      let data = [];

      // Fetch recommendations from API (deterministic parameters allow Vercel Edge CDN cache)
      const queryParams = new URLSearchParams({
        keywords,
        historyIds,
        userHashtags,
        page: pageNum.toString(),
      });
      const result = await fetchJSON(`/api/recommendations?${queryParams.toString()}`);

      if (currentReqId !== recommendationRequestIdRef.current) return;

      let publicData: Video[] = [];
      if (Array.isArray(result)) {
        publicData = result;
      } else if (result && Array.isArray(result.videos)) {
        publicData = result.videos;
      }
      
      // AIの分析結果を保存
      if (result && result.aiKeywords && result.aiKeywords.length > 0) {
        setAiInterests(result.aiKeywords);
      }

      // フォールバック: 初回読み込みで動画が取得できなかった場合は人気動画(trending)を表示
      if (publicData.length === 0 && data.length === 0 && pageNum === 1) {
        try {
          const trendingData = await fetchJSON('/api/trending');
          if (Array.isArray(trendingData) && trendingData.length > 0) {
            publicData = trendingData;
          }
        } catch (e) {
          console.warn('Fallback trending fetch error:', e);
        }
      }
      
      if (currentReqId !== recommendationRequestIdRef.current) return;

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
      if (currentReqId !== recommendationRequestIdRef.current) return;
      console.error(err);
      if (!append) setError(err.message || 'エラーが発生しました');
    } finally {
      if (currentReqId === recommendationRequestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        isFetchingMore.current = false;
      }
    }
  };

  // 検索動画データ読み込み (ページ別)
  const fetchSearch = async (q: string, pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setVideos([]);
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
      if (location.pathname !== '/') {
        navigate('/');
      } else {
        fetchRecommendations(1, false);
      }
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
      let updatedVideos = pl.videos;
      if (exists) {
        updatedVideos = pl.videos.filter(v => v.videoId !== video.videoId);
      } else {
        const cleanVideo = { ...video };
        if ('recommendedVideos' in cleanVideo) delete cleanVideo.recommendedVideos;
        updatedVideos = [...pl.videos, cleanVideo];
      }
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
    const cleanVideos = videos.map(v => {
      const cleanVideo = { ...v };
      if ('recommendedVideos' in cleanVideo) delete cleanVideo.recommendedVideos;
      return cleanVideo;
    });
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, videos: cleanVideos, updatedAt: Date.now() } : p));
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
      <TopProgressBar isLoading={loading || loadingMore} />
      {/* ナビゲーションバー: 常に上部に固定しつつ、コンテンツと被らないようにする */}
      <div className="w-full shrink-0 sticky top-0 z-50 bg-white">
        <Navbar
          onSearch={handleSearch}
          onHome={handleGoHome}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          initialSearchQuery={searchQuery}
        />
      </div>

      <div className="flex flex-1 relative items-start">
        {/* サイドバー: Desktopではsticky、モバイルではfixed overlay */}
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

        {/* メインコンテンツビュー */}
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
              key={currentVideoId}
              videoId={currentVideoId}
              playlistId={currentPlaylistId || undefined}
              onVideoSelect={(id, v) => handleVideoSelect(id, v)}
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
              youtubePlaylists={youtubePlaylists}
              watchLaterVideos={watchLaterVideos}
            />
          ) : view === 'history' ? (
            loadingHistory ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
                <span className="text-sm font-medium text-gray-500">再生履歴を読み込み中...</span>
              </div>
            ) : (
              <HistoryPage
                history={localStorage.getItem('xerox_youtube_credentials') ? youtubeHistory : watchHistory}
                onVideoSelect={(id) => handleVideoSelect(id)}
                onClearHistory={() => {
                  if (localStorage.getItem('xerox_youtube_credentials')) {
                    setYoutubeHistory([]);
                  } else {
                    setWatchHistory([]);
                  }
                }}
                onRemoveHistoryItem={(id) => {
                  if (localStorage.getItem('xerox_youtube_credentials')) {
                    setYoutubeHistory(prev => prev.filter(i => i.videoId !== id));
                  } else {
                    setWatchHistory(prev => prev.filter(i => i.videoId !== id));
                  }
                }}
                onSelectChannel={handleSelectChannel}
              />
            )
          ) : view === 'debug' ? (
            <DebugAPI />
          ) : loading ? (
            <VideoSkeleton count={12} />
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
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto bg-white min-h-screen">
              {view === 'search' && (
                <>
                  <DetectedSearchHeader
                    searchQuery={searchQuery}
                    onVideoSelect={(id) => handleVideoSelect(id)}
                    onSelectChannel={(id) => handleSelectChannel(id)}
                  />
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-6 border-b border-gray-200 pb-3">
                    "{searchQuery}" の検索結果
                  </h2>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
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
                      className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-bold shadow-md"
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


    </div>
  );
}
