import React from 'react';
import { SearchChannel } from '../types';
import { User, CheckCircle2, ArrowRight } from 'lucide-react';

interface SearchChannelCardProps {
  channel: SearchChannel;
  onSelectChannel: (channelId: string) => void;
}

export default function SearchChannelCard({
  channel,
  onSelectChannel,
}: SearchChannelCardProps) {
  return (
    <div
      onClick={() => onSelectChannel(channel.id)}
      className="w-full flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-8 py-4 sm:py-6 px-3 sm:px-5 hover:bg-gray-50/80 rounded-2xl transition-colors cursor-pointer group"
    >
      {/* チャンネルアバター (YouTubeスタイルの大きめのアバター) */}
      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
        {channel.avatar ? (
          <img crossOrigin="anonymous" crossOrigin="anonymous"
            src={channel.avatar}
            alt={channel.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.title)}&background=f3f4f6&color=4b5563&size=128`;
            }}
          />
        ) : (
          <User size={44} className="text-gray-400" />
        )}
      </div>

      {/* チャンネル情報 */}
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
          <h3 className="text-lg sm:text-xl font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
            {channel.title}
          </h3>
          {channel.isVerified && (
            <CheckCircle2 size={18} className="text-gray-500 shrink-0 fill-gray-100" />
          )}
        </div>

        {/* ハンドル & 登録者数 & 動画数 */}
        <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-xs sm:text-sm text-gray-500 flex-wrap">
          {channel.handle && (
            <span className="font-medium text-gray-700">{channel.handle}</span>
          )}
          {channel.handle && (channel.subscribers || channel.videoCount) && (
            <span>•</span>
          )}
          {channel.subscribers && (
            <span>{channel.subscribers}</span>
          )}
          {channel.videoCount && (
            <>
              <span>•</span>
              <span>{channel.videoCount}</span>
            </>
          )}
        </div>

        {/* チャンネル概要 */}
        {channel.description && (
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mt-2 leading-relaxed max-w-3xl">
            {channel.description}
          </p>
        )}
      </div>

      {/* チャンネル表示ボタン */}
      <div className="shrink-0 mt-2 sm:mt-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectChannel(channel.id);
          }}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-medium transition-colors shadow-2xs"
        >
          <ArrowRight size={14} />
          チャンネルを表示
        </button>
      </div>
    </div>
  );
}
