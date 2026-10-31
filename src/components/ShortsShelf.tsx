import { withShortsInterests } from '../lib/shortsInterests.mjs';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ChevronRight, Loader2 } from 'lucide-react';
import { Video } from '../types';
import { mixShorts, createShortsSession, readSeenShorts, discoveryRequest, unseenRankingFirst } from '../lib/shortsFeed.mjs';
import { fetchJSON, formatNumberJP } from '../utils';

export type ShortsContext = { source: 'home' | 'search' | 'related'; q?: string; videoId?: string };
export function shortsQuery(context: ShortsContext) {
  const params = new URLSearchParams({ source: context.source });
  if (context.q) params.set('q', context.q.slice(0, 200));
  if (context.videoId) params.set('videoId', context.videoId);
  return params;
}
export default function ShortsShelf({ context, onSelect }: {
  context: ShortsContext; onSelect: (video: Video, context: ShortsContext) => void;
}) {
  const [session] = useState(createShortsSession);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const query = shortsQuery(context).toString();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setVideos([]); setError('');
    const seen = readSeenShorts();
    Promise.allSettled([fetchJSON(discoveryRequest(withShortsInterests(query), 1, session, seen)), context.source === 'search' ? Promise.resolve({ videos: [] }) : fetchJSON('/api/shorts-ranking')]).then(([native, ranked]) => {
      if (native.status === 'rejected') throw native.reason;
      const regular = (native.value.videos || []).filter((v: Video) => v.isShort);
      const ranking = ranked.status === 'fulfilled' ? unseenRankingFirst(ranked.value.videos || [], seen) : [];
      if (!cancelled) setVideos(ranking.length ? mixShorts(regular, ranking) : regular);
    }).catch(err => { if (!cancelled) setError(err.message || 'ショートを取得できませんでした'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, session, attempt]);
  if (!loading && !error && !videos.length) return null;
  return <section className="shorts-shelf" aria-label="ショート動画のおすすめ">
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Zap className="text-red-600 fill-red-600" size={22} />ショート</h2>
      <Link to={`/shorts?${query}`} className="flex items-center text-xs font-semibold text-gray-600 hover:text-black">すべて見る<ChevronRight size={16} /></Link>
    </div>
    {loading ? <div className="flex items-center gap-2 text-sm text-gray-500 py-8"><Loader2 size={18} className="animate-spin" />ショートを読み込み中…</div>
      : error ? <div className="text-sm text-gray-500"><p role="status">{error}</p><button className="mt-2 underline" onClick={() => setAttempt(a => a + 1)}>再試行</button></div>
      : <div className="shorts-shelf-scroll">
        {videos.map(video => <button key={video.videoId} className="shorts-cover text-left group" onClick={() => onSelect(video, context)}>
          <div className="aspect-[9/16] overflow-hidden rounded-xl bg-gray-100 relative">
            <img src={video.videoThumbnails[0]?.url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            <span className="absolute bottom-2 left-2 text-[11px] bg-black/60 text-white rounded px-2 py-1">ショート</span>
          </div>
          <h3 className="font-semibold text-sm mt-2 line-clamp-2 leading-snug">{video.title}</h3>
          {video.viewCountText || video.viewCount > 0 ? <p className="text-xs text-gray-500 mt-1">{video.viewCountText || `${formatNumberJP(video.viewCount)}回視聴`}</p> : null}
        </button>)}
      </div>}
  </section>;
}
