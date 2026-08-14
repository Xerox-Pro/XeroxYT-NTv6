import React, { useState } from 'react';
import { UserPlaylist, Video, WatchHistoryItem } from '../types';
import { localAI } from '../lib/intelligence';
import { Library, Plus, Play, Shuffle, Trash2, MoveUp, MoveDown, FolderPlus, Clock, Music, ListVideo, BrainCircuit, Sparkles } from 'lucide-react';
import { formatDuration } from '../utils';

interface LibraryPageProps {
  playlists: UserPlaylist[];
  history: WatchHistoryItem[];
  onCreatePlaylist: (title: string, description?: string) => string;
  onDeletePlaylist: (id: string) => void;
  onRemoveVideoFromPlaylist: (playlistId: string, videoId: string) => void;
  onReorderPlaylistVideo: (playlistId: string, fromIndex: number, toIndex: number) => void;
  onStartPlaylistPlay: (playlist: UserPlaylist, shuffle?: boolean) => void;
  onVideoSelect: (videoId: string, videoObj?: Video) => void;
  onNavigateToHistory: () => void;
}

export default function LibraryPage({
  playlists,
  history,
  onCreatePlaylist,
  onDeletePlaylist,
  onRemoveVideoFromPlaylist,
  onReorderPlaylistVideo,
  onStartPlaylistPlay,
  onVideoSelect,
  onNavigateToHistory
}: LibraryPageProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) return;
    const newId = onCreatePlaylist(titleInput.trim(), descInput.trim());
    setSelectedPlaylistId(newId);
    setTitleInput('');
    setDescInput('');
    setIsCreating(false);
  };

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-8 bg-white min-h-screen select-none">
      {/* 1. ライブラリヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Library size={28} className="text-red-600" />
            <span>ライブラリ</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">作成した再生リストとコンテンツの管理</p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black hover:bg-gray-800 text-white text-xs font-bold transition-all duration-200 shadow-2xs active:scale-95"
        >
          <FolderPlus size={16} />
          <span>新しい再生リストを作成</span>
        </button>
      </div>

      {/* 2. 新規作成モーダル（画面内インラインまたはダイアログ） */}
      {isCreating && (
        <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200 max-w-lg animate-in fade-in">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Plus size={16} />
            <span>新しい再生リストの作成</span>
          </h3>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="再生リスト名 (必須)"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:border-black text-gray-900"
              autoFocus
              required
            />
            <input
              type="text"
              placeholder="説明 (任意)"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:border-black text-gray-900"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800"
              >
                作成する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. 最近見た動画へのショートカット */}
      {history.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-gray-700" />
              <span>最近見た動画</span>
            </h2>
            <button
              onClick={onNavigateToHistory}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
            >
              すべて表示 ({history.length})
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {history.slice(0, 6).map((item) => (
              <div
                key={item.videoId}
                onClick={() => onVideoSelect(item.videoId)}
                className="group cursor-pointer flex flex-col gap-1.5"
              >
                <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 relative shadow-2xs border border-gray-200">
                  <img
                    src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h4 className="text-xs font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local AI Insights Section */}
      <div className="mb-10 p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
          <BrainCircuit size={120} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-red-100 p-1.5 rounded-lg">
              <BrainCircuit size={18} className="text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>Local AI 分析済み興味関心</span>
              <Sparkles size={14} className="text-amber-500 animate-pulse" />
            </h2>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {localAI.getTopSuggestedQueries(15).length > 0 ? (
              localAI.getTopSuggestedQueries(15).map((interest, idx) => (
                <span 
                  key={idx}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-700 shadow-xs hover:border-red-400 hover:text-red-600 transition-all cursor-default"
                >
                  #{interest}
                </span>
              ))
            ) : (
              <p className="text-xs text-gray-400 font-medium italic">動画を視聴したり検索したりすると、AIがあなたの興味を分析します。</p>
            )}
          </div>
          
          <p className="mt-4 text-[10px] text-gray-400 font-medium flex items-center gap-1">
            <span>※ この分析は外部サーバーへ送信されず、お使いのデバイス上でのみ実行されます。</span>
          </p>
        </div>
      </div>

      {/* 4. カスタム再生リスト セクション */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Music size={18} className="text-red-600" />
          <span>あなたの再生リスト ({playlists.length})</span>
        </h2>

        {playlists.length === 0 ? (
          <div className="p-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <ListVideo size={40} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-bold text-gray-800">再生リストがまだありません</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              好きな動画の「+ 保存」ボタンを押すか、上の「新しい再生リストを作成」ボタンからリストを作ることができます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* 左側: プレイリスト選択カードグリッド */}
            <div className="lg:col-span-1 flex flex-col gap-3">
              {playlists.map((pl) => {
                const isSelected = pl.id === selectedPlaylistId;
                const coverThumb = pl.videos[0]?.videoThumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&auto=format&fit=crop&q=80';

                return (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className={`p-3 rounded-2xl cursor-pointer border transition-all duration-200 flex items-center gap-4 ${
                      isSelected
                        ? 'bg-black text-white border-black shadow-md'
                        : 'bg-white text-gray-900 border-gray-200/80 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-20 aspect-video rounded-xl overflow-hidden bg-gray-200 relative shrink-0">
                      <img src={coverThumb} alt={pl.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-[10px] font-bold">
                        {pl.videos.length}本
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {pl.title}
                      </h3>
                      {pl.description && (
                        <p className={`text-xs truncate ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                          {pl.description}
                        </p>
                      )}
                      <p className={`text-[11px] mt-1 ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}>
                        {pl.videos.length} 本の動画
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 右側: 選択中のプレイリスト詳細 ＆ 連続再生コントロール */}
            <div className="lg:col-span-2 bg-gray-50 rounded-2xl p-6 border border-gray-200">
              {selectedPlaylist ? (
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 mb-6">
                    <div>
                      <h2 className="text-xl font-extrabold text-gray-900">{selectedPlaylist.title}</h2>
                      {selectedPlaylist.description && (
                        <p className="text-xs text-gray-600 mt-1">{selectedPlaylist.description}</p>
                      )}
                      <span className="text-xs text-gray-500 font-semibold block mt-1">
                        合計 {selectedPlaylist.videos.length} 本の動画
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onStartPlaylistPlay(selectedPlaylist, false)}
                        disabled={selectedPlaylist.videos.length === 0}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-2xs disabled:opacity-40"
                      >
                        <Play size={15} className="fill-white" />
                        <span>連続再生</span>
                      </button>

                      <button
                        onClick={() => onStartPlaylistPlay(selectedPlaylist, true)}
                        disabled={selectedPlaylist.videos.length === 0}
                        className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-2xs disabled:opacity-40"
                      >
                        <Shuffle size={15} />
                        <span>シャッフル再生</span>
                      </button>

                      <button
                        onClick={() => {
                          onDeletePlaylist(selectedPlaylist.id);
                          setSelectedPlaylistId(null);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="プレイリストを削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* プレイリスト内動画一覧 */}
                  {selectedPlaylist.videos.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-xs font-medium">この再生リストにはまだ動画が追加されていません。</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedPlaylist.videos.map((video, idx) => (
                        <div
                          key={`${video.videoId}-${idx}`}
                          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-200/80 hover:border-gray-300 transition-all group"
                        >
                          <div
                            onClick={() => onVideoSelect(video.videoId, video)}
                            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                          >
                            <span className="text-xs font-bold text-gray-400 w-5 text-center shrink-0">{idx + 1}</span>
                            <div className="w-20 aspect-video rounded-lg overflow-hidden bg-gray-100 relative shrink-0">
                              <img
                                src={video.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                {video.title}
                              </h4>
                              <p className="text-[11px] text-gray-500 truncate">{video.author}</p>
                            </div>
                          </div>

                          {/* 順序変更 ＆ 削除コントロール */}
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              onClick={() => onReorderPlaylistVideo(selectedPlaylist.id, idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                              title="上へ移動"
                            >
                              <MoveUp size={14} />
                            </button>
                            <button
                              onClick={() => onReorderPlaylistVideo(selectedPlaylist.id, idx, idx + 1)}
                              disabled={idx === selectedPlaylist.videos.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                              title="下へ移動"
                            >
                              <MoveDown size={14} />
                            </button>
                            <button
                              onClick={() => onRemoveVideoFromPlaylist(selectedPlaylist.id, video.videoId)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="リストから削除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-400">
                  <p className="text-xs font-medium">左側の再生リストを選択すると詳細と順番変更ができます。</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
