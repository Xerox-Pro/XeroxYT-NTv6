import React, { useEffect, useState, useRef } from 'react';
import { Video, Comment, ChannelSubscription, WatchHistoryItem } from '../types';
import { formatNumberJP, formatDuration, fetchJSON } from '../utils';
import { localAI } from '../lib/intelligence';
import { 
  ThumbsUp, ThumbsDown, Share2, AlertCircle, Loader2, 
  ChevronDown, ChevronUp, MessageSquare, Send, Plus, 
  ListMusic, Radio, Users, DollarSign, Sparkles, History, Smile, Download, RotateCw, X, Bell, PlayCircle
} from 'lucide-react';
import Avatar from './Avatar';
import { MixPlaylist } from './MixPlaylist';

interface CommentItemProps {
  comment: Comment;
  onSelectChannel: (channelIdOrName: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, onSelectChannel }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const lineCount = (comment.text || '').split('\n').length;
  const isLong = lineCount > 3 || (comment.text || '').length > 160;

  return (
    <div className="flex items-start gap-3 text-sm">
      <button 
        onClick={() => onSelectChannel(comment.authorId || comment.author)} 
        className="shrink-0 cursor-pointer text-left self-start mt-0.5 hover:opacity-85 transition-opacity"
        title={`${comment.author}のチャンネルを開く`}
      >
        <Avatar 
          src={comment.authorAvatar} 
          name={comment.author} 
          channelId={comment.authorId}
          className="w-9 h-9 text-xs shadow-xs" 
        />
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onSelectChannel(comment.authorId || comment.author)} 
            className="font-bold text-gray-900 text-xs hover:underline cursor-pointer text-left truncate"
          >
            {comment.author}
          </button>
          <span className="text-[11px] text-gray-500 shrink-0">{comment.publishedTime}</span>
        </div>
        
