import React, { useEffect, useState, useRef } from 'react';
import { Video, Comment, ChannelSubscription, WatchHistoryItem } from '../types';
import { formatNumberJP, formatDuration, fetchJSON } from '../utils';
import { localAI } from '../lib/intelligence';
import { 
  ThumbsUp, ThumbsDown, Share2, AlertCircle, Loader2, 
  ChevronDown, ChevronUp, MessageSquare, Send, Plus, 
  ListMusic, Radio, Users, DollarSign, Sparkles, History, Smile, Download, RotateCw, X,
  SkipForward, SkipBack, Play, Shuffle, Repeat
} from 'lucide-react';

interface MixItem {
  index: number;
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  lengthText: string;
  selected: boolean;
}

interface MixPlaylistData {
  title: string;
  playlistId: string;
  currentVideoId: string;
  items: MixItem[];
}
import Avatar from './Avatar';

interface CommentItemProps {
  comment: Comment;
  onSelectChannel: (channelIdOrName: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, onSelectChannel }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 3行以上または長いテキストの判定
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
  onVideoSelect: (id: string, video?: Video) => void;
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

  // ミックスリスト State
  const [mixPlaylist, setMixPlaylist] = useState<MixPlaylistData | null>(null);
  const [loadingMixPlaylist, setLoadingMixPlaylist] = useState(false);
  const [mixExpanded, setMixExpanded] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ミックスリストデータ取得
  useEffect(() => {
    if (playlistId || (videoId && videoId.startsWith('RD'))) {
      setLoadingMixPlaylist(true);
      const targetPlaylistId = playlistId || (videoId.startsWith('RD') ? videoId : `RD${videoId}`);
      fetchJSON(`/api/mix-playlist?videoId=${videoId || ''}&playlistId=${targetPlaylistId || ''}`)
        .then((data) => {
          if (data && data.items && data.items.length > 0) {
            setMixPlaylist(data);
          } else {
            setMixPlaylist(null);
          }
        })
        .catch((err) => {
          console.error('Failed to load mix playlist', err);
          setMixPlaylist(null);
        })
        .finally(() => {
          setLoadingMixPlaylist(false);
        });
    } else {
      setMixPlaylist(null);
    }
  }, [videoId, playlistId]);

  const currentMixIndex = mixPlaylist?.items.findIndex(item => item.videoId === videoId) ?? -1;
  const hasNextMixItem = mixPlaylist && currentMixIndex !== -1 && currentMixIndex < mixPlaylist.items.length - 1;
  const hasPrevMixItem = mixPlaylist && currentMixIndex > 0;

  const handlePlayNextMix = () => {
    if (mixPlaylist && currentMixIndex !== -1 && currentMixIndex < mixPlaylist.items.length - 1) {
      const nextItem = mixPlaylist.items[currentMixIndex + 1];
      onVideoSelect(nextItem.videoId, {
        videoId: nextItem.videoId,
        title: nextItem.title,
        author: nextItem.author,
        playlistId: mixPlaylist.playlistId,
        type: 'mix'
      } as any);
    }
  };

  const handlePlayPrevMix = () => {
    if (mixPlaylist && currentMixIndex > 0) {
      const prevItem = mixPlaylist.items[currentMixIndex - 1];
      onVideoSelect(prevItem.videoId, {
        videoId: prevItem.videoId,
        title: prevItem.title,
        author: prevItem.author,
        playlistId: mixPlaylist.playlistId,
        type: 'mix'
      } as any);
    }
  };

  // EduKey 取得
  useEffect(() => {
    const fetchEduKey = async () => {
      try {
        const res = await fetchJSON('/api/edukey');
        if (res && res.key) {
          // ensure enablejsapi is present for postMessage tracking
          let key = res.key;
          if (!key.includes('enablejsapi=1')) {
            key += '&enablejsapi=1';
          }
          setEduKey(key);
        }
      } catch (e) {
        console.error('Failed to load edukey:', e);
      }
    };
    fetchEduKey();
  }, []);

