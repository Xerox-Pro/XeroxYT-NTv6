import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Video } from '../types';
import { formatNumberJP, formatDuration } from '../utils';
import { PlayCircle, ListMusic } from 'lucide-react';
import Avatar from './Avatar';
import { useTheme } from '../lib/ThemeContext';

interface VideoCardProps {
  video: Video;
  onClick: () => void;
  onSelectChannel?: (channelIdOrName: string) => void;
  hideChannelInfo?: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, onSelectChannel, hideChannelInfo }) => {
  const { theme } = useTheme();
  const isPlaylist = video.type === 'playlist' || video.type === 'mix' || !!video.playlistId;
  const initialThumb = video.videoThumbnails?.[0]?.url || (video.videoId ? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg` : '');
  const [imgSrc, setImgSrc] = useState(initialThumb);

  useEffect(() => {
    setImgSrc(video.videoThumbnails?.[0]?.url || (video.videoId ? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg` : ''));
  }, [video]);

  const [displayAuthor, setDisplayAuthor] = useState(video.author && video.author !== 'Unknown' && video.author !== 'Channel' ? video.author : 'チャンネル');

  useEffect(() => {
    setDisplayAuthor(video.author && video.author !== 'Unknown' && video.author !== 'Channel' ? video.author : 'チャンネル');
  }, [video]);

  const authorName = displayAuthor;

  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectChannel) {
      // 複数チャンネル表記の場合はメインチャンネル名またはIDで開く
      const cleanName = authorName.split(/、他|\s*and\s+\d+\s+other/i)[0].trim();
      onSelectChannel(video.authorId || cleanName || authorName);
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
    <motion.div 
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group cursor-pointer flex flex-col select-none"
    >
      {/* 16:9 サムネイルカード */}
      <div 
        onClick={onClick}
        className={`relative aspect-video rounded-xl overflow-hidden transition-all duration-300 ${
          theme === 'white' 
            ? 'bg-gray-100 border border-gray-200/80 shadow-2xs group-hover:shadow-md' 
            : 'bg-black/30 border border-white/20 shadow-[0_8px_25px_rgba(0,0,0,0.35)] group-hover:border-cyan-400/50 group-hover:shadow-[0_12px_30px_rgba(6,182,212,0.25)] ring-1 ring-white/10'
        }`}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            referrerPolicy="no-referrer"
            onError={handleImgError}
            alt={video.title}
            className="object-cover w-full h-full transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${theme === 'white' ? 'bg-gray-200' : 'bg-black/50'}`}>
            <PlayCircle className={`w-12 h-12 ${theme === 'white' ? 'text-gray-400' : 'text-white/40'}`} />
          </div>
        )}
        
        {isPlaylist ? (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ListMusic className="text-white w-10 h-10 mb-2" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">すべての動画を再生</span>
          </div>
        ) : null}

        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-xs text-white text-xs px-2 py-0.5 rounded font-semibold tracking-wide flex items-center gap-1 border border-white/10">
          {isPlaylist ? (
            <>
              <ListMusic size={13} />
              <span>{video.type === 'mix' ? 'MIX' : 'PLAYLIST'}</span>
            </>
          ) : (
            formatDuration(video.lengthSeconds)
          )}
        </div>
      </div>
      
      {/* 情報エリア */}
      <div className="mt-3 flex items-start space-x-3">
        {!hideChannelInfo && (
          <button 
            onClick={handleChannelClick}
            className="shrink-0 hover:scale-105 active:scale-95 transition-transform duration-150 mt-0.5"
            title={`${authorName}のチャンネルを開く`}
          >
            <Avatar 
              src={video.authorAvatar} 
              name={authorName} 
              channelId={video.authorId}
              videoId={video.videoId}
              className={`w-9 h-9 text-sm ${theme === 'white' ? 'ring-1 ring-gray-200 shadow-2xs' : 'ring-1 ring-white/30 shadow-md'}`} 
              onResolved={(info) => {
                if ((!video.author || video.author === 'チャンネル' || video.author === 'Unknown' || video.author === 'Channel') && info.author && info.author !== 'チャンネル') {
                  setDisplayAuthor(info.author);
                }
              }}
            />
          </button>
        )}

        <div className="flex flex-col gap-1 overflow-hidden flex-1">
          <h3 
            onClick={onClick}
            className={`font-semibold leading-snug line-clamp-2 text-[14px] sm:text-[15px] transition-colors duration-150 ${
              theme === 'white' 
                ? 'text-gray-900 group-hover:text-blue-600' 
                : 'text-white group-hover:text-cyan-300 drop-shadow-xs'
            }`}
          >
            {video.title}
          </h3>
          <div className="flex flex-col text-xs sm:text-[13px]">
            {!hideChannelInfo && (
              <span 
                onClick={handleChannelClick} 
                className={`transition-colors flex items-center gap-1 font-normal cursor-pointer ${
                  theme === 'white' 
                    ? 'text-gray-700 hover:text-gray-900' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <span className="truncate">{authorName}</span>
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                  theme === 'white' ? 'bg-gray-500 text-white' : 'bg-white/30 text-white'
                }`}>✓</span>
              </span>
            )}
            <span onClick={onClick} className={`text-xs mt-0.5 ${theme === 'white' ? 'text-gray-500' : 'text-white/60'}`}>
              {formatNumberJP(video.viewCount)}回視聴 • {video.publishedText}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoCard;