        <p className={`text-gray-800 text-sm font-normal leading-relaxed whitespace-pre-wrap break-words ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}>
          {comment.text}
        </p>

        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 self-start mt-0.5 hover:underline cursor-pointer"
          >
            {isExpanded ? '一部を表示' : '続きを読む'}
          </button>
        )}

        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
          <button className="flex items-center gap-1 hover:text-gray-900 font-semibold">
            <ThumbsUp size={14} />
            <span>{comment.likeCount}</span>
          </button>
          <button className="hover:text-gray-900">
            <ThumbsDown size={14} />
          </button>
          <button className="hover:text-gray-900 font-semibold">返信</button>
        </div>
      </div>
    </div>
  );
}

interface LiveChatMessage {
  id: string;
  author: string;
  authorAvatar?: string;
  message: string;
  timestamp: string;
  isSuperChat?: boolean;
  superChatAmount?: string;
  superChatColor?: string;
  badge?: string;
}

interface VideoPlayerProps {
  videoId: string;
  playlistId?: string;
  onVideoSelect: (id: string, video?: Video, explicitPlaylistId?: string | null) => void;
  onSelectChannel: (channelIdOrName: string) => void;
  subscriptions: ChannelSubscription[];
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onRecordHistory?: (video: Video) => void;
  onOpenAddToPlaylist?: (video: Video) => void;
  onCacheVideo?: (video: Video) => void;
  watchHistory?: WatchHistoryItem[];
}

export default function VideoPlayer({
  videoId,
  playlistId,
  onVideoSelect,
  onSelectChannel,
  subscriptions,
  onToggleSubscribe,
  onRecordHistory,
  onOpenAddToPlaylist,
  onCacheVideo,
  watchHistory = []
}: VideoPlayerProps) {
  const [videoData, setVideoData] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRelatedOpen, setIsRelatedOpen] = useState(true);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'related' | 'liveChat'>('related');
  const [eduKey, setEduKey] = useState<string>('');
  const [refreshingEduKey, setRefreshingEduKey] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [relatedFilter, setRelatedFilter] = useState('all');

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(playlistId || null);
  const [mixVideos, setMixVideos] = useState<Video[]>([]);
  const [mixTitle, setMixTitle] = useState<string>('ミックスリスト');
  const [mixSubtitle, setMixSubtitle] = useState<string>('ミックスリストとは、YouTube があなたのために作成したプレイリストです');
  const [isMixOpen, setIsMixOpen] = useState<boolean>(true);
  const [loopMode, setLoopMode] = useState<'none' | 'all' | 'one'>('none');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const internalYtVideoId = useRef<string>(videoId);
  const skipNextReload = useRef<boolean>(false);

  const [currentIframeSrc, setCurrentIframeSrc] = useState<string>('');

  useEffect(() => {
    setActivePlaylistId(playlistId || null);
  }, [playlistId]);

  useEffect(() => {
    let newSrc = '';
    if (playlistId) {
      if (videoId) {
        newSrc = `https://www.youtubeeducation.com/embed/${videoId}${eduKey ? eduKey : '?autoplay=1'}&enablejsapi=1&list=${playlistId}&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`;
      } else {
        newSrc = `https://www.youtubeeducation.com/embed/videoseries?list=${playlistId}&autoplay=1&enablejsapi=1${eduKey}`;
      }
    } else {
      newSrc = `https://www.youtubeeducation.com/embed/${videoId}${eduKey ? eduKey : '?autoplay=1'}&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`;
    }
    
    if (skipNextReload.current) {
      skipNextReload.current = false;
      return;
    }
    
    setCurrentIframeSrc(newSrc);
    internalYtVideoId.current = videoId;
    if (iframeRef.current && iframeRef.current.contentWindow && !playlistId) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'loadVideoById',
        args: [videoId]
      }), '*');
    }
  }, [videoId, playlistId, eduKey]);

  useEffect(() => {
    const fetchEduKey = async () => {
      try {
        const res = await fetchJSON('/api/edukey');
        if (res && res.key) {
          setEduKey(res.key);
        }
      } catch (e) {
        console.error('Failed to load edukey:', e);
      }
    };
    fetchEduKey();
  }, []);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  const handleReloadEduKey = async () => {
    if (refreshingEduKey || cooldownSec > 0) return;
    setRefreshingEduKey(true);
    setCooldownSec(15); // 15秒のクールダウンをセット
    try {
      const res = await fetchJSON('/api/edukey?refresh=true');
      if (res && res.key) {
        setEduKey(res.key);
      }
    } catch (e) {
      console.error('Failed to reload edukey:', e);
    } finally {
      setRefreshingEduKey(false);
    }
  };

  useEffect(() => {
    if (videoData && videoData.title) {
      document.title = `${videoData.title} - XeroxYT-NTv6`;
    }
  }, [videoData]);

  const handleDownload = async () => {
    if (downloading || !videoId) return;
    setDownloading(true);
    try {
      const res = await fetchJSON(`/api/download-link?videoId=${encodeURIComponent(videoId)}`);
      if (res && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert('ダウンロードリンクを取得できませんでした。');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('ダウンロードリンクの取得に失敗しました。');
    } finally {
      setDownloading(false);
    }
  };

  const watchSecondsRef = useRef<number>(0);
  const activeVideoRef = useRef<Video | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>([]);
  const [newLiveMessage, setNewLiveMessage] = useState('');
  const [showSuperChatModal, setShowSuperChatModal] = useState(false);
  const [superChatAmount, setSuperChatAmount] = useState('1000');
  const [superChatMessage, setSuperChatMessage] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);

  useEffect(() => {
    watchSecondsRef.current = 0;
    const interval = setInterval(() => {
      watchSecondsRef.current += 1;
      if (watchSecondsRef.current % 20 === 0 && activeVideoRef.current) {
        localAI.processWatchDuration(activeVideoRef.current, watchSecondsRef.current);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (activeVideoRef.current && watchSecondsRef.current > 0) {
        localAI.processWatchDuration(activeVideoRef.current, watchSecondsRef.current);
      }
    };
  }, [videoId]);

  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJSON(`/api/video/${videoId}`);
        setVideoData(data);
        activeVideoRef.current = data;
        
        if (data) {
          localAI.processVideoInteraction(data, 1.5);
          if (onRecordHistory) {
            onRecordHistory(data);
          }
          if (data.title) {
            document.title = `${data.title} - YouTube`;
          }
        }
        if (onCacheVideo && data) {
          onCacheVideo(data);
        }

        if (data?.isLive && !data?.isPremiere && !data?.isUpcoming) {
          setSidebarTab('liveChat');
          initLiveChat(data.author || 'チャンネル');
        } else {
          setSidebarTab('related');
        }
      } catch (err: any) {
        setError(err.message || 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const data = await fetchJSON(`/api/video/${videoId}/comments`);
        setComments(data);
        
        if (videoData && videoData.recommendedVideos) {
          localAI.processMetadataAnalysis(videoId, data, videoData.recommendedVideos);
        }
      } catch (err) {
        console.error("Failed to load comments", err);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchVideo();
    fetchComments();
    setIsDescExpanded(false);
  }, [videoId]);

  useEffect(() => {
    if (!activePlaylistId) {
      if (mixVideos.length > 0) {
        setMixVideos([]);
      }
      return;
    }

    if (!videoData) return;

    const existsInMix = mixVideos.some((v) => v.videoId === videoId);
    if (existsInMix) {
      return;
    }

    const initialList: Video[] = [
      videoData,
      ...(videoData.recommendedVideos || []),
    ];
    setMixVideos(initialList);

    const authorName = videoData.author && videoData.author !== 'Unknown' && videoData.author !== 'チャンネル'
      ? videoData.author
      : '';
    const defaultMixTitle = authorName
      ? `ミックスリスト - ${authorName}`
      : `ミックスリスト - ${videoData.title}`;
    setMixTitle(defaultMixTitle);

    const fetchFullMix = async () => {
      try {
        const mixRes = await fetchJSON(
          `/api/mix/${videoId}?list=${encodeURIComponent(activePlaylistId)}`
        );
        if (mixRes && Array.isArray(mixRes.videos) && mixRes.videos.length > 0) {
          setMixVideos(mixRes.videos);
          if (mixRes.title) {
            setMixTitle(mixRes.title);
          }
          if (mixRes.description) {
            setMixSubtitle(mixRes.description);
          }
        }
      } catch (e) {
        console.warn('[VideoPlayer] Background mix fetch warning:', e);
      }
    };

    fetchFullMix();
  }, [videoId, activePlaylistId, videoData?.title]);

  const handleStartMix = (targetVideoId?: string, author?: string) => {
    const vId = targetVideoId || videoId;
    const newPlaylistId = `RD${vId}`;
    setActivePlaylistId(newPlaylistId);
    setIsMixOpen(true);

    if (videoData) {
      const initialList: Video[] = [
        videoData,
        ...(videoData.recommendedVideos || []),
      ];
      setMixVideos(initialList);
      const name = author || videoData.author;
      setMixTitle(name && name !== 'Unknown' && name !== 'チャンネル' ? `ミックスリスト - ${name}` : `ミックスリスト - ${videoData.title}`);
      onVideoSelect(vId, { ...videoData, playlistId: newPlaylistId });
    }
  };

  const handleCycleLoopMode = () => {
    setLoopMode((prev) => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  };

  const handleToggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const getNextVideo = (forward: boolean = true): Video | null => {
    if (!mixVideos || mixVideos.length === 0) return null;
    const currIdx = mixVideos.findIndex((v) => v.videoId === videoId);

    if (isShuffle && forward && mixVideos.length > 1) {
      let randomIdx = Math.floor(Math.random() * mixVideos.length);
      if (randomIdx === currIdx) {
        randomIdx = (randomIdx + 1) % mixVideos.length;
      }
      return mixVideos[randomIdx];
    }

    if (forward) {
      if (currIdx >= 0 && currIdx < mixVideos.length - 1) {
        return mixVideos[currIdx + 1];
      } else if (loopMode === 'all') {
        return mixVideos[0];
      }
    } else {
      if (currIdx > 0) {
        return mixVideos[currIdx - 1];
      } else if (loopMode === 'all') {
        return mixVideos[mixVideos.length - 1];
      }
    }
    return null;
  };

  const handleNextTrack = () => {
    const next = getNextVideo(true);
    if (next && next.videoId) {
      setVideoData(next);
      onVideoSelect(next.videoId, next);
    }
  };

  const handlePrevTrack = () => {
    const prev = getNextVideo(false);
    if (prev && prev.videoId) {
      setVideoData(prev);
      onVideoSelect(prev.videoId, prev);
    }
  };

  const handleTrackEnded = () => {
    if (loopMode === 'one') {
      setIframeKey((k) => k + 1);
      return;
    }
    handleNextTrack();
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (!event.data) return;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (data.event === 'infoDelivery' && data.info && data.info.videoData) {
          const ytVideoId = data.info.videoData.video_id;
          if (ytVideoId && ytVideoId !== internalYtVideoId.current) {
            internalYtVideoId.current = ytVideoId;
            skipNextReload.current = true;
            onVideoSelect(ytVideoId, undefined, activePlaylistId);
          }
        }

        if (data && (data.event === 'onStateChange' || data.info !== undefined)) {
          if (data.info === 0 || data.data === 0) {
            handleTrackEnded();
          }
        }
      } catch {
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mixVideos, videoId, loopMode, isShuffle, onVideoSelect]);

  const initLiveChat = (channelName: string) => {
    setLiveChatMessages([
      {
        id: 'system-1',
        author: 'システム',
        message: `${channelName} のライブ配信です。チャットメッセージを送信できます。`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        badge: '案内'
      }
    ]);
  };

  useEffect(() => {
    if (sidebarTab === 'liveChat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveChatMessages, sidebarTab]);

  const handleSendLiveMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLiveMessage.trim()) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setLiveChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        author: 'あなた',
        message: newLiveMessage.trim(),
        timestamp: timeStr,
        badge: 'あなた'
      }
    ]);
    setNewLiveMessage('');
  };

  const handleSendSuperChat = (e: React.FormEvent) => {
    e.preventDefault();
    const colors: Record<string, string> = {
      '500': 'bg-cyan-600',
      '1000': 'bg-emerald-600',
      '5000': 'bg-amber-600',
      '10000': 'bg-red-600',
    };
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setLiveChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        author: 'あなた',
        message: superChatMessage || '配信応援しています！🎉',
        timestamp: timeStr,
        isSuperChat: true,
        superChatAmount: `¥${parseInt(superChatAmount).toLocaleString()}`,
        superChatColor: colors[superChatAmount] || 'bg-emerald-600',
        badge: 'あなた'
      }
    ]);
    setShowSuperChatModal(false);
    setSuperChatMessage('');
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const commentObj: Comment = {
      id: Date.now().toString(),
      author: '自分 (Xeroxユーザー)',
      text: newComment.trim(),
      publishedTime: 'たった今',
      likeCount: '0'
    };
    setComments([commentObj, ...comments]);
    setNewComment('');
  };

  if (loading && !videoData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-3 bg-white text-gray-900">
        <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
        <span className="text-sm font-semibold text-gray-700">動画を読み込んでいます...</span>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-white text-gray-900 gap-3">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-lg font-bold">{error || '動画が見つかりませんでした'}</p>
      </div>
    );
  }

  const isLive = !!(videoData.isLive && !videoData.isPremiere && !videoData.isUpcoming);

  const isSubscribed = subscriptions.some(s => 
    s.id === videoData.authorId || s.title === videoData.author
  );

  const handleSubClick = () => {
    onToggleSubscribe({
      id: videoData.authorId || videoData.author,
      title: videoData.author,
      avatar: videoData.authorAvatar
    });
  };

  const pastHistoryVideos = watchHistory
    .filter(h => h.videoId !== videoId)
    .slice(0, 5)
    .map(h => ({
      videoId: h.videoId,
      title: h.title,
      author: h.author || 'チャンネル',
      authorAvatar: h.authorAvatar,
      videoThumbnails: [{ url: h.thumbnailUrl || `https://i.ytimg.com/vi/${h.videoId}/hqdefault.jpg`, width: 480, height: 360 }],
      viewCount: 0,
      publishedText: '視聴済み',
      lengthSeconds: 0,
      type: 'video'
    }));

  const blendedRecommendations: any[] = [];
  const baseRecs = videoData.recommendedVideos || [];

  const renderTextWithMentionsAndLinks = (text: string) => {
    if (!text) return '動画の概要説明はありません。';
    const regex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_\-\.]+)/g;
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {part}
          </a>
        );
      }
      if (/^@/.test(part)) {
        return (
          <button 
            key={i} 
            onClick={(e) => { e.stopPropagation(); onSelectChannel(part); }} 
            className="text-blue-600 hover:underline cursor-pointer"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderTitleWithMentions = (text: string) => {
    if (!text) return null;
    const regex = /(@[a-zA-Z0-9_\-\.]+)/g;
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (/^@/.test(part)) {
        return (
          <button 
            key={i} 
            onClick={(e) => { e.stopPropagation(); onSelectChannel(part); }} 
            className="text-blue-600 hover:underline cursor-pointer"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const hasMultipleChannels = Boolean(
    (videoData.channels && videoData.channels.length > 1) || 
    (videoData.multipleChannelIds && videoData.multipleChannelIds.length > 1)
  );

  const otherChannelsCount = videoData.channels && videoData.channels.length > 1
    ? videoData.channels.length - 1
    : (videoData.multipleChannelIds ? videoData.multipleChannelIds.length - 1 : 0);

  const handleAuthorClick = () => {
    if (hasMultipleChannels) {
      setShowCollaboratorModal(true);
    } else {
      onSelectChannel(videoData.authorId || videoData.author);
    }
  };

  let histIdx = 0;

  if (baseRecs.length === 0) {
    blendedRecommendations.push(...pastHistoryVideos);
  } else {
    baseRecs.forEach((item, index) => {
      blendedRecommendations.push(item);
      if ((index % 3 === 1) && histIdx < pastHistoryVideos.length) {
        blendedRecommendations.push(pastHistoryVideos[histIdx]);
        histIdx++;
      }
    });
    while (histIdx < pastHistoryVideos.length) {
      blendedRecommendations.push(pastHistoryVideos[histIdx]);
      histIdx++;
    }
  }

  return (
    <div className="flex-1 w-full max-w-[2400px] mx-auto p-2 sm:p-4 lg:p-6 flex flex-col md:flex-row gap-6 bg-white text-gray-900 min-h-[calc(100vh-3.5rem)]">
      
      <div className="flex-1 min-w-0 md:flex-[1_1_72%] lg:flex-[1_1_75%] xl:flex-[1_1_78%]">
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-200 relative max-h-[85vh]">
          <iframe
            ref={iframeRef}
            key={`youtube-player-${iframeKey}`}
            src={currentIframeSrc}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={videoData.title}
          ></iframe>
        </div>
        
        <div className="mt-4 flex flex-col">
          
          {isLive && (
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-xs animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                ライブ配信中
              </span>
              {videoData.liveViewerCount && videoData.liveViewerCount > 0 ? (
                <span className="text-xs text-gray-600 font-medium flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-full">
                  <Users size={13} className="text-gray-500" />
                  {formatNumberJP(videoData.liveViewerCount)} 人が視聴中
                </span>
              ) : null}
            </div>
          )}

          <h1 className="text-lg lg:text-xl font-bold text-gray-900 mb-3 leading-snug break-all">
            {renderTitleWithMentions(videoData.title)}
          </h1>
          
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectChannel(videoData.authorId || videoData.author)}
                className="hover:opacity-85 transition-opacity cursor-pointer shrink-0"
                title={`${videoData.author}のチャンネルを開く`}
              >
                <Avatar
                  src={videoData.authorAvatar}
                  name={videoData.author}
                  className="w-11 h-11 text-base shadow-xs"
                />
              </button>
              
              <div className="flex flex-col">
                <button
                  onClick={handleAuthorClick}
                  className="group/author flex items-center gap-1.5 text-left transition-colors duration-200 cursor-pointer active:scale-[0.98]"
                  title={hasMultipleChannels ? 'コラボレーターを表示' : `${videoData.author}のチャンネルを開く`}
                >
                  <h3 className="font-bold text-gray-900 text-[15px] group-hover/author:text-blue-600 transition-colors duration-200 tracking-tight leading-snug flex items-center gap-1 flex-wrap">
                    <span>{videoData.author}</span>
                    
                    <span className="w-3.5 h-3.5 bg-gray-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0">✓</span>
                  </h3>
                </button>
                {!hasMultipleChannels && (
                  <p className="text-xs font-normal text-gray-500 mt-0.5">
                    {videoData.subCount ? `登録者数 ${formatNumberJP(videoData.subCount)}人` : '登録者数 非公開'}
                  </p>
                )}
              </div>

              <button
                onClick={handleSubClick}
                className={`ml-3 px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 shadow-xs active:scale-95 cursor-pointer ${
                  isSubscribed 
                    ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200/80 flex items-center gap-1.5' 
                    : 'bg-gray-900 hover:bg-black text-white'
                }`}
              >
                {isSubscribed ? (
                  <>
                    <Bell size={13} className="text-gray-700" />
                    <span>登録済み</span>
                    <ChevronDown size={13} className="text-gray-500" />
                  </>
                ) : (
                  'チャンネル登録'
                )}
              </button>
            </div>

            
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center bg-gray-100 rounded-full p-0.5 border border-gray-200">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-200 rounded-l-full transition-colors">
                  <ThumbsUp size={15} />
                  <span>{formatNumberJP(videoData.likeCount || 0)}</span>
                </button>
                <div className="w-[1px] h-4 bg-gray-300"></div>
                <button className="px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-200 rounded-r-full transition-colors">
                  <ThumbsDown size={15} />
                </button>
              </div>

              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: videoData.title, url: window.location.href }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert('リンクをクリップボードにコピーしました！');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-xs font-semibold border border-gray-200 transition-colors"
              >
                <Share2 size={15} />
                <span>共有</span>
              </button>

              <button 
                onClick={handleDownload}
                disabled={downloading}
                title="動画をダウンロード"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 rounded-full text-xs font-semibold border border-gray-200 transition-colors disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 size={15} className="animate-spin text-red-600" />
                ) : (
                  <Download size={15} />
                )}
                <span>ダウンロード</span>
              </button>

              <button 
                onClick={handleReloadEduKey}
                disabled={refreshingEduKey || cooldownSec > 0}
                title={cooldownSec > 0 ? `再読み込みは${cooldownSec}秒後に可能になります` : "プレイヤーのEduKeyを再取得してプレイヤーを再読み込み"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 rounded-full text-xs font-semibold border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {refreshingEduKey ? (
                  <Loader2 size={15} className="animate-spin text-blue-600" />
                ) : (
                  <RotateCw size={15} className={cooldownSec > 0 ? "opacity-50" : ""} />
                )}
                <span>{cooldownSec > 0 ? `再読み込み (${cooldownSec}s)` : '再読み込み'}</span>
              </button>

              {onOpenAddToPlaylist && (
                <button 
                  onClick={() => onOpenAddToPlaylist(videoData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-xs font-semibold border border-gray-200 transition-colors"
                >
                  <Plus size={15} />
                  <span>保存</span>
                </button>
              )}

              {isLive && (
                <button
                  onClick={() => setShowSuperChatModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white rounded-full text-xs font-bold shadow-xs transition-all active:scale-95"
                >
                  <DollarSign size={14} />
                  <span>Super Chat</span>
                </button>
              )}
            </div>
          </div>

          
          <div className="mt-4 p-3.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl transition-colors text-sm border border-gray-200">
            <div className="flex items-center gap-3 font-semibold text-gray-800 text-xs mb-2">
              <span>{formatNumberJP(videoData.viewCount)} 回視聴</span>
              <span>{videoData.publishedText}</span>
              {isLive && <span className="text-red-600 font-bold">● リアルタイム配信</span>}
            </div>
            <div className="text-gray-700 whitespace-pre-wrap font-normal leading-relaxed text-xs sm:text-sm break-all">
              <div className={`${isDescExpanded ? '' : 'line-clamp-3'}`}>
                {renderTextWithMentionsAndLinks(videoData.description || '')}
              </div>
            </div>
            {videoData.description && videoData.description.length > 120 && (
              <button
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="mt-2 text-xs font-bold text-gray-900 hover:underline block"
              >
                {isDescExpanded ? '一部を表示' : 'もっと見る'}
              </button>
            )}
          </div>

          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare size={22} className="text-gray-900" />
              <h2 className="text-lg font-bold text-gray-900">
                コメント {comments.length}件
              </h2>
            </div>

            
            <form onSubmit={handleAddComment} className="flex gap-3 mb-8">
              <Avatar name="自分" className="w-10 h-10 text-sm border border-gray-300" />
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="コメントを追加..."
                  className="w-full border-b border-gray-300 focus:border-gray-900 outline-none py-1.5 text-sm bg-transparent font-normal text-gray-900 placeholder-gray-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewComment('')}
                    className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-full"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-full transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <Send size={12} />
                    <span>コメント</span>
                  </button>
                </div>
              </div>
            </form>

            
            {loadingComments ? (
              <div className="flex items-center gap-2 py-6 text-gray-500 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-medium">コメントを読み込み中...</span>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">まだコメントはありません。最初のコメントを投稿してみましょう！</p>
            ) : (
              <div className="flex flex-col gap-5">
                {comments.map((comment) => (
                  <CommentItem 
                    key={comment.id} 
                    comment={comment} 
                    onSelectChannel={onSelectChannel} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      
      <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[400px] shrink-0 flex flex-col gap-3">
        
        {isLive && (
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setSidebarTab('liveChat')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                  sidebarTab === 'liveChat' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Radio size={13} className="text-red-500 animate-pulse" />
                <span>チャット</span>
              </button>
              <button
                onClick={() => setSidebarTab('related')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                  sidebarTab === 'related' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>関連動画</span>
              </button>
            </div>
          </div>
        )}
        
        {isRelatedOpen && sidebarTab === 'liveChat' && (
          <div className="flex flex-col h-[580px] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>
                <span className="text-xs font-bold text-gray-900">ライブチャット</span>
              </div>
              <button
                onClick={() => setShowSuperChatModal(true)}
                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1 transition-colors"
              >
                <DollarSign size={12} />
                <span>Super Chat</span>
              </button>
            </div>

            
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
              {liveChatMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex items-start gap-2 ${
                    msg.isSuperChat 
                      ? `${msg.superChatColor || 'bg-emerald-600'} text-white p-2.5 rounded-lg shadow-xs` 
                      : 'hover:bg-gray-50 p-1 rounded transition-colors'
                  }`}
                >
                  <Avatar name={msg.author} className="w-6 h-6 text-[10px] shrink-0" />
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold truncate ${msg.isSuperChat ? 'text-white' : 'text-gray-700'}`}>
                        {msg.author}
                      </span>
                      {msg.badge && (
                        <span className="bg-blue-100 text-blue-800 text-[9px] px-1 py-0.2 rounded font-bold">
                          {msg.badge}
                        </span>
                      )}
                      {msg.isSuperChat && (
                        <span className="bg-white/30 text-white text-[10px] font-black px-1.5 rounded">
                          {msg.superChatAmount}
                        </span>
                      )}
                      <span className={`text-[10px] ml-auto ${msg.isSuperChat ? 'text-white/80' : 'text-gray-400'}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className={`mt-0.5 leading-snug break-words ${msg.isSuperChat ? 'text-white font-medium text-xs' : 'text-gray-900'}`}>
                      {msg.message}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            
            <form onSubmit={handleSendLiveMessage} className="p-2.5 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
              <input
                type="text"
                value={newLiveMessage}
                onChange={(e) => setNewLiveMessage(e.target.value)}
                placeholder="チャットメッセージを送信..."
                className="flex-1 bg-white border border-gray-300 rounded-full px-3.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={!newLiveMessage.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-full transition-colors shrink-0 shadow-xs"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}

        {isRelatedOpen && sidebarTab === 'related' && (
          <div className="flex flex-col gap-3">
            
            {Boolean(activePlaylistId && mixVideos.length > 0) && (
              <MixPlaylist
                currentVideoId={videoId}
                videos={mixVideos}
                playlistTitle={mixTitle}
                playlistSubtitle={mixSubtitle}
                isOpen={isMixOpen}
                onToggleOpen={() => setIsMixOpen((prev) => !prev)}
                onSelectVideo={(selId, selVideo) => {
                  if (selVideo) {
                    setVideoData(selVideo);
                  }
                  onVideoSelect(selId, selVideo);
                }}
                loopMode={loopMode}
                onCycleLoopMode={handleCycleLoopMode}
                isShuffle={isShuffle}
                onToggleShuffle={handleToggleShuffle}
                onNextTrack={handleNextTrack}
                onPrevTrack={handlePrevTrack}
              />
            )}

            
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {[
                { id: 'all', label: 'すべて' },
                { id: 'author', label: `提供: ${videoData?.author || 'チャンネル'}` },
                { id: 'related', label: '関連動画' },
                { id: 'recommended', label: 'おすすめ' },
                { id: 'recent', label: '最近アップロード' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setRelatedFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors text-xs ${
                    relatedFilter === chip.id
                      ? 'bg-gray-900 text-white font-bold'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            
            {blendedRecommendations.map((recVideo, idx) => {
              const isMix = recVideo.type === 'mix';
              const isPlaylist = isMix || recVideo.type === 'playlist' || Boolean(recVideo.playlistId);
              const effectiveVid = recVideo.videoId || (recVideo.playlistId && recVideo.playlistId.startsWith('RD') && recVideo.playlistId.length >= 13 ? recVideo.playlistId.substring(2, 13) : '');
              const thumbUrl = recVideo.videoThumbnails?.[0]?.url || (effectiveVid ? `https://i.ytimg.com/vi/${effectiveVid}/hqdefault.jpg` : '');

              return (
                <div 
                  key={`${recVideo.videoId}-${recVideo.playlistId || ''}-${idx}`} 
                  className="flex gap-2.5 group cursor-pointer"
                  onClick={() => {
                    if (isPlaylist) {
                      const pId = recVideo.playlistId || (effectiveVid ? `RD${effectiveVid}` : undefined);
                      if (pId) {
                        setActivePlaylistId(pId);
                        onVideoSelect(effectiveVid || recVideo.videoId || '', { ...recVideo, videoId: effectiveVid || recVideo.videoId, playlistId: pId });
                      } else {
                        onVideoSelect(recVideo.videoId || '', recVideo);
                      }
                    } else {
                      setActivePlaylistId(null);
                      setVideoData(recVideo);
                      onVideoSelect(recVideo.videoId || '', recVideo);
                    }
                  }}
                >
                  <div className="w-[160px] shrink-0 relative aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img 
                      src={thumbUrl || (effectiveVid ? `https://i.ytimg.com/vi/${effectiveVid}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=320&auto=format&fit=crop')}
                      alt={recVideo.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (effectiveVid && !target.src.includes('mqdefault')) {
                          target.src = `https://i.ytimg.com/vi/${effectiveVid}/mqdefault.jpg`;
                        }
                      }}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                    {isPlaylist && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle size={24} className="text-white fill-white/20" />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-white text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                      {isPlaylist ? (
                        <>
                          <ListMusic size={11} />
                          <span>{isMix ? 'MIX' : '再生リスト'}</span>
                        </>
                      ) : (
                        formatDuration(recVideo.lengthSeconds)
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden py-0.5 pr-1 flex-1">
                    <h4 className="font-semibold text-gray-900 leading-snug line-clamp-2 text-xs group-hover:text-blue-600 transition-colors">
                      {recVideo.title}
                    </h4>
                    <div className="flex flex-col text-[11px] text-gray-500 mt-1 font-normal">
                      <span className="truncate hover:text-gray-900 font-medium text-gray-700">{recVideo.author || 'チャンネル'}</span>
                      <div className="flex items-center gap-1">
                        {recVideo.viewCount > 0 && (
                          <span>{formatNumberJP(recVideo.viewCount)}回視聴</span>
                        )}
                        {recVideo.publishedText && (
                          <>
                            {recVideo.viewCount > 0 && <span className="text-[8px] opacity-50">•</span>}
                            <span>{recVideo.publishedText}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      
      {showSuperChatModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-500" size={20} />
                <h3 className="text-base font-bold text-gray-900">Super Chat を送信</h3>
              </div>
              <button 
                onClick={() => setShowSuperChatModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              {videoData.author} さんの配信にメッセージと応援を送ります。
            </p>

            
            <div className="grid grid-cols-4 gap-2">
              {[
                { amount: '500', color: 'border-cyan-500 bg-cyan-50 text-cyan-800' },
                { amount: '1000', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                { amount: '5000', color: 'border-amber-500 bg-amber-50 text-amber-800' },
                { amount: '10000', color: 'border-red-500 bg-red-50 text-red-800' },
              ].map((tier) => (
                <button
                  key={tier.amount}
                  type="button"
                  onClick={() => setSuperChatAmount(tier.amount)}
                  className={`py-2 px-1 rounded-xl font-bold text-xs border text-center transition-all ${
                    superChatAmount === tier.amount 
                      ? `${tier.color} ring-2 ring-blue-600 shadow-xs` 
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ¥{parseInt(tier.amount).toLocaleString()}
                </button>
              ))}
            </div>

            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">応援メッセージ</label>
              <textarea
                value={superChatMessage}
                onChange={(e) => setSuperChatMessage(e.target.value)}
                placeholder="配信最高です！応援してます！"
                rows={3}
                className="w-full border border-gray-300 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSuperChatModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-full"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSendSuperChat}
                className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-red-500 text-white rounded-full shadow-xs hover:from-amber-600 hover:to-red-600 transition-all active:scale-95"
              >
                ¥{parseInt(superChatAmount).toLocaleString()} で送信
              </button>
            </div>
          </div>
        </div>
      )}

      
      {showCollaboratorModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={() => setShowCollaboratorModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-[460px] w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">コラボレーター</h2>
              <button
                onClick={() => setShowCollaboratorModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-800 transition-colors duration-200 cursor-pointer"
                title="閉じる"
              >
                <X size={20} />
              </button>
            </div>

            
            <div className="overflow-y-auto divide-y divide-gray-100/90 pt-1 -mx-2 px-2">
              {(videoData.channels && videoData.channels.length > 0 ? videoData.channels : [
                {
                  id: videoData.authorId || '',
                  name: videoData.author,
                  avatar: videoData.authorAvatar,
                  handle: `@${videoData.author.replace(/[\s\/]/g, '_')}`,
                  subCountText: videoData.subCount ? `チャンネル登録者数 ${formatNumberJP(videoData.subCount)}人` : ''
                }
              ]).map((collab) => {
                const isCollabSubscribed = subscriptions.some(
                  s => s.id === collab.id || s.title === collab.name
                );

                return (
                  <div 
                    key={collab.id} 
                    className="flex items-center justify-between py-3.5 gap-3 hover:bg-gray-50/80 px-2.5 rounded-xl transition-colors duration-150"
                  >
                    
                    <div 
                      onClick={() => {
                        setShowCollaboratorModal(false);
                        onSelectChannel(collab.id || collab.name);
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group/item"
                    >
                      <Avatar
                        src={collab.avatar}
                        name={collab.name}
                        className="w-10 h-10 text-sm shadow-2xs shrink-0 ring-1 ring-gray-200/80 group-hover/item:opacity-90 transition-opacity"
                      />
                      <div className="flex flex-col min-w-0 pr-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gray-900 text-[14.5px] truncate group-hover/item:text-blue-600 transition-colors">
                            {collab.name}
                          </span>
                          <span className="w-3.5 h-3.5 bg-gray-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0">✓</span>
                        </div>
                        <p className="text-[12px] text-gray-500 truncate mt-0.5 font-normal">
                          {collab.handle ? `${collab.handle} ` : ''}
                          {collab.handle && collab.subCountText ? '・ ' : ''}
                          {collab.subCountText}
                        </p>
                      </div>
                    </div>

                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSubscribe({
                          id: collab.id,
                          title: collab.name,
                          avatar: collab.avatar || ''
                        });
                      }}
                      className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 active:scale-95 cursor-pointer ${
                        isCollabSubscribed
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 flex items-center gap-1.5 border border-gray-200/70'
                          : 'bg-black hover:bg-gray-800 text-white shadow-2xs'
                      }`}
                    >
                      {isCollabSubscribed ? (
                        <>
                          <Bell size={13} className="text-gray-700" />
                          <span>登録済み</span>
                          <ChevronDown size={13} className="text-gray-500" />
                        </>
                      ) : (
                        'チャンネル登録'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
