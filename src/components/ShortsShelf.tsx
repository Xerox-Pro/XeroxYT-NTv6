import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Zap, ChevronRight } from 'lucide-react';
import { Video, ShortVideo } from '../types';
import { formatNumberJP } from '../utils';

interface ShortsShelfProps {
  shorts: (Video | ShortVideo)[];
  title?: string;
  isCompact?: boolean;
  onSelectShort?: (short: Video | ShortVideo) => void;
}

export default function ShortsShelf({
  shorts,
  title = 'ショート',
  isCompact = false,
  onSelectShort,
}: ShortsShelfProps) {
  const navigate = useNavigate();

  if (!shorts || shorts.length === 0) return null;

  const handleClick = (short: Video | ShortVideo) => {
    if (onSelectShort) {
      onSelectShort(short);
    } else if (short.videoId) {
      navigate(`/shorts/${short.videoId}`);
    }
  };

  return (
    <div className={`w-full py-4 ${isCompact ? '' : 'my-4 border-y border-gray-100/80 py-6'}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-xs">
            <Zap size={16} fill="white" className="text-white" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
            {title}
          </h2>
        </div>
        <button
          onClick={() => {
            const first = shorts[0];
            if (first?.videoId) navigate(`/shorts/${first.videoId}`);
            else navigate('/shorts');
          }}
          className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-0.5 transition-colors"
        >
          <span>すべて表示</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* スクロール / グリッド表示 */}
      <div
        className={`flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory ${
          isCompact
            ? 'grid grid-cols-2 sm:grid-cols-2 gap-2 overflow-visible'
            : 'sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:overflow-visible'
        }`}
      >
        {shorts.slice(0, isCompact ? 4 : 6).map((short) => {
          const thumbUrl =
            (short as any).videoThumbnails?.[0]?.url ||
            `https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`;
          const views = short.viewCount || 0;

          return (
            <motion.div
              key={short.videoId}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleClick(short)}
              className={`shrink-0 cursor-pointer group flex flex-col select-none ${
                isCompact ? 'w-full' : 'w-[155px] sm:w-full snap-start'
              }`}
            >
              <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 shadow-2xs group-hover:shadow-md transition-all duration-300 border border-gray-200/70">
                <img
                  src={thumbUrl}
                  alt={short.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                  onError={(e) => {
                    // フォールバック
                    (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`;
                  }}
                />
                
                {/* 9:16 上部ショートアイコン */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs p-1 rounded-md text-white">
                  <Zap size={12} fill="white" className="text-white" />
                </div>

                {/* 下部グラデーションとテキスト */}
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white flex flex-col justify-end">
                  <p className="text-xs font-semibold line-clamp-2 leading-snug drop-shadow-xs">
                    {short.title}
                  </p>
                  {views > 0 && (
                    <span className="text-[10px] text-gray-200 mt-1 font-medium">
                      {formatNumberJP(views)}回視聴
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
