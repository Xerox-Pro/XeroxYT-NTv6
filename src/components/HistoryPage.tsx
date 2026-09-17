import React, { useState } from 'react';
import { WatchHistoryItem, Video } from '../types';
import { History, Trash2, Video as VideoIcon, Zap, Layers, Play } from 'lucide-react';
import { formatNumberJP, formatDuration } from '../utils';
import Avatar from './Avatar';

interface HistoryPageProps {
  history: WatchHistoryItem[];
  onVideoSelect: (videoId: string, videoObj?: Video) => void;
  onClearHistory: () => void;
  onRemoveHistoryItem: (videoId: string) => void;
  onSelectChannel: (channelIdOrName: string) => void;
}

export default function HistoryPage({
  history,
  onVideoSelect,
  onClearHistory,
  onRemoveHistoryItem,
  onSelectChannel
}: HistoryPageProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'short'>('all');

  const filteredHistory = history.filter((item) => {
    if (activeTab === 'video') return item.type === 'video';
    if (activeTab === 'short') return item.type === 'short';
    return true;
  });

  const normalVideosCount = history.filter((i) => i.type === 'video').length;

  return (
    <div className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-8 bg-white min-h-screen select-none">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <History size={26} className="text-gray-900" />
            <span>再生履歴</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">最近視聴した動画とショート動画を表示しています</p>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 text-xs font-bold transition-colors duration-200"
          >
            <Trash2 size={15} />
            <span>すべての再生履歴を消去</span>
          </button>
        )}
      </div>

      {/* タブ切り替え（すべて・動画・ショート） */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-black text-white shadow-2xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Layers size={16} />
          <span>すべて ({history.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'video'
              ? 'bg-black text-white shadow-2xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <VideoIcon size={16} />
          <span>通常動画 ({normalVideosCount})</span>
        </button>
      </div>

      {/* 履歴リスト */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
          <History size={48} className="text-gray-300 mb-3" />
          <p className="text-base font-bold text-gray-800">再生履歴がありません</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">動画を視聴すると、ここに自動で履歴が保存されます。</p>
        </div>
      ) : activeTab === 'short' ? (
        /* ショート動画のグリッド表示 */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredHistory.map((item) => (
            <div
              key={item.videoId}
              className="group relative cursor-pointer flex flex-col gap-2"
            >
              <div 
                onClick={() => onVideoSelect(item.videoId)}
                className="aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 relative shadow-2xs border border-gray-200"
              >
                <img
                  src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent text-white">
                  <p className="text-xs font-bold line-clamp-2 leading-snug">{item.title}</p>
                  <span className="text-[10px] text-gray-300 mt-1 block truncate">
                    {item.author}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onRemoveHistoryItem(item.videoId)}
                className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200"
                title="履歴から削除"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* 通常動画 / すべての縦型リスト表示 */
        <div className="flex flex-col gap-4 max-w-4xl">
          {filteredHistory.map((item) => (
            <div
              key={item.videoId}
              className="group flex flex-col sm:flex-row items-start gap-4 p-3 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all duration-200"
            >
              {/* サムネイル */}
              <div
                onClick={() => onVideoSelect(item.videoId)}
                className="w-full sm:w-60 aspect-video rounded-xl overflow-hidden bg-gray-100 relative cursor-pointer shrink-0 border border-gray-200 shadow-2xs group-hover:shadow-sm"
              >
                <img
                  src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {item.lengthSeconds && (
                  <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {formatDuration(item.lengthSeconds)}
                  </div>
                )}
                {item.type === 'short' && (
                  <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Zap size={10} fill="white" />
                    <span>Shorts</span>
                  </div>
                )}
              </div>

              {/* 動画情報 */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1 w-full">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      onClick={() => onVideoSelect(item.videoId)}
                      className="font-bold text-gray-900 text-base leading-snug line-clamp-2 hover:text-blue-600 cursor-pointer transition-colors"
                    >
                      {item.title}
                    </h3>
                    <button
                      onClick={() => onRemoveHistoryItem(item.videoId)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="履歴から削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div 
                    onClick={() => onSelectChannel(item.author)}
                    className="flex items-center gap-2 mt-2 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Avatar src={item.authorAvatar} name={item.author} className="w-5 h-5 text-[10px]" />
                    <span className="text-xs text-gray-600 font-medium hover:text-gray-900">{item.author}</span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 mt-3 flex items-center gap-2">
                  <span>視聴日: {new Date(item.timestamp).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