  // IFrame の内部遷移（プレイリストの次の動画など）を検知する
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (data && typeof data === 'object') {
          // video_id の変更検知
          const playerVideoId = data.info?.videoData?.video_id || data.info?.videoId || data.videoId;
          if (playerVideoId && typeof playerVideoId === 'string' && playerVideoId !== videoId && playerVideoId.length >= 8) {
            onVideoSelect(playerVideoId);
          }
          // 動画再生終了 (onStateChange === 0) でミックスリストの次の曲へ自動遷移
          if (data.event === 'onStateChange' && (data.info === 0 || data.info?.playerState === 0)) {
            if (mixPlaylist && currentMixIndex !== -1 && currentMixIndex < mixPlaylist.items.length - 1) {
              const nextItem = mixPlaylist.items[currentMixIndex + 1];
              onVideoSelect(nextItem.videoId, {
                videoId: nextItem.videoId,
                title: nextItem.title,
                author: nextItem.author,
                playlistId: mixPlaylist.playlistId,
                type: 'mix'
              } as any);
            }
          }
        }
      } catch (e) {
        // parsing error ignored
      }
    };

    window.addEventListener('message', handleMessage);

    // プレイヤーにイベントの送信を要求する
    const timer = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: 'listening',
          id: 1,
          channel: 'widget'
        }), '*');
      }
    }, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(timer);
    };
  }, [videoId, onVideoSelect]);

  // 再読み込みボタンのクールダウンカウントダウン
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  // EduKey 再取得・プレイヤー再読み込み
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

  // ドキュメントタイトルの更新 (動画表示時: タイトル - XeroxYT-NTv6)
  useEffect(() => {
    if (videoData && videoData.title) {
      document.title = `${videoData.title} - XeroxYT-NTv6`;
    }
  }, [videoData]);

  // ダウンロード処理 (https://min-plum.vercel.app/360/G5fbV3KefbQ プロキシ経由)
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

  // Watch duration tracker
  const watchSecondsRef = useRef<number>(0);
  const activeVideoRef = useRef<Video | null>(null);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Live Chat state
  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>([]);
  const [newLiveMessage, setNewLiveMessage] = useState('');
  const [showSuperChatModal, setShowSuperChatModal] = useState(false);
  const [superChatAmount, setSuperChatAmount] = useState('1000');
  const [superChatMessage, setSuperChatMessage] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [showMultiChannelDialog, setShowMultiChannelDialog] = useState(false);
  const [multiChannelsLoading, setMultiChannelsLoading] = useState(false);
  const [multiChannelsData, setMultiChannelsData] = useState<any[]>([]);

  useEffect(() => {
    if (videoData?.multipleChannelIds && videoData.multipleChannelIds.length > 1) {
      setMultiChannelsLoading(true);
      Promise.all(
        videoData.multipleChannelIds.map((id: string) => 
          fetch(`/api/channel/${id}`).then(res => res.ok ? res.json() : null)
        )
      ).then(channels => {
        setMultiChannelsData(channels.filter(Boolean));
        setMultiChannelsLoading(false);
      }).catch(err => {
        console.error('Failed to load multi channels', err);
        setMultiChannelsLoading(false);
      });
    } else {
      setMultiChannelsData([]);
    }
  }, [videoData?.multipleChannelIds]);

  // Track video viewing duration for recommendation AI
  useEffect(() => {
    watchSecondsRef.current = 0;
    const interval = setInterval(() => {
      watchSecondsRef.current += 1;
      // Periodic engagement update every 20 seconds
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

  // Fetch video metadata
  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJSON(`/api/video/${videoId}`);
        setVideoData(data);
        activeVideoRef.current = data;
        
        // Local Intelligence Analysis
        if (data) {
          localAI.processVideoInteraction(data, 1.5);
          if (onRecordHistory) {
            onRecordHistory(data);
          }
        }
        if (onCacheVideo && data) {
          onCacheVideo(data);
        }

        // If it's a real live stream, auto-switch sidebar to live chat
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

  // Initialize live chat
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

  if (loading) {
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

  // 過去の視聴履歴（現在再生中の動画を除く最大5件）
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

  // 通常の関連動画リストの中にしれっと過去履歴をブレンド
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

  const handleAuthorClick = () => {
    if (videoData.multipleChannelIds && videoData.multipleChannelIds.length > 1) {
      setShowMultiChannelDialog(true);
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
      // 2つ目、5つ目、8つ目... の位置にしれっと履歴動画を差し込む
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
      {/* メイン動画プレイヤーセクション */}
      <div className="flex-1 min-w-0 md:flex-[1_1_72%] lg:flex-[1_1_75%] xl:flex-[1_1_78%]">
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-200 relative max-h-[85vh]">
          <iframe
            ref={iframeRef}
            src={playlistId && !videoId 
              ? `https://www.youtubeeducation.com/embed/videoseries?list=${playlistId}&autoplay=1${eduKey}`
              : `https://www.youtubeeducation.com/embed/${videoId}${eduKey ? eduKey : '?autoplay=1&enablejsapi=1'}${playlistId ? `&list=${playlistId}` : ''}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={videoData.title}
          ></iframe>
        </div>
        
        <div className="mt-4 flex flex-col">
          {/* 実際のライブ配信時のみバッジを表示 */}
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
            {/* チャンネル情報 */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleAuthorClick}
                className="hover:opacity-80 transition-opacity"
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
                  className="flex items-center gap-1 text-left hover:underline"
                >
                  <h3 className="font-bold text-gray-900 text-[15px]">{videoData.author}</h3>
                  <span className="w-3.5 h-3.5 bg-gray-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0">✓</span>
                  {videoData.multipleChannelIds && videoData.multipleChannelIds.length > 1 && (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                  )}
                </button>
                {(!videoData.multipleChannelIds || videoData.multipleChannelIds.length <= 1) && (
                  <p className="text-xs font-normal text-gray-500">
                    {videoData.subCount ? `登録者数 ${formatNumberJP(videoData.subCount)}人` : '登録者数 非公開'}
                  </p>
                )}
              </div>

              <button
                onClick={handleSubClick}
                className={`ml-4 px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 shadow-xs active:scale-95 ${
                  isSubscribed 
                    ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200' 
                    : 'bg-gray-900 hover:bg-black text-white'
                }`}
              >
                {isSubscribed ? '登録済み' : 'チャンネル登録'}
              </button>
            </div>

            {/* アクションボタン */}
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

          {/* 概要欄 */}
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

          {/* コメントセクション */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare size={22} className="text-gray-900" />
              <h2 className="text-lg font-bold text-gray-900">
                コメント {comments.length}件
              </h2>
            </div>

            {/* コメントフォーム */}
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

            {/* コメント一覧 */}
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
      
      {/* 関連動画 & ライブチャット サイドバー */}
      <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[400px] shrink-0 flex flex-col gap-3">
        {/* サイドバーヘッダー・タブ切替（ライブ時のみ表示） */}
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
            {/* チャットヘッダー */}
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

            {/* チャットメッセージスクロール領域 */}
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

            {/* チャット送信フォーム */}
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
            {/* YouTube公式スタイル ミックスリスト（再生リスト）パネル */}
            {(playlistId || videoId?.startsWith('RD') || mixPlaylist) && (
              <div className="mb-2 bg-gray-900 text-white rounded-2xl overflow-hidden shadow-xl border border-gray-800">
                {/* ヘッダー情報 */}
                <div className="p-3.5 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-850 border-b border-gray-800 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-bold uppercase tracking-wider">
                        <ListMusic size={14} />
                        <span>YouTube ミックスリスト</span>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate mt-0.5">
                        {mixPlaylist?.title || videoData?.title || 'ミックスリスト'}
                      </h3>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {videoData?.author || '関連チャンネル'} • {mixPlaylist?.items?.length || 25} 本の動画
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMixExpanded(!mixExpanded)}
                      className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors shrink-0"
                      title={mixExpanded ? 'パネルを折りたたむ' : 'パネルを展開'}
                    >
                      {mixExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {/* ナビゲーション・コントロールボタン */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-800/80">
                    <span className="text-[11px] text-gray-400 font-medium">
                      {currentMixIndex >= 0 ? `${currentMixIndex + 1} / ${mixPlaylist?.items?.length || 25}` : '再生中'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePlayPrevMix}
                        disabled={!hasPrevMixItem}
                        className="p-1.5 hover:bg-gray-800 disabled:opacity-30 rounded-lg text-gray-300 hover:text-white transition-colors"
                        title="前の動画"
                      >
                        <SkipBack size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={handlePlayNextMix}
                        disabled={!hasNextMixItem}
                        className="p-1.5 hover:bg-gray-800 disabled:opacity-30 rounded-lg text-gray-300 hover:text-white transition-colors"
                        title="次の動画"
                      >
                        <SkipForward size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 動画リスト (YouTub公式ミックスリスト一覧) */}
                {mixExpanded && (
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-800/60 custom-scrollbar">
                    {loadingMixPlaylist && (!mixPlaylist || mixPlaylist.items.length === 0) ? (
                      <div className="p-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <Loader2 className="animate-spin text-blue-400" size={16} />
                        <span>ミックスリストを読み込み中...</span>
                      </div>
                    ) : mixPlaylist?.items && mixPlaylist.items.length > 0 ? (
                      mixPlaylist.items.map((item, idx) => {
                        const isCurrent = item.videoId === videoId;
                        return (
                          <div
                            key={`${item.videoId}-${idx}`}
                            onClick={() => {
                              onVideoSelect(item.videoId, {
                                videoId: item.videoId,
                                title: item.title,
                                author: item.author,
                                playlistId: mixPlaylist.playlistId,
                                type: 'mix'
                              } as any);
                            }}
                            className={`flex items-center gap-2.5 p-2.5 transition-colors cursor-pointer group ${
                              isCurrent
                                ? 'bg-blue-600/25 text-white font-medium border-l-4 border-blue-500'
                                : 'hover:bg-gray-800/80 text-gray-300'
                            }`}
                          >
                            {/* 番号 or 再生中アイコン */}
                            <div className="w-5 text-center shrink-0 text-xs font-bold text-gray-400">
                              {isCurrent ? (
                                <span className="text-blue-400 animate-pulse text-xs">▶</span>
                              ) : (
                                <span className="text-[11px]">{idx + 1}</span>
                              )}
                            </div>

                            {/* サムネイル */}
                            <div className="w-16 h-10 shrink-0 relative rounded overflow-hidden bg-gray-800 border border-gray-700/60">
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              {item.lengthText && (
                                <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 rounded font-semibold">
                                  {item.lengthText}
                                </span>
                              )}
                            </div>

                            {/* タイトル ＆ 投稿者 */}
                            <div className="flex flex-col min-w-0 flex-1">
                              <h4 className={`text-xs leading-snug truncate ${isCurrent ? 'font-bold text-blue-300' : 'group-hover:text-white'}`}>
                                {item.title}
                              </h4>
                              <span className="text-[10px] text-gray-400 truncate mt-0.5">
                                {item.author}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-400">
                        再生リストの動画を取得できませんでした
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* カテゴリフィルターチップ（ユーザー添付の画像スタイル） */}
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

            {/* 関連動画リスト（履歴動画もしれっとブレンド） */}
            {blendedRecommendations.map((recVideo, idx) => (
              <div 
                key={`${recVideo.videoId}-${recVideo.playlistId || ''}-${idx}`} 
                className="flex gap-2.5 group cursor-pointer"
                onClick={() => onVideoSelect(recVideo.videoId || '', recVideo)}
              >
                <div className="w-[160px] shrink-0 relative aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img 
                    src={recVideo.videoThumbnails?.[0]?.url || (recVideo.videoId ? `https://i.ytimg.com/vi/${recVideo.videoId}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=320&auto=format&fit=crop')}
                    alt={recVideo.title}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-medium flex items-center gap-1">
                    {recVideo.type === 'mix' || recVideo.type === 'playlist' ? (
                      <ListMusic size={10} />
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
                      {recVideo.type === 'mix' || recVideo.type === 'playlist' ? (
                        <span className="text-red-600 font-bold uppercase text-[9px] bg-red-50 px-1 rounded border border-red-100">
                          {recVideo.type === 'mix' ? 'MIX' : 'PLAYLIST'}
                        </span>
                      ) : recVideo.viewCount > 0 ? (
                        <span>{formatNumberJP(recVideo.viewCount)}回視聴</span>
                      ) : null}
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
            ))}
          </div>
        )}
      </div>

      {/* Super Chat Modal */}
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

            {/* 金額選択 */}
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

            {/* メッセージ入力 */}
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

      {/* Multi Channel Selection Modal */}
      {showMultiChannelDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 flex flex-col gap-4 relative max-h-[80vh]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">チャンネルを選択</h2>
              <button
                onClick={() => setShowMultiChannelDialog(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-1 -mr-1 flex flex-col gap-2">
              {multiChannelsLoading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                </div>
              ) : multiChannelsData.length > 0 ? (
                multiChannelsData.map((channel, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setShowMultiChannelDialog(false);
                      onSelectChannel(channel.authorId || channel.id);
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
                  >
                    <Avatar
                      src={channel.avatar || channel.authorAvatar || (channel.avatar?.[0]?.url)}
                      name={channel.title || channel.author || channel.name}
                      className="w-12 h-12 shadow-sm shrink-0"
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold text-gray-900 text-sm truncate">
                        {channel.title || channel.author || channel.name}
                      </span>
                      {(channel.subCountText || channel.subCount) && (
                        <span className="text-xs text-gray-500">
                          {channel.subCountText || channel.subCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center p-4">チャンネル情報を読み込めませんでした。</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
