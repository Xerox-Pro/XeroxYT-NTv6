import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Video, Music, Loader2, AlertCircle } from 'lucide-react';
import { fetchJSON } from '../utils';

interface DownloadModalProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
}

export default function DownloadModal({ videoId, isOpen, onClose, videoTitle }: DownloadModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formats, setFormats] = useState<any[]>([]);
  const [audioFormats, setAudioFormats] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDownloadInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJSON(`/api/download-info/${videoId}`);
        if (data && (data.adaptiveFormats || data.formats)) {
          const videoOptions = [...(data.adaptiveFormats || []), ...(data.formats || [])]
            .filter((f: any) => f.qualityLabel && f.mimeType && f.mimeType.includes('video/'))
            .sort((a, b) => {
              const resA = parseInt(a.qualityLabel.replace(/[^0-9]/g, '')) || 0;
              const resB = parseInt(b.qualityLabel.replace(/[^0-9]/g, '')) || 0;
              return resB - resA;
            });

          // Filter unique resolutions
          const uniqueVideos = [];
          const seenLabels = new Set();
          for (const v of videoOptions) {
            if (!seenLabels.has(v.qualityLabel)) {
              seenLabels.add(v.qualityLabel);
              uniqueVideos.push(v);
            }
          }

          const audioOptions = (data.adaptiveFormats || [])
            .filter((f: any) => f.mimeType && f.mimeType.includes('audio/'));

          setFormats(uniqueVideos);
          setAudioFormats(audioOptions);
        } else {
          setError('ダウンロードリンクが見つかりませんでした。');
        }
      } catch (err: any) {
        setError(err.message || 'ダウンロード情報の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchDownloadInfo();
  }, [isOpen, videoId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">ダウンロード</h2>
              <p className="text-xs text-gray-500 truncate max-w-[280px] mt-0.5">{videoTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 overflow-y-auto min-h-[200px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">ダウンロードリンクを生成中...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-red-500 bg-red-50 rounded-xl p-4 text-center">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm font-medium">{error}</p>
                <p className="text-xs text-red-400">この動画はダウンロードできない可能性があります。</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Video Options */}
                {formats.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-gray-800">
                      <Video size={16} className="text-blue-600" />
                      動画 (映像 + 音声)
                    </h3>
                    <div className="space-y-2">
                      {formats.map((f, i) => (
                        <a
                          key={`video-${i}`}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700">
                              {f.qualityLabel}
                            </span>
                            {f.mimeType && (
                              <span className="text-[10px] text-gray-400 uppercase">
                                {f.mimeType.split(';')[0]}
                              </span>
                            )}
                          </div>
                          <Download size={16} className="text-gray-400 group-hover:text-blue-600" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio Options */}
                {audioFormats.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-gray-800 mt-2">
                      <Music size={16} className="text-red-500" />
                      音声のみ
                    </h3>
                    <div className="space-y-2">
                      {audioFormats.map((f, i) => (
                        <a
                          key={`audio-${i}`}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors group"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 group-hover:text-red-700">
                              {f.audioQuality?.replace('AUDIO_QUALITY_', '') || '音声ファイル'}
                            </span>
                            {f.mimeType && (
                              <span className="text-[10px] text-gray-400 uppercase">
                                {f.mimeType.split(';')[0]}
                              </span>
                            )}
                          </div>
                          <Download size={16} className="text-gray-400 group-hover:text-red-600" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
