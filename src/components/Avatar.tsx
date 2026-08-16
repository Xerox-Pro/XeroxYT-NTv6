import React, { useState, useEffect } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  className?: string;
}

const bgColors = [
  'bg-red-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600',
  'bg-amber-600', 'bg-teal-600', 'bg-indigo-600', 'bg-rose-600'
];

export default function Avatar({ src, name, className = "w-8 h-8 text-sm" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const displayName = name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  
  // Pick deterministic color based on name
  let hash = 0;
  for (let i = 0; i < displayName.length; i++) {
    hash = displayName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % bgColors.length;
  const bgColor = bgColors[colorIndex];

  if (src && !imgError) {
    return (
      <img
        src={src}
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
