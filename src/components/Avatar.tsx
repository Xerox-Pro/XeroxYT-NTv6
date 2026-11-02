import React, { useState, useEffect, useRef } from 'react';
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
  const resolvedCallback = useRef(onResolved); resolvedCallback.current = onResolved;
  const failedUrls = useRef(new Set<string>());
  const [refresh,setRefresh] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [fetchedAvatar, setFetchedAvatar] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setImgError(false);
    setFetchedAvatar(null);
    setLoaded(false);
    setRefresh(0); failedUrls.current.clear();
  }, [src, channelId, videoId, name]);

  const cleanName = (name || 'User').split(/、他|\s*and\s+\d+\s+other/i)[0].trim() || 'User';

  useEffect(() => {
    const placeholder = !src || src.includes('ui-avatars.com');
    if (!(placeholder || imgError) || refresh > 2) return;
    const searchAuthor = cleanName !== 'チャンネル' && cleanName !== 'Unknown' ? cleanName : name;
    const identity = channelId || videoId || searchAuthor;
    if (!identity) return;
    const key = `${identity}${refresh ? ':refresh:'+refresh : ''}`;
    let active = true;
    const cancel = batchAvatarFetcher.register({key,channelId,videoId,author:searchAuthor}, data => {
      if (!active) return;
      const avatar = data.authorAvatar?.startsWith('//') ? 'https:'+data.authorAvatar : data.authorAvatar;
      if (avatar && !failedUrls.current.has(avatar) && !avatar.includes('ui-avatars.com')) { setFetchedAvatar(avatar);setImgError(false);setLoaded(false); }
      resolvedCallback.current?.(data);
    });
    return () => {active=false;cancel();};
  }, [src,imgError,refresh,channelId,videoId,name,cleanName]);

  // Do not show ui-avatars as a real image if we haven't resolved yet
  const isServerPlaceholder = src && src.includes('ui-avatars.com');
  const rawSrc = fetchedAvatar || (!isServerPlaceholder ? src : null);
  const activeSrc = rawSrc?.startsWith('//') ? 'https:'+rawSrc : rawSrc;
  const displayName = cleanName;
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
        onLoad={() => setLoaded(true)}
        onError={() => { if(activeSrc)failedUrls.current.add(activeSrc);setImgError(true);setFetchedAvatar(null);setRefresh(n=>n+1);batchAvatarFetcher.invalidate(channelId || videoId || cleanName); }}
        className={`${className} rounded-full object-cover shrink-0 transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-80'
        }`}
      />
    );
  }

  return (
    <div className={`${className} ${bgColor} rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none shadow-inner transition-transform duration-200`}>
      {initial}
    </div>
  );
}
