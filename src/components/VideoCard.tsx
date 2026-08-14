import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { formatNumberJP, formatDuration } from '../utils';
import { PlayCircle, ListMusic } from 'lucide-react';
import Avatar from './Avatar';

interface VideoCardProps {
  video: Video;
  onClick: () => void;
  onSelectChannel?: (channelIdOrName: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, onSelectChannel }) => {
  const isPlaylist = video.type === 'playlist' || video.type === 'mix' || !!video.playlistId;
  const initialThumb = video.videoThumbnails?.[0]?.url || (video.videoId ? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg` : '');
  const [imgSrc, setImgSrc] = useState(initialThumb);

  useEffect(() => {
    setImgSrc(video.videoThumbnails?.[0]?.url || (video.videoId ? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg` : ''));
  }, [video]);

  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectChannel) {
      onSelectChannel(video.authorId || video.author);
    }
  };

  const handleImgError = () => {
    if (video.videoId) {
      setImgSrc(`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`);
    } else {
      setImgSrc('https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=640&auto=format&fit=crop');
    }
  };

  return (
    <div className="group cursor-pointer flex flex-col transition-transform duration-200 ease-out active:scale-[0.98] select-none">
      {/* 16:9 サムネイルカード */}
      <div 
        onClick={onClick}
        className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200/80 shadow-2xs group-hover:shadow-md transition-all duration-300"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            onError={handleImgError}
            alt={video.title}
            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <PlayCircle className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {isPlaylist ? (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ListMusic className="text-white w-10 h-10 mb-2" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">すべての動画を再生</span>
          </div>
        ) : null}

        <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-xs text-white text-[11px] px-1.5 py-0.5 rounded font-semibold tracking-wide flex items-center gap-1">
          {isPlaylist ? (
            <>
              <ListMusic size={12} />
              <span>{video.type === 'mix' ? 'MIX' : 'PLAYLIST'}</span>
            </>
          ) : (
            formatDuration(video.lengthSeconds)
          )}
        </div>
      </div>
      
      {/* 情報エリア */}
      <div className="mt-3 flex items-start space-x-3">
        <button 
          onClick={handleChannelClick}
          className="shrink-0 hover:opacity-80 transition-opacity mt-0.5"
          title={`${video.author}のチャンネルを開く`}
        >
          <Avatar 
            src={video.authorAvatar} 
            name={video.author} 
            className="w-9 h-9 text-sm ring-1 ring-gray-200" 
          />
        </button>

        <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
          <h3 
            onClick={onClick}
            className="font-semibold text-gray-900 leading-snug line-clamp-2 text-[14px] sm:text-[15px] group-hover:text-blue-600 transition-colors"
          >
            {video.title}
          </h3>
          <div className="flex flex-col text-xs sm:text-sm text-gray-600 mt-0.5">
            <span 
              onClick={handleChannelClick} 
              className="hover:text-gray-900 transition-colors flex items-center gap-1 font-normal cursor-pointer"
            >
              <span className="truncate">{video.author}</span>
              <span className="w-3.5 h-3.5 bg-gray-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0">✓</span>
            </span>
            <span onClick={onClick} className="text-gray-500 text-xs mt-0.5">
              {formatNumberJP(video.viewCount)}回視聴 • {video.publishedText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
