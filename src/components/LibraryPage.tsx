import React, { useState } from 'react';
import { UserPlaylist, Video, WatchHistoryItem } from '../types';
import { localAI } from '../lib/intelligence';
import { 
  Library, Plus, Play, Shuffle, Trash2, MoveUp, MoveDown, 
  FolderPlus, Clock, Music, ListVideo, BrainCircuit, Sparkles, 
  Download, Link2, Check, Edit3, Search, RefreshCw, X, FilePlus
} from 'lucide-react';
import { formatDuration, fetchJSON } from '../utils';

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
  onImportYouTubePlaylist?: (importedPlaylist: UserPlaylist) => void;
  onUpdatePlaylistInfo?: (id: string, title: string, description?: string) => void;
  onAddVideosToPlaylist?: (playlistId: string, videos: Video[]) => void;
  youtubePlaylists?: any[];
  watchLaterVideos?: any[];
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
  onNavigateToHistory,
  onImportYouTubePlaylist,
  onUpdatePlaylistInfo,
  onAddVideosToPlaylist,
  youtubePlaylists = [],
  watchLaterVideos = []
}: LibraryPageProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    playlists.length > 0 ? playlists[0].id : null
  );

  // モーダル・入力状態
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  // インライン編集状態
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // プレイリスト内検索
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId) || playlists[0] || null;

  // 新規プレイリスト作成
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;
    const newId = onCreatePlaylist(createTitle.trim(), createDesc.trim());
    setSelectedPlaylistId(newId);
    setCreateTitle('');
    setCreateDesc('');
    setIsCreating(false);
  };

  // YouTube プレイリスト URL インポート処理
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setImportLoading(true);
    setImportError('');

    try {
      let playlistId = importUrl.trim();
      // URLからの抽出 (list=PL...)
      if (playlistId.includes('list=')) {
        const match = playlistId.match(/list=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          playlistId = match[1];
        }
      }

      const res = await fetchJSON(`/api/playlist/${encodeURIComponent(playlistId)}`);
      if (res && res.videos && res.videos.length > 0) {
        const newPl: UserPlaylist = {
          id: `yt-import-${Date.now()}`,
          title: res.title || 'YouTube インポートリスト',
          description: res.description || 'YouTubeより読み込み',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          videos: res.videos
        };
        if (onImportYouTubePlaylist) {
          onImportYouTubePlaylist(newPl);
        } else {
          const createdId = onCreatePlaylist(newPl.title, newPl.description);
          if (onAddVideosToPlaylist) {
            onAddVideosToPlaylist(createdId, newPl.videos);
          }
        }
        setSelectedPlaylistId(newPl.id);
        setImportUrl('');
        setIsImporting(false);
      } else {
        setImportError('プレイリストに動画が見つかりませんでした。公開設定をご確認ください。');
      }
    } catch (err) {
      console.error(err);
      setImportError('プレイリストの読み込みに失敗しました。URLまたはIDをご確認ください。');
    } finally {
      setImportLoading(false);
    }
  };

  // 重複動画の自動削除
  const handleRemoveDuplicates = () => {
    if (!selectedPlaylist || !onAddVideosToPlaylist) return;
    const uniqueVideos: Video[] = [];
    const seenIds = new Set<string>();

    selectedPlaylist.videos.forEach(v => {
      if (!seenIds.has(v.videoId!)) {
        seenIds.add(v.videoId!);
        uniqueVideos.push(v);
      }
    });

    if (uniqueVideos.length !== selectedPlaylist.videos.length) {
      onAddVideosToPlaylist(selectedPlaylist.id, uniqueVideos);
      alert(`${selectedPlaylist.videos.length - uniqueVideos.length}件の重複動画を整理しました。`);
    } else {
      alert('重複している動画はありません。');
    }
  };

  // タイトル・説明編集保存
  const handleSaveEdit = () => {
    if (!selectedPlaylist || !editTitle.trim()) return;
    if (onUpdatePlaylistInfo) {
      onUpdatePlaylistInfo(selectedPlaylist.id, editTitle.trim(), editDesc.trim());
    }
    setIsEditingInfo(false);
  };

  // プレイリストリンクコピー
  const handleCopyShareLink = () => {
    if (!selectedPlaylist) return;
    const url = `${window.location.origin}/watch?list=${selectedPlaylist.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // フィルターされた動画リスト
  const filteredVideos = selectedPlaylist
    ? selectedPlaylist.videos.filter(v => 
        v.title.toLowerCase().includes(playlistSearchQuery.toLowerCase()) ||
        v.author.toLowerCase().includes(playlistSearchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 bg-white min-h-screen text-gray-900">
      {/* 1. ライブラリヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Library size={28} className="text-red-600" />
            <span>ライブラリ & 再生リスト</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            お気に入りのコレクション・作成済みプレイリスト・YouTubeインポート
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* YouTube プレイリスト インポートボタン */}
          <button
            onClick={() => { setIsImporting(true); setIsCreating(false); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold transition-all duration-200"
          >
            <Download size={15} className="text-red-600" />
            <span>YouTubeから取り込む</span>
          </button>

          {/* 新規プレイリスト作成 */}
          <button
            onClick={() => { setIsCreating(true); setIsImporting(false); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold transition-all duration-200 shadow-2xs active:scale-95"
          >
            <FolderPlus size={15} />
            <span>新規作成</span>
          </button>
        </div>
      </div>

      {/* 2. YouTube インポート モーダル */}
      {isImporting && (
        <div className="mb-8 p-6 bg-red-50/50 rounded-2xl border border-red-100 max-w-xl animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Download size={16} className="text-red-600" />
              <span>YouTube プレイリスト URL インポート</span>
            </h3>
            <button onClick={() => setIsImporting(false)} className="text-gray-400 hover:text-gray-700">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            YouTubeのプレイリストURL（例: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono">https://www.youtube.com/playlist?list=PL...</code>）を貼り付けると、すべての動画を一括で取り込んで自分のリストに保存できます。
          </p>

          <form onSubmit={handleImportSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="YouTube プレイリスト URL または ID"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:border-red-600 text-gray-900"
              autoFocus
              required
            />
            {importError && (
              <p className="text-xs text-red-600 font-bold">{importError}</p>
            )}
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsImporting(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={importLoading || !importUrl.trim()}
                className="px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {importLoading && <RefreshCw size={14} className="animate-spin" />}
                <span>{importLoading ? '読み込み中...' : 'インポート開始'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. 新規作成 モーダル */}
      {isCreating && (
        <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200 max-w-lg animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Plus size={16} />
              <span>新しい再生リストの作成</span>
            </h3>
            <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-700">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="再生リスト名 (必須)"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:border-black text-gray-900"
              autoFocus
              required
            />
            <input
              type="text"
              placeholder="説明 (任意)"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
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

      {/* 4. 最近見た動画クイックバー */}
      {history.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-gray-700" />
              <span>最近視聴した動画</span>
            </h2>
            <button
              onClick={onNavigateToHistory}
              className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
            >
              すべて見る ({history.length})
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {history.slice(0, 6).map((item) => (
              <div
                key={item.videoId}
                onClick={() => onVideoSelect(item.videoId)}
                className="group cursor-pointer flex flex-col gap-1.5"
              >
                <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 relative border border-gray-200">
                  <img crossOrigin="anonymous"
                    src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h4 className="text-xs font-bold text-gray-900 line-clamp-1 group-hover:text-red-600 transition-colors">
                  {item.title}
                </h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. プレイリスト メイングリッド & 詳細領域 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Music size={18} className="text-red-600" />
            <span>作成した再生リスト ({playlists.length})</span>
          </h2>
        </div>

        {playlists.length === 0 ? (
          <div className="p-12 text-center bg-gray-50/80 rounded-2xl border border-dashed border-gray-300">
            <ListVideo size={44} className="mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-bold text-gray-800">再生リストがまだありません</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto leading-relaxed">
              動画の「+ 保存」ボタンから追加するか、上の「YouTubeから取り込む」で既存のYouTubeプレイリストを一発で追加できます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* 左側リスト (12列中4列): プレイリスト選択カード */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              {playlists.map((pl) => {
                const isSelected = pl.id === selectedPlaylist?.id;
                const coverThumb = pl.videos[0]?.videoThumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&auto=format&fit=crop&q=80';

                return (
                  <div
                    key={pl.id}
                    onClick={() => {
                      setSelectedPlaylistId(pl.id);
                      setIsEditingInfo(false);
                    }}
                    className={`p-3.5 rounded-2xl cursor-pointer border transition-all duration-200 flex items-center gap-3.5 ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                        : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50/80 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-20 aspect-video rounded-xl overflow-hidden bg-gray-800 relative shrink-0">
                      <img crossOrigin="anonymous" src={coverThumb} alt={pl.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] font-bold">
                        {pl.videos.length}本
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-xs sm:text-sm truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {pl.title}
                      </h3>
                      {pl.description && (
                        <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                          {pl.description}
                        </p>
                      )}
                      <span className={`text-[10px] block mt-1 ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}>
                        動画 {pl.videos.length}本
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 右側詳細 (12列中8列): 選択中のプレイリストビュー & コントロール */}
            <div className="lg:col-span-8 bg-gray-50/60 rounded-2xl p-6 border border-gray-200/80 shadow-2xs">
              {selectedPlaylist ? (
                <div>
                  {/* ヘッダー・アクションバー */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-200 mb-6">
                    <div className="flex-1 min-w-0">
                      {!isEditingInfo ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight truncate">
                              {selectedPlaylist.title}
                            </h2>
                            <button
                              onClick={() => {
                                setEditTitle(selectedPlaylist.title);
                                setEditDesc(selectedPlaylist.description || '');
                                setIsEditingInfo(true);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                              title="タイトルと説明を編集"
                            >
                              <Edit3 size={15} />
                            </button>
                          </div>
                          {selectedPlaylist.description && (
                            <p className="text-xs text-gray-600 mt-1">{selectedPlaylist.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-gray-500 font-semibold mt-2">
                            <span>合計 {selectedPlaylist.videos.length} 本の動画</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 max-w-md">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                            placeholder="タイトル"
                          />
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900"
                            placeholder="説明"
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-1 bg-black text-white text-xs font-bold rounded-lg"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setIsEditingInfo(false)}
                              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                        className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-2xs disabled:opacity-40"
                      >
                        <Shuffle size={15} />
                        <span>シャッフル</span>
                      </button>

                      <button
                        onClick={handleCopyShareLink}
                        className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200/80 rounded-xl transition-colors bg-white border border-gray-200"
                        title="共有リンクをコピー"
                      >
                        {copiedLink ? <Check size={16} className="text-green-600" /> : <Link2 size={16} />}
                      </button>

                      <button
                        onClick={handleRemoveDuplicates}
                        className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200/80 rounded-xl transition-colors bg-white border border-gray-200"
                        title="重複動画を自動整理"
                      >
                        <FilePlus size={16} />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`再生リスト「${selectedPlaylist.title}」を削除しますか？`)) {
                            onDeletePlaylist(selectedPlaylist.id);
                            setSelectedPlaylistId(null);
                          }
                        }}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors bg-white border border-gray-200"
                        title="再生リストを削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 検索・絞り込み */}
                  {selectedPlaylist.videos.length > 5 && (
                    <div className="mb-4 relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="リスト内の動画を検索..."
                        value={playlistSearchQuery}
                        onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-black"
                      />
                    </div>
                  )}

                  {/* 動画一覧 */}
                  {filteredVideos.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-xs font-medium">該当する動画がありません。</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {filteredVideos.map((video, idx) => (
                        <div
                          key={`${video.videoId}-${idx}`}
                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200/80 hover:border-gray-300 transition-all group shadow-2xs"
                        >
                          <div
                            onClick={() => onVideoSelect(video.videoId!, video)}
                            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                          >
                            <span className="text-xs font-bold text-gray-400 w-6 text-center shrink-0">{idx + 1}</span>
                            <div className="w-20 aspect-video rounded-lg overflow-hidden bg-gray-100 relative shrink-0 border border-gray-100">
                              <img crossOrigin="anonymous"
                                src={video.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-red-600 transition-colors">
                                {video.title}
                              </h4>
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">{video.author}</p>
                            </div>
                          </div>

                          {/* コントロール */}
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              onClick={() => onReorderPlaylistVideo(selectedPlaylist.id, idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-20 transition-colors"
                              title="上へ移動"
                            >
                              <MoveUp size={14} />
                            </button>
                            <button
                              onClick={() => onReorderPlaylistVideo(selectedPlaylist.id, idx, idx + 1)}
                              disabled={idx === selectedPlaylist.videos.length - 1}
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-20 transition-colors"
                              title="下へ移動"
                            >
                              <MoveDown size={14} />
                            </button>
                            <button
                              onClick={() => onRemoveVideoFromPlaylist(selectedPlaylist.id, video.videoId!)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                  <p className="text-xs font-medium">再生リストを選択してください。</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. YouTube 認証済みデータ */}
      {((youtubePlaylists && youtubePlaylists.length > 0) || (watchLaterVideos && watchLaterVideos.length > 0)) && (
        <div className="mt-12 pt-10 border-t border-gray-100">
          <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2 mb-6">
            <ListVideo size={20} className="text-red-600" />
            <span>YouTube 認証済みデータ</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Watch Later column */}
            {watchLaterVideos && watchLaterVideos.length > 0 && (
              <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <Clock size={16} className="text-red-600" />
                  <span>あとで見る (Watch Later)</span>
                  <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full ml-auto">
                    {watchLaterVideos.length}本
                  </span>
                </h3>

                <div className="max-h-[360px] overflow-y-auto flex flex-col gap-2.5 pr-2">
                  {watchLaterVideos.map((video, idx) => (
                    <div
                      key={`wl-${video.videoId || idx}`}
                      onClick={() => onVideoSelect(video.videoId!, video)}
                      className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer transition-all hover:shadow-xs group"
                    >
                      <div className="w-16 aspect-video rounded-lg overflow-hidden bg-gray-100 relative shrink-0 border border-gray-100">
                        <img crossOrigin="anonymous"
                          src={video.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-red-600 transition-colors">
                          {video.title}
                        </h4>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{video.author}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Playlists column */}
            {youtubePlaylists && youtubePlaylists.length > 0 && (
              <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <Library size={16} className="text-red-600" />
                  <span>YouTube上の再生リスト</span>
                  <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full ml-auto">
                    {youtubePlaylists.length}個
                  </span>
                </h3>

                <div className="max-h-[360px] overflow-y-auto flex flex-col gap-2.5 pr-2">
                  {youtubePlaylists.map((pl, idx) => (
                    <div
                      key={`yt-pl-${pl.id || idx}`}
                      onClick={async () => {
                        try {
                          alert(`YouTubeプレイリスト「${pl.title}」を読み込んでいます...`);
                          const res = await fetchJSON(`/api/playlist/${encodeURIComponent(pl.id)}`);
                          if (res && res.videos && res.videos.length > 0) {
                            const newPl: UserPlaylist = {
                              id: `yt-import-${Date.now()}`,
                              title: res.title || pl.title,
                              description: res.description || 'YouTube上の再生リスト',
                              createdAt: Date.now(),
                              updatedAt: Date.now(),
                              videos: res.videos
                            };
                            if (onImportYouTubePlaylist) {
                              onImportYouTubePlaylist(newPl);
                            } else {
                              const createdId = onCreatePlaylist(newPl.title, newPl.description);
                              if (onAddVideosToPlaylist) {
                                onAddVideosToPlaylist(createdId, newPl.videos);
                              }
                            }
                            alert(`プレイリスト「${pl.title}」の読み込みが完了しました！`);
                          } else {
                            alert('プレイリストに動画が見つかりませんでした。');
                          }
                        } catch (err) {
                          console.error(err);
                          alert('プレイリストの読み込みに失敗しました。');
                        }
                      }}
                      className="flex items-center gap-3.5 p-2 bg-white rounded-xl border border-gray-100 hover:border-red-100 cursor-pointer transition-all hover:shadow-xs group"
                    >
                      <div className="w-16 aspect-video rounded-lg overflow-hidden bg-gray-100 relative shrink-0 border border-gray-100">
                        {pl.thumbnails ? (
                          <img crossOrigin="anonymous"
                            src={pl.thumbnails}
                            alt={pl.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <Library size={16} className="text-gray-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[9px] font-bold">
                          {pl.videoCount}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-red-600 transition-colors">
                          {pl.title}
                        </h4>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          動画 {pl.videoCount} 本 (クリックしてインポート)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
