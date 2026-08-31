import fs from 'fs';
const content = `import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Volume2, VolumeX, Loader2, Music } from 'lucide-react';
import { ShortVideo, ChannelSubscription } from '../types';
import Avatar from './Avatar';

interface ShortsPlayerProps {
  shortsList: ShortVideo[];
  loading: boolean;
  subscriptions: ChannelSubscription[];
  onToggleSubscribe: (channel: ChannelSubscription) => void;
  onRecordShortHistory?: (short: ShortVideo) => void;
  onSelectChannel: (channelId: string) => void;
}

export default function ShortsPlayer({
  shortsList,
  loading,
  subscriptions,
  onToggleSubscribe,
  onRecordShortHistory,
  onSelectChannel
}: ShortsPlayerProps) {
  const [isMuted, setIsMuted] = useState(true); // TikTok like UX: start muted for safety or unmuted depending on browser policy
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  
  // Create intersection observer to play/pause videos based on visibility
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          video.play().catch(() => {
            console.log("Auto-play blocked. Please interact with the page.");
          });
          // record history
          const vidId = video.getAttribute('data-id');
          if (vidId && onRecordShortHistory) {
            const short = shortsList.find(s => s.videoId === vidId);
            if (short) onRecordShortHistory(short);
          }
        } else {
          video.pause();
          video.currentTime = 0; // Rewind when out of view
        }
      });
    }, { threshold: 0.6 }); // 60% visible

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [shortsList, onRecordShortHistory]);

  const toggleLike = (id: string) => {
    setLiked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const videoRefCallback = (el: HTMLVideoElement | null) => {
    if (el && observer.current) {
      observer.current.observe(el);
    }
  };

  if (loading && shortsList.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-black text-white gap-3">
        <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
        <p className="text-sm font-semibold">Shortsを準備中...</p>
      </div>
    );
  }

  if (shortsList.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-black text-white">
        <p className="text-base font-bold">Shorts動画が見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#1a1a1a] sm:bg-gray-100 flex justify-center">
      {/* 縦スクロール用コンテナ: CSS Scroll Snap */}
      <div 
        className="w-full sm:w-auto h-[calc(100vh-3.5rem)] overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        style={{ scrollBehavior: 'smooth' }}
      >
        {shortsList.map((short) => {
          const isSubscribed = subscriptions.some(s => s.id === short.authorId || s.title === short.author);
          
          return (
            <div 
              key={short.videoId} 
              className="w-full sm:w-[400px] h-[calc(100vh-3.5rem)] snap-start snap-always relative flex items-center justify-center sm:py-6"
            >
              {/* 動画プレイヤー本体 */}
              <div className="relative w-full h-full sm:h-[90%] sm:rounded-2xl overflow-hidden bg-black shadow-2xl sm:border sm:border-gray-800">
                <video
                  ref={videoRefCallback}
                  data-id={short.videoId}
                  src={\`/api/video/\${short.videoId}/stream\`}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  muted={isMuted}
                  poster={short.thumbnail}
                  onClick={(e) => {
                    const v = e.currentTarget;
                    if (v.paused) v.play();
                    else v.pause();
                  }}
                />

                {/* ミュート切り替えボタン */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute top-4 right-4 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all z-20"
                  title={isMuted ? "ミュート解除" : "ミュート"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                {/* 下部情報 */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 sm:p-5 pt-16 flex flex-col gap-3 text-white z-10">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => onSelectChannel(short.authorId || short.author)} className="hover:opacity-80 transition-opacity">
                      <Avatar src={short.authorAvatar} name={short.author} className="w-9 h-9 text-xs border border-white/30" />
                    </button>
                    <button onClick={() => onSelectChannel(short.authorId || short.author)} className="font-bold text-sm text-white hover:underline truncate max-w-[140px]">
                      @{short.author}
                    </button>
                    <button
                      onClick={() => onToggleSubscribe({ id: short.authorId || short.author, title: short.author, avatar: short.authorAvatar })}
                      className={\`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm \${isSubscribed ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md' : 'bg-white text-black hover:bg-gray-200'}\`}
                    >
                      {isSubscribed ? '登録済み' : 'チャンネル登録'}
                    </button>
                  </div>
                  <p className="text-sm font-medium line-clamp-2 leading-snug drop-shadow-sm">{short.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-300 font-medium pt-1">
                    <Music size={13} className="animate-pulse" />
                    <span className="truncate">オリジナル音声 - {short.author}</span>
                  </div>
                </div>

                {/* 右側アクションボタン群 (絶対配置) */}
                <div className="absolute right-2 sm:right-[-60px] bottom-20 flex flex-col gap-5 items-center sm:hidden">
                    <button onClick={() => toggleLike(short.videoId)} className="flex flex-col items-center gap-1 group">
                      <div className={\`p-3 rounded-full transition-colors \${liked[short.videoId] ? 'bg-red-600 text-white' : 'bg-black/50 hover:bg-black/70 text-white backdrop-blur-md'}\`}>
                        <ThumbsUp size={22} className={liked[short.videoId] ? 'fill-current' : ''} />
                      </div>
                      <span className="text-xs font-bold drop-shadow-md text-white">{short.likeCount || '10万'}</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 group">
                      <div className="p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md">
                        <MessageSquare size={22} />
                      </div>
                      <span className="text-xs font-bold drop-shadow-md text-white">{short.commentCount || '520'}</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 group">
                      <div className="p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md">
                        <Share2 size={22} />
                      </div>
                      <span className="text-xs font-bold drop-shadow-md text-white">共有</span>
                    </button>
                </div>
              </div>

              {/* 右側アクションボタン群 (デスクトップ版では動画の外に配置) */}
              <div className="hidden sm:flex flex-col gap-5 items-center justify-end h-full pb-8 ml-4">
                <button onClick={() => toggleLike(short.videoId)} className="flex flex-col items-center gap-1 group">
                  <div className={\`p-3 rounded-full transition-colors \${liked[short.videoId] ? 'bg-red-600 text-white' : 'bg-white hover:bg-gray-200 text-gray-800 shadow-md border border-gray-200'}\`}>
                    <ThumbsUp size={22} className={liked[short.videoId] ? 'fill-current' : ''} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{short.likeCount || '10万'}</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                  <div className="p-3 bg-white hover:bg-gray-200 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200">
                    <ThumbsDown size={22} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">低評価</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                  <div className="p-3 bg-white hover:bg-gray-200 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200">
                    <MessageSquare size={22} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{short.commentCount || '520'}</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                  <div className="p-3 bg-white hover:bg-gray-200 text-gray-800 rounded-full transition-colors shadow-md border border-gray-200">
                    <Share2 size={22} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">共有</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/ShortsPlayer.tsx', content);
