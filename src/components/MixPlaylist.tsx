import React, { useEffect, useRef } from 'react';
import { Repeat, Repeat1, Shuffle, X, Play, SkipForward, SkipBack, ListMusic, ChevronDown, ChevronUp } from 'lucide-react';
import { Video } from '../types';

interface MixPlaylistProps {
  currentVideoId: string;
  videos: Video[];
  playlistTitle?: string;
  playlistSubtitle?: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectVideo: (videoId: string, video?: Video) => void;
  loopMode: 'none' | 'all' | 'one';
  onCycleLoopMode: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const MixPlaylist: React.FC<MixPlaylistProps> = ({
  currentVideoId,
  videos,
  playlistTitle = 'ミックスリスト',
  playlistSubtitle = 'ミックスリストとは、YouTube があなたのために作成したプレイリストです',
  isOpen,
  onToggleOpen,
  onSelectVideo,
  loopMode,
  onCycleLoopMode,
  isShuffle,
  onToggleShuffle,
  onNextTrack,
  onPrevTrack,
}) => {
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const currentIndex = videos.findIndex(v => v.videoId === currentVideoId);
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 1;

  // 自動で再生中の曲までスムーズスクロール
  useEffect(() => {
    if (isOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentVideoId, isOpen]);

  if (!videos || videos.length === 0) {
    return null;
  }

  // 閉じた状態の最小化バナー（YouTubeのコンパクト表示風）
  if (!isOpen) {
    return (
      <div className="w-full bg-[#f2f2f2] rounded-2xl p-3 mb-4 shadow-xs transition-all duration-300 ease-out hover:bg-[#eaeaea]">
        <button
          type="button"
          onClick={onToggleOpen}
          className="w-full flex items-center justify-between text-left group cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-xs shrink-0 group-hover:text-black">
              <ListMusic size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate leading-snug">
                {playlistTitle}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {displayIndex} / {videos.length} • タップしてリストを表示
              </div>
            </div>
          </div>
          <div className="p-1.5 rounded-full text-gray-500 group-hover:text-gray-900 group-hover:bg-black/5 transition-colors">
            <ChevronDown size={18} />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#f2f2f2] rounded-2xl p-3.5 mb-4 shadow-xs transition-all duration-300 ease-out flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-black/[0.06]">
        <div className="min-w-0 flex-1 pr-1">
          <h2 className="text-[15px] font-bold text-gray-900 tracking-tight leading-snug truncate" title={playlistTitle}>
            {playlistTitle}
          </h2>
          <p className="text-[11.5px] text-gray-500 leading-normal font-normal mt-0.5 line-clamp-1" title={playlistSubtitle}>
            {playlistSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          title="閉じる"
          className="p-1 rounded-full text-gray-500 hover:text-gray-900 hover:bg-black/5 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* コントロールバー（曲順表示、シャッフル、ループ、前へ、次へ） */}
      <div className="flex items-center justify-between py-2 border-b border-black/[0.06] text-xs select-none">
        <div className="font-semibold text-gray-600 pl-1">
          {displayIndex} / {videos.length}
        </div>

        <div className="flex items-center gap-1">
          {/* 前の曲 */}
          <button
            type="button"
            onClick={onPrevTrack}
            disabled={currentIndex <= 0 && loopMode === 'none'}
            title="前の動画"
            className="p-1.5 rounded-full text-gray-700 hover:text-black hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90 transition-all duration-200 cursor-pointer"
          >
            <SkipBack size={16} />
          </button>

          {/* 次の曲 */}
          <button
            type="button"
            onClick={onNextTrack}
            disabled={currentIndex >= videos.length - 1 && loopMode === 'none' && !isShuffle}
            title="次の動画"
            className="p-1.5 rounded-full text-gray-700 hover:text-black hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90 transition-all duration-200 cursor-pointer"
          >
            <SkipForward size={16} />
          </button>

          {/* ループ切り替えボタン */}
          <button
            type="button"
            onClick={onCycleLoopMode}
            title={
              loopMode === 'none'
                ? '再生リストのループを有効にする'
                : loopMode === 'all'
                ? '1曲のループを有効にする'
                : 'ループを無効にする'
            }
            className={`p-1.5 rounded-full active:scale-90 transition-all duration-200 cursor-pointer relative ${
              loopMode !== 'none'
                ? 'text-blue-600 bg-blue-50/80 hover:bg-blue-100/70 font-semibold'
                : 'text-gray-600 hover:text-black hover:bg-black/5'
            }`}
          >
            {loopMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            {loopMode === 'all' && (
              <span className="sr-only">全曲ループ中</span>
            )}
          </button>

          {/* シャッフル切り替えボタン */}
          <button
            type="button"
            onClick={onToggleShuffle}
            title={isShuffle ? 'シャッフルを無効にする' : 'シャッフルを有効にする'}
            className={`p-1.5 rounded-full active:scale-90 transition-all duration-200 cursor-pointer ${
              isShuffle
                ? 'text-blue-600 bg-blue-50/80 hover:bg-blue-100/70 font-semibold'
                : 'text-gray-600 hover:text-black hover:bg-black/5'
            }`}
          >
            <Shuffle size={16} />
          </button>
        </div>
      </div>

      {/* 動画リスト */}
      <div
        ref={listContainerRef}
        className="max-h-[380px] overflow-y-auto mt-1 pr-1 space-y-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent select-none"
      >
        {videos.map((item, idx) => {
          const isCurrent = item.videoId === currentVideoId;
          const durationText = item.lengthSeconds ? formatDuration(item.lengthSeconds) : '';
          const thumbUrl =
            item.videoThumbnails?.[0]?.url ||
            (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : '');

          return (
            <div
              key={`${item.videoId || idx}-${idx}`}
              ref={isCurrent ? activeItemRef : null}
              onClick={() => {
                if (item.videoId) {
                  onSelectVideo(item.videoId, item);
                }
              }}
              className={`group flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer transition-all duration-200 ease-out ${
                isCurrent
                  ? 'bg-black/[0.08] shadow-2xs'
                  : 'hover:bg-black/[0.04] active:bg-black/[0.06]'
              }`}
            >
              {/* 曲順インジケーター / 再生アイコン */}
              <div className="w-5 flex items-center justify-center shrink-0">
                {isCurrent ? (
                  <Play size={12} className="fill-gray-900 text-gray-900 animate-pulse" />
                ) : (
                  <span className="text-[11px] font-medium text-gray-400 group-hover:hidden">
                    {idx + 1}
                  </span>
                )}
                {!isCurrent && (
                  <Play size={11} className="hidden group-hover:block fill-gray-600 text-gray-600 opacity-80" />
                )}
              </div>

              {/* サムネイル */}
              <div className="w-[84px] sm:w-[96px] aspect-video rounded-lg overflow-hidden relative shrink-0 bg-gray-200">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                    <Play size={16} />
                  </div>
                )}
                {durationText && (
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1 py-0.5 rounded leading-none">
                    {durationText}
                  </span>
                )}
              </div>

              {/* タイトルとチャンネル情報 */}
              <div className="flex flex-col flex-1 min-w-0 pr-1">
                <h3
                  className={`text-[12.5px] leading-tight line-clamp-2 ${
                    isCurrent ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                  }`}
                  title={item.title}
                >
                  {item.title}
                </h3>
                <p className="text-[11px] text-gray-500 truncate mt-1 leading-none">
                  {item.author}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
