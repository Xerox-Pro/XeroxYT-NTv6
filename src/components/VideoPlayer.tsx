import React, { useEffect, useState } from 'react';
import { Video, Comment, ChannelSubscription } from '../types';
import { formatNumberJP, formatDuration, fetchJSON } from '../utils';
import { localAI } from '../lib/intelligence';
import { ThumbsUp, ThumbsDown, Share2, AlertCircle, Loader2, Bell, ChevronDown, ChevronUp, Download, Heart, MessageSquare, Send, Plus, ListMusic } from 'lucide-react';
import Avatar from './Avatar';

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
  onCacheVideo
}: VideoPlayerProps) {
  const [videoData, setVideoData] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRelatedOpen, setIsRelatedOpen] = useState(true);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJSON(`/api/video/${videoId}`);
        setVideoData(data);
        
        // Local Intelligence Analysis
        if (data) {
          localAI.processVideoInteraction(data, 1.5); // Play is a strong signal
          if (onRecordHistory) {
            onRecordHistory(data);
          }
        }
        if (onCacheVideo && data) {
          onCacheVideo(data);
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
        
        // Local Intelligence Context Analysis
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

  return (
    <div className="flex-1 max-w-[1800px] mx-auto p-4 lg:p-6 flex flex-col xl:flex-row gap-6 bg-white text-gray-900 min-h-[calc(100vh-3.5rem)]">
      {/* メイン動画プレイヤーセクション */}
      <div className="flex-1 min-w-0">
        <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-md border border-gray-200">
          <iframe
            src={playlistId && !videoId 
              ? `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&autoplay=1`
              : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1${playlistId ? `&list=${playlistId}` : ''}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={videoData.title}
          ></iframe>
        </div>
        
        <div className="mt-4 flex flex-col">
          <h1 className="text-lg lg:text-xl font-bold text-gray-900 mb-3 leading-snug">
            {videoData.title}
          </h1>
          
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
            {/* チャンネル情報 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectChannel(videoData.authorId || videoData.author)}
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
                  onClick={() => onSelectChannel(videoData.authorId || videoData.author)}
                  className="flex items-center gap-1 text-left hover:underline"
                >
                  <h3 className="font-bold text-gray-900 text-[15px]">{videoData.author}</h3>
                  <span className="w-3.5 h-3.5 bg-gray-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">✓</span>
                </button>
                <p className="text-xs font-normal text-gray-500">
                  {videoData.subCount ? `登録者数 ${formatNumberJP(videoData.subCount)}人` : '登録者数 非公開'}
                </p>
              </div>

              <button
                onClick={handleSubClick}
                className={`ml-4 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-xs ${
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
            
            {/* アクションボタン群 */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 select-none">
              <div className="flex items-center bg-gray-100 rounded-full h-10 border border-gray-200">
                <button className="flex items-center gap-1.5 px-4 hover:bg-gray-200 transition-colors h-full rounded-l-full font-bold text-gray-800 text-sm">
                  <ThumbsUp size={18} strokeWidth={2} />
                  <span>{videoData.likeCount ? formatNumberJP(videoData.likeCount) : '高評価'}</span>
                </button>
                <div className="w-[1px] h-6 bg-gray-300"></div>
                <button className="flex items-center gap-1.5 px-3 hover:bg-gray-200 transition-colors h-full rounded-r-full font-bold text-gray-800 text-sm">
                  <ThumbsDown size={18} strokeWidth={2} />
                </button>
              </div>
              
              {onOpenAddToPlaylist && (
                <button
                  onClick={() => onOpenAddToPlaylist(videoData)}
                  className="flex items-center gap-1.5 px-4 h-10 bg-black hover:bg-gray-800 text-white border border-black transition-colors rounded-full font-bold text-sm shrink-0 shadow-2xs"
                >
                  <Plus size={18} strokeWidth={2.5} />
                  <span>保存</span>
                </button>
              )}

              <button className="flex items-center gap-2 px-4 h-10 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors rounded-full font-bold text-gray-800 text-sm shrink-0">
                <Share2 size={18} strokeWidth={2} />
                <span>共有</span>
              </button>
              
              <button className="flex items-center gap-2 px-4 h-10 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors rounded-full font-bold text-gray-800 text-sm shrink-0">
                <Download size={18} strokeWidth={2} />
                <span>オフライン</span>
              </button>

              <button className="flex items-center gap-2 px-4 h-10 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors rounded-full font-bold text-gray-800 text-sm shrink-0">
                <Heart size={18} strokeWidth={2} className="text-red-500" />
                <span>Thanks</span>
              </button>
            </div>
          </div>
          
          {/* 概要欄 */}
          <div 
            onClick={() => setIsDescExpanded(!isDescExpanded)}
            className="mt-4 bg-gray-100 hover:bg-gray-200/80 transition-all duration-200 rounded-xl p-4 text-sm text-gray-900 cursor-pointer select-none"
          >
            <div className="font-bold text-gray-900 mb-1.5 flex items-center justify-between">
              <span>{formatNumberJP(videoData.viewCount)}回視聴 • {videoData.publishedText || '投稿日不明'}</span>
            </div>
            <p className={`whitespace-pre-wrap leading-relaxed font-normal text-gray-700 transition-all ${isDescExpanded ? '' : 'line-clamp-3'}`}>
              {videoData.description || '動画の概要説明はありません。'}
            </p>
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
                  <div key={comment.id} className="flex gap-3 text-sm">
                    <Avatar src={comment.authorAvatar} name={comment.author} className="w-9 h-9 text-xs" />
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs">{comment.author}</span>
                        <span className="text-[11px] text-gray-500">{comment.publishedTime}</span>
                      </div>
                      <p className="text-gray-800 text-sm font-normal leading-normal whitespace-pre-wrap">
                        {comment.text}
                      </p>
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 関連動画サイドバー */}
      <div className={`w-full xl:w-[380px] shrink-0 flex flex-col gap-4 ${isRelatedOpen ? '' : 'xl:w-auto'}`}>
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h3 className="font-bold text-gray-900 text-base">関連動画</h3>
          <button 
            onClick={() => setIsRelatedOpen(!isRelatedOpen)} 
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors shrink-0 text-gray-800 border border-gray-200"
            title={isRelatedOpen ? "関連動画を折りたたむ" : "関連動画を展開する"}
          >
            {isRelatedOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
        
        {isRelatedOpen && (
          <div className="flex flex-col gap-3">
            {videoData.recommendedVideos?.map((recVideo) => (
              <div 
                key={`${recVideo.videoId}-${recVideo.playlistId || ''}`} 
                className="flex gap-2 group cursor-pointer"
                onClick={() => onVideoSelect(recVideo.videoId || '', recVideo)}
              >
                <div className="w-[160px] shrink-0 relative aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img 
                    src={recVideo.videoThumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=320&auto=format&fit=crop'}
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
                    <span className="truncate hover:text-gray-900">{recVideo.author || 'YouTube'}</span>
                    <div className="flex items-center gap-1">
                      {recVideo.type === 'mix' || recVideo.type === 'playlist' ? (
                        <span className="text-red-600 font-bold uppercase text-[9px] bg-red-50 px-1 rounded border border-red-100">
                          {recVideo.type === 'mix' ? 'MIX' : 'PLAYLIST'}
                        </span>
                      ) : (
                        <span>{formatNumberJP(recVideo.viewCount)}回視聴</span>
                      )}
                      {recVideo.publishedText && (
                        <>
                          <span className="text-[8px] opacity-50">•</span>
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
    </div>
  );
}
