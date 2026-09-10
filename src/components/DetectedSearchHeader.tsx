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
    <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-red-50/90 via-gray-50/50 to-white border border-red-200/90 rounded-2xl shadow-xs hover:shadow-md transition-all">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-200/60">
        <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
          <Sparkles size={14} className="text-red-500 animate-pulse" />
          <span>
            {detected.type === 'short'
              ? 'YouTubeショートを検出'
              : detected.type === 'channel'
              ? 'YouTubeチャンネルを検出'
              : 'YouTube動画を検出'}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-mono">
          ID: {detected.id}
        </span>
      </div>

      {isVideoOrShort ? (
        <div
          onClick={handleClick}
          className="flex flex-col sm:flex-row gap-4 p-3 bg-white hover:bg-red-50/30 rounded-xl border border-gray-200 hover:border-red-300 transition-all cursor-pointer group"
        >
          {/* サムネイル */}
          <div className="relative w-full sm:w-64 aspect-video bg-gray-900 rounded-xl overflow-hidden shrink-0 shadow-xs">
            <img
              src={`https://i.ytimg.com/vi/${detected.id}/hqdefault.jpg`}
              alt="動画サムネイル"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${detected.id}/mqdefault.jpg`;
              }}
            />
            {/* 再生オーバーレイ */}
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:bg-black/35 transition-all">
              <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play size={18} className="fill-white ml-0.5" />
              </div>
            </div>
            {detected.type === 'short' ? (
              <span className="absolute bottom-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                <Zap size={12} className="fill-white" />
                Shorts
              </span>
            ) : metadata.duration ? (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-2 py-0.5 rounded">
                {metadata.duration}
              </span>
            ) : null}
          </div>

          {/* タイトルとメタデータ */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-red-600 transition-colors">
              {metadata.title || (metadata.loading ? '動画情報を読み込み中...' : `YouTube動画 (${detected.id})`)}
            </h3>

            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              {metadata.authorAvatar && (
                <img
                  src={metadata.authorAvatar}
                  alt={metadata.author || ''}
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="font-medium truncate">{metadata.author || 'YouTube'}</span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
              >
                <Play size={14} className="fill-white" />
                押して再生
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-white hover:bg-blue-50/30 rounded-xl border border-gray-200 hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center shadow-xs">
            {metadata.avatar ? (
              <img
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
            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
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
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
              >
                <ArrowRight size={14} />
                チャンネルページを開く
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
