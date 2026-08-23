import React, { useState, useEffect } from 'react';
import { batchAvatarFetcher, BatchResponseItem } from '../utils/batchAvatarFetcher';

interface AvatarProps {
  src?: string;
  name: string;
  channelId?: string;
  videoId?: string;
  className?: string;
  onResolved?: (info: BatchResponseItem) => void;
}

const bgColors = [
  'bg-red-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600',
  'bg-amber-600', 'bg-teal-600', 'bg-indigo-600', 'bg-rose-600'
];

export default function Avatar({ src, name, channelId, videoId, className = "w-8 h-8 text-sm", onResolved }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [fetchedAvatar, setFetchedAvatar] = useState<string | null>(null);

  useEffect(() => {
    setImgError(false);
    setFetchedAvatar(null);
  }, [src]);

  // If src is missing, is a placeholder, or errored out, trigger batch avatar fetcher
  useEffect(() => {
    const isPlaceholder = !src || src.includes('ui-avatars.com');
    if ((isPlaceholder || imgError) && !fetchedAvatar) {
      const key = channelId || videoId || (name && name !== 'チャンネル' && name !== 'Unknown' ? name : '');
      if (key) {
        batchAvatarFetcher.register(
          { key, channelId, videoId, author: name },
          (data) => {
            if (data.authorAvatar) {
              setFetchedAvatar(data.authorAvatar);
              setImgError(false);
            }
            if (onResolved) {
              onResolved(data);
            }
          }
        );
      }
    }
  }, [src, imgError, fetchedAvatar, channelId, videoId, name, onResolved]);

  const activeSrc = fetchedAvatar || src;
  const displayName = name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  
  // Pick deterministic color based on name
  let hash = 0;
  for (let i = 0; i < displayName.length; i++) {
    hash = displayName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % bgColors.length;
  const bgColor = bgColors[colorIndex];

  if (activeSrc && !imgError) {
    return (
      <img
        src={activeSrc}
        alt={displayName}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${className} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div className={`${className} ${bgColor} rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none shadow-inner`}>
      {initial}
    </div>
  );
}
