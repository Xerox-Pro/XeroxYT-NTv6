import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Video } from '../types';
import { fetchJSON, formatNumberJP } from '../utils';
import { isShortsLocation, MAX_SHORT_PAGES, mixShorts } from '../lib/shortsFeed.mjs';
import ShortsComments from './ShortsComments';
import { ShortsContext, shortsQuery } from './ShortsShelf';

function ShortEmbed({ video, onRecord, onMetadata }: {
  video: Video; onRecord: (video: Video) => void; onMetadata: (video: Video) => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const detail = useRef<Video | null>(null);
  const callbacks = useRef({ onRecord, onMetadata }); callbacks.current = { onRecord, onMetadata };
  useEffect(() => {
    let cancelled = false;
    setUrl(''); setError(''); detail.current = null;
    Promise.all([
      fetchJSON(`/api/shorts/${video.videoId}?title=${encodeURIComponent(video.title.slice(0, 160))}`),
      fetch(`/api/edu/${video.videoId}`).then(async response => {
        if (!response.ok) throw new Error('埋め込み動画を読み込めませんでした。');
        return response.text();
      }),
    ]).then(([metadata, rawUrl]) => {
      if (cancelled) return;
      if (!metadata.aspectVerified) throw new Error('縦長のショートであることを確認できませんでした。');
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' || !['www.youtubeeducation.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(parsed.hostname)) throw new Error('埋め込みURLが正しくありません。');
      parsed.searchParams.delete('enablejsapi');
      for (const [key, value] of Object.entries({ controls: '1', playsinline: '1', autoplay: '1', mute: '1', rel: '0' })) parsed.searchParams.set(key, value);
      detail.current = metadata; callbacks.current.onMetadata(metadata); setUrl(parsed.toString());
    }).catch(reason => { if (!cancelled) setError(reason.message || '動画を読み込めませんでした。'); });
    return () => { cancelled = true; };
  }, [video.videoId, video.title, attempt]);
  return <div className="shorts-frame">
    {url && <iframe src={url} title={video.title} className="shorts-iframe" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { if (detail.current) callbacks.current.onRecord(detail.current); }} />}
    {!url && !error && <div className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin" size={28} /></div>}
    {error && <div className="shorts-embed-error" role="status"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)} className="underline mt-3">再試行</button></div>}
  </div>;
}

