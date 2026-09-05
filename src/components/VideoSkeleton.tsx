import React from 'react';

export default function VideoSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-10 p-4 sm:p-6 w-full max-w-[2400px] mx-auto bg-white">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="w-full aspect-video rounded-xl animate-shimmer"></div>
          <div className="flex gap-3 pr-6">
            <div className="w-9 h-9 rounded-full shrink-0 animate-shimmer"></div>
            <div className="flex flex-col gap-2 w-full pt-1">
              <div className="w-[90%] h-4 rounded animate-shimmer"></div>
              <div className="w-[60%] h-3.5 rounded animate-shimmer mt-1"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
