import React, { useRef } from 'react';
import { Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShortVideo, Video } from '../types';
import { formatNumberJP } from '../utils';
import Avatar from './Avatar';

interface ShortsShelfProps {
  shorts: (ShortVideo | Video)[];
  title?: string;
  onSelectShort: (videoId: string) => void;
  compact?: boolean;
}

export default function ShortsShelf({
  shorts,
  title = 'ショート',
  onSelectShort,
  compact = false,
}: ShortsShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!shorts || shorts.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className={`w-full py-4 ${compact ? 'border-y border-gray-100 my-2' : 'my-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center shadow-xs">
            <Zap size={16} className="text-white fill-white" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
            {title}
          </h2>
        </div>

        {!compact && shorts.length > 3 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
              title="前へ"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
              title="次へ"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Shorts Cards Container */}
      <div
        ref={scrollRef}
        className={`flex gap-3 overflow-x-auto no-scrollbar scroll-smooth pb-2 ${
          compact ? 'gap-2.5' : 'gap-3 sm:gap-4'
        }`}
      >
        {shorts.map((short, idx) => {
          const videoId = short.videoId || '';
          if (!videoId) return null;

          const thumb =
            short.videoThumbnails?.[0]?.url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          return (
            <div
              key={`${videoId}-${idx}`}
              onClick={() => onSelectShort(videoId)}
              className={`shrink-0 cursor-pointer group flex flex-col transition-transform duration-200 active:scale-[0.98] ${
                compact ? 'w-[140px] sm:w-[155px]' : 'w-[160px] sm:w-[190px] md:w-[210px]'
              }`}
            >
              {/* Thumbnail Container 9:16 */}
              <div className="aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 relative shadow-2xs border border-gray-200/80 group-hover:border-gray-300 group-hover:shadow-md transition-all duration-300">
                <img
                  src={thumb}
                  alt={short.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />

                {/* Gradient Overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/75 pointer-events-none" />

                {/* View count overlay */}
                <div className="absolute bottom-2 left-2 right-2 text-white pointer-events-none">
                  <span className="text-[11px] font-medium text-white/90 drop-shadow-sm block">
                    {formatNumberJP(short.viewCount || 0)} 回視聴
                  </span>
                </div>
              </div>

              {/* Title and Author Info below thumbnail (clean YouTube style) */}
              <div className="mt-2 px-0.5">
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {short.title}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 truncate">
                  <Avatar
                    src={short.authorAvatar}
                    name={short.author || 'チャンネル'}
                    channelId={short.authorId}
                    className="w-4 h-4 text-[8px]"
                  />
                  <span className="truncate">{short.author || 'チャンネル'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
