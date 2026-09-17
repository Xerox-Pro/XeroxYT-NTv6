import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Zap, User, Sparkles, ArrowRight } from 'lucide-react';
import { parseYouTubeUrl, fetchJSON, formatDuration } from '../utils';

interface DetectedSearchHeaderProps {
  searchQuery: string;
  onVideoSelect: (videoId: string) => void;
  onSelectChannel: (channelId: string) => void;
}

export default function DetectedSearchHeader({
  searchQuery,
  onVideoSelect,
  onSelectChannel
}: DetectedSearchHeaderProps) {
  const navigate = useNavigate();
  const detected = parseYouTubeUrl(searchQuery);

  const [metadata, setMetadata] = useState<{
    title?: string;
    author?: string;
    authorAvatar?: string;
    duration?: string;
    subscribers?: string;
    avatar?: string;
    loading: boolean;
  }>({ loading: true });

  useEffect(() => {
    if (!detected) return;

    let isCancelled = false;
    setMetadata({ loading: true });

    if (detected.type === 'video' || detected.type === 'short') {
      fetchJSON(`/api/video/${encodeURIComponent(detected.id)}`)
        .then((data) => {
          if (!isCancelled && data) {
            setMetadata({
              title: data.title,
              author: data.author,
              authorAvatar: data.authorAvatar,
              duration: data.lengthSeconds ? formatDuration(data.lengthSeconds) : undefined,
              loading: false
            });
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setMetadata({
              title: detected.label,
              loading: false
            });
          }
        });
    } else if (detected.type === 'channel') {
      fetchJSON(`/api/channel/${encodeURIComponent(detected.id)}`)
        .then((data) => {
          if (!isCancelled && data) {
            setMetadata({
              title: data.title,
              avatar: data.avatar,
              subscribers: data.subscriberCount,
              loading: false
            });
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setMetadata({
              title: detected.label,
              loading: false
            });
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [detected?.id, detected?.type]);

  if (!detected) return null;

  const isVideoOrShort = detected.type === 'video' || detected.type === 'short';

  const handleClick = () => {
    if (isVideoOrShort) {
      const playlistParam = detected.playlistId ? `&list=${encodeURIComponent(detected.playlistId)}` : '';
      navigate(`/watch?v=${encodeURIComponent(detected.id)}${playlistParam}`);
      onVideoSelect(detected.id);
    } else {
      navigate(`/channel/${encodeURIComponent(detected.id)}`);
      onSelectChannel(detected.id);
    }
  };

  return (
    <div className="mb-6 p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl shadow-xs">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100 text-xs text-gray-500">
        <span className="font-medium text-gray-700">
          {detected.type === 'short'
            ? 'リンク先: YouTubeショート'
            : detected.type === 'channel'
            ? 'リンク先: YouTubeチャンネル'
            : 'リンク先: YouTube動画'}
        </span>
        <span className="font-mono text-gray-400 text-[11px]">
          ID: {detected.id}
        </span>
      </div>

      {isVideoOrShort ? (
        <div
          onClick={handleClick}
          className="flex flex-col sm:flex-row gap-4 p-3 bg-gray-50/50 hover:bg-gray-50 rounded-xl border border-gray-200/80 hover:border-gray-300 transition-colors cursor-pointer group"
        >
          {/* サムネイル */}
          <div className="relative w-full sm:w-60 aspect-video bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
            <img crossOrigin="anonymous"
              src={`https://i.ytimg.com/vi/${detected.id}/hqdefault.jpg`}
              alt="動画サムネイル"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${detected.id}/mqdefault.jpg`;
              }}
            />
            {/* 再生オーバーレイ */}
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-white/95 text-gray-900 flex items-center justify-center shadow-md">
                <Play size={16} className="fill-gray-900 ml-0.5" />
              </div>
            </div>
            {metadata.duration && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-2 py-0.5 rounded">
                {metadata.duration}
              </span>
            )}
          </div>

          {/* タイトルとメタデータ */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
              {metadata.title || (metadata.loading ? '動画情報を読み込み中...' : `YouTube動画 (${detected.id})`)}
            </h3>

            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              {metadata.authorAvatar && (
                <img crossOrigin="anonymous"
                  src={metadata.authorAvatar}
                  alt={metadata.author || ''}
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="truncate">{metadata.author || 'YouTube'}</span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-medium transition-colors shadow-xs"
              >
                <Play size={13} className="fill-white" />
                動画を再生
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-gray-50/50 hover:bg-gray-50 rounded-xl border border-gray-200/80 hover:border-gray-300 transition-colors cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
            {metadata.avatar ? (
              <img crossOrigin="anonymous"
                src={metadata.avatar}
                alt="チャンネルアイコン"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User size={28} className="text-gray-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {metadata.title || (metadata.loading ? 'チャンネル情報を読み込み中...' : detected.label)}
            </h3>
            {metadata.subscribers && (
              <p className="text-xs text-gray-500 mt-1">
                チャンネル登録者数: {metadata.subscribers}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-medium transition-colors shadow-xs"
              >
                <ArrowRight size={13} />
                チャンネルページを開く
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