export default function ShortsViewer({ initialId, initialVideo, context, onRecord, onSelectChannel }: {
  initialId?: string; initialVideo?: Video; context: ShortsContext;
  onRecord: (video: Video) => void; onSelectChannel: (id: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const route = useRef(location); route.current = location;
  const navigateRef = useRef(navigate); navigateRef.current = navigate;
  const seed = useRef(initialId ? initialVideo || { videoId: initialId, title: 'ショート動画', author: 'チャンネル', isShort: true, viewCount: 0, publishedText: '', lengthSeconds: 0, videoThumbnails: [] } as Video : null);
  const [regular, setRegular] = useState<Video[]>(seed.current ? [seed.current] : []);
  const [ranking, setRanking] = useState<Video[]>([]);
  const [rankingReady, setRankingReady] = useState(false);
  const [rankingError, setRankingError] = useState('');
  const [rankingUpdated, setRankingUpdated] = useState('');
  const [activeId, setActiveId] = useState(initialId || '');
  const [metadata, setMetadata] = useState<Record<string, Video>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [commentsId, setCommentsId] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const query = shortsQuery(context).toString();
  const videos: Video[] = !rankingReady ? [] : ranking.length ? mixShorts(regular, ranking, seed.current?.videoId) : regular;
  const ids = videos.map(video => video.videoId).join(',');
  useEffect(() => {
    let cancelled = false;
    fetchJSON('/api/shorts-ranking').then(data => {
      if (!cancelled) { setRanking(data.videos || []); setRankingUpdated(data.updatedAt || ''); }
    }).catch(reason => { if (!cancelled) setRankingError(reason.message || 'ランキングを取得できませんでした。'); })
      .finally(() => { if (!cancelled) setRankingReady(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false; pending.current = true; setLoading(true); setError('');
    fetchJSON(`/api/shorts?${query}&page=${page}`).then(data => {
      if (cancelled) return;
      const items: Video[] = (data.videos || []).filter((video: Video) => video.isShort);
      setRegular(previous => [...new Map([...previous, ...items].map(video => [video.videoId, video])).values()]);
      setHasMore(Boolean(data.hasMore));
    }).catch(reason => { if (!cancelled) setError(reason.message || 'ショートを読み込めませんでした。'); })
      .finally(() => { if (!cancelled) { pending.current = false; setLoading(false); } });
    return () => { cancelled = true; };
  }, [query, page, attempt]);
  useEffect(() => {
    if (!videos.length) return;
    setActiveId(previous => videos.some(video => video.videoId === previous) ? previous : videos[0].videoId!);
  }, [ids]);
  useEffect(() => {
    const container = scroll.current;
    if (!container) return;
    const observer = new IntersectionObserver(entries => {
      // This component can remain mounted during its exit animation. Never
      // reactivate or navigate from a feed after the user has left its route.
      if (!isShortsLocation(route.current.pathname)) return;
      for (const entry of entries) if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        setActiveId((entry.target as HTMLElement).dataset.shortId!); setCommentsId('');
      }
    }, { root: container, threshold: [0.6] });
    container.querySelectorAll('[data-short-id]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);
  useEffect(() => {
    if (!initialId || initialId === activeRef.current) return;
    setActiveId(initialId); setCommentsId('');
    scroll.current?.querySelector<HTMLElement>(`[data-short-id="${initialId}"]`)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [initialId]);
  useEffect(() => {
    if (!activeId || !isShortsLocation(route.current.pathname)) return;
    const pathname = `/shorts/${activeId}`;
    const search = `?${query}`;
    if (route.current.pathname !== pathname || route.current.search !== search) navigateRef.current(pathname + search, { replace: true });
    // Synchronize only a new active clip, never a navigation or a loading state.
  }, [activeId, query]);
  useEffect(() => {
    const index = videos.findIndex(video => video.videoId === activeId);
    const filledRanking = ranking.length > 0 && videos.length >= ranking.length * 2;
    if (rankingReady && !filledRanking && index >= videos.length - 6 && hasMore && !loading && !pending.current && !error && page < MAX_SHORT_PAGES) setPage(value => value + 1);
  }, [activeId, ids, rankingReady, ranking.length, hasMore, loading, error, page]);
  const move = useCallback((direction: number) => {
    const index = videos.findIndex(video => video.videoId === activeRef.current);
    (scroll.current?.querySelectorAll<HTMLElement>('[data-short-id]')[index + direction])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ids]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!isShortsLocation(route.current.pathname) || commentsId || /INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as HTMLElement)?.tagName)) return;
      if (['ArrowDown', 'PageDown', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); move(['ArrowDown', 'PageDown'].includes(event.key) ? 1 : -1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [move, commentsId]);
  return <section className="shorts-viewer" aria-label="ショート動画">
    <div className="shorts-scroll" ref={scroll} tabIndex={0} aria-label="動画の外側を上下にスクロールして切り替え">
      {videos.map(video => {
        const info = metadata[video.videoId!] || video;
        return <article className="shorts-slide" key={video.videoId} data-short-id={video.videoId} aria-label={info.title}>
          {video.videoId === activeId ? <ShortEmbed video={video} onRecord={onRecord} onMetadata={detail => setMetadata(previous => ({ ...previous, [detail.videoId!]: detail }))} />
            : <div className="shorts-frame"><img src={video.videoThumbnails[0]?.url} alt="" loading="lazy" className="w-full h-full object-cover" /></div>}
          <div className="shorts-caption">
            <h1 className="font-semibold text-sm line-clamp-2">{info.title}</h1>
            <button className="text-xs text-gray-600 hover:underline mt-1" onClick={() => onSelectChannel(info.authorId || info.author)}>{info.author}</button>
            <p className="text-xs text-gray-500 mt-1">{info.viewCount > 0 ? `${formatNumberJP(info.viewCount)}回視聴` : ''}{info.likeCount == null ? '' : ` · 高評価 ${formatNumberJP(info.likeCount)}`}</p>
            <details className="shorts-comment-disclosure" open={commentsId === video.videoId} onToggle={event => { if (video.videoId === activeRef.current) setCommentsId(event.currentTarget.open ? video.videoId! : ''); }}>
              <summary className="text-sm text-gray-600 cursor-pointer py-2">コメント</summary>
              {commentsId === video.videoId && <ShortsComments key={video.videoId} videoId={video.videoId!} inline onSelectChannel={onSelectChannel} />}
            </details>
          </div>
        </article>;
      })}
      <div className="shorts-feed-end">
        {(loading || !rankingReady) && <p className="flex gap-2"><Loader2 size={18} className="animate-spin" />読み込み中…</p>}
        {error && <p role="status">{error}<button className="underline ml-2" onClick={() => setAttempt(value => value + 1)}>再試行</button></p>}
        {!loading && rankingReady && !error && <p>{videos.length ? 'ここまでのショートを表示しました。' : '表示できる縦長ショートがありません。'}</p>}
        {!loading && !error && hasMore && page < MAX_SHORT_PAGES && (!ranking.length || videos.length < ranking.length * 2) && <button className="underline mt-3" onClick={() => setPage(value => value + 1)}>続きを読み込む</button>}
      </div>
    </div>
    <footer className="shorts-feed-source"><span>動画の外側を上下にスクロール</span>{rankingReady && <span>{rankingError ? rankingError : <><a href="https://shorts-ranking.com/" target="_blank" rel="noreferrer">Shortsランキング</a> {ranking.length}件／上限200件{rankingUpdated ? `（${rankingUpdated}）` : ''}</>}</span>}</footer>
  </section>;
}
