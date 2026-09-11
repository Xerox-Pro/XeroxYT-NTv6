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
      className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 p-4 sm:p-5 bg-white hover:bg-gray-50/80 rounded-2xl border border-gray-200 transition-colors cursor-pointer group shadow-2xs"
    >
      {/* チャンネルアバター */}
      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
        {channel.avatar ? (
          <img
            src={channel.avatar}
            alt={channel.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.title)}&background=f3f4f6&color=4b5563&size=128`;
            }}
          />
        ) : (
          <User size={36} className="text-gray-400" />
        )}
      </div>

      {/* チャンネル情報 */}
      <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col justify-center">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
            {channel.title}
          </h3>
          {channel.isVerified && (
            <CheckCircle2 size={16} className="text-gray-500 shrink-0 fill-gray-100" />
          )}
        </div>

        {/* ハンドル & 登録者数 & 動画数 */}
        <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-xs text-gray-500 flex-wrap">
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
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mt-2 leading-relaxed">
            {channel.description}
          </p>
        )}

        {/* アクションボタン */}
        <div className="mt-3 flex items-center justify-center sm:justify-start">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors shadow-2xs">
            <ArrowRight size={13} />
            チャンネルを表示
          </span>
        </div>
      </div>
    </div>
  );
}
