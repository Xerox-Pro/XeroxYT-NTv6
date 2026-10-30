import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Play, Pause, Volume2, VolumeX, ThumbsUp, ThumbsDown, MessageCircle, Share2, Loader2, RotateCw, ExternalLink, Plus, Zap } from 'lucide-react';
import { Video } from '../types';
import { fetchJSON, formatNumberJP } from '../utils';
import { loadPlayerApi } from '../lib/youtubePlayer';
import ShortsComments from './ShortsComments';
import { ShortsContext, shortsQuery } from './ShortsShelf';

function ShortPlayback({ videoId, title, onRecord, onMetadata }: { videoId: string; title: string; onRecord: (video: Video) => void; onMetadata: (video: Video) => void }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState('');
  const iframe = useRef<HTMLIFrameElement>(null);
  const player = useRef<any>(null);
  const record = useRef(onRecord); record.current = onRecord;
  const metadataReady = useRef(onMetadata); metadataReady.current = onMetadata;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setVideo(null); setError(''); setUrl(''); setReady(false);
    // The player is created only after the actual stream dimensions were checked.
    Promise.all([
      fetchJSON(`/api/shorts/${videoId}?title=${encodeURIComponent(title.slice(0, 160))}`),
      fetch(`/api/edu/${videoId}`).then(async res => { if (!res.ok) throw new Error('プレイヤーの取得に失敗しました'); return res.text(); }),
    ]).then(([metadata, rawUrl]) => {
      if (cancelled) return;
      if (!metadata.aspectVerified) throw new Error('縦長の動画であることを確認できませんでした');
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' || !['www.youtubeeducation.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(parsed.hostname)) throw new Error('プレイヤーURLが正しくありません');
      for (const [key, value] of Object.entries({ enablejsapi: '1', origin: window.location.origin, autoplay: '1', mute: '1', controls: '0', playsinline: '1', loop: '1', playlist: videoId, rel: '0' })) parsed.searchParams.set(key, value);
      setVideo(metadata); metadataReady.current(metadata); setUrl(parsed.toString());
    }).catch(err => { if (!cancelled) setError(err.message || '動画を読み込めませんでした'); });
    return () => { cancelled = true; };
  }, [videoId, title, attempt]);
  useEffect(() => {
    if (!url || !iframe.current || !video) return;
    let cancelled = false;
    let instance: any;
    let recorded = false;
    loadPlayerApi().then(YT => {
      if (cancelled || !iframe.current) return;
      instance = new YT.Player(iframe.current, { events: {
        onReady: () => { if (cancelled) return; player.current = instance; instance.mute(); instance.playVideo(); setMuted(true); setReady(true); },
        onStateChange: (event: any) => {
          if (cancelled) return;
          setPlaying(event.data === 1);
          if (event.data === 1 && !recorded) { recorded = true; record.current(video); }
          if (event.data === 0) { instance.seekTo(0); instance.playVideo(); }
        },
        onError: () => { if (!cancelled) setError('この動画は埋め込み再生できません。次のショートへ移動してください。'); },
      } });
    }).catch(() => { if (!cancelled) setError('プレイヤーに接続できませんでした。再試行してください。'); });
    const timer = window.setInterval(() => {
      if (instance?.getDuration) setProgress(instance.getDuration() ? instance.getCurrentTime() / instance.getDuration() * 100 : 0);
    }, 500);
    const visibility = () => { if (document.hidden) instance?.pauseVideo?.(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); instance?.destroy?.(); player.current = null; };
  }, [url, video]);
  const toggle = () => { if (playing) player.current?.pauseVideo?.(); else player.current?.playVideo?.(); };
  return <>
    {url && !error && <iframe ref={iframe} src={url} title={video?.title || 'ショート動画プレイヤー'} className="shorts-iframe" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" tabIndex={-1} />}
    {!error && <button className="shorts-tap-area" onClick={toggle} aria-label={playing ? '一時停止' : '再生'} disabled={!ready}>{ready && !playing && <Play size={56} fill="white" />}</button>}
    {!url && !error && <div className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin" size={32} /></div>}
    {error && <div role="status" className="absolute inset-0 z-20 flex flex-col justify-center items-center p-8 text-center gap-4 bg-neutral-950 text-sm"><p>{error}</p><button onClick={() => setAttempt(a => a + 1)} className="flex gap-2 items-center px-4 py-2 bg-white/15 rounded-full"><RotateCw size={16} />再試行</button></div>}
    {ready && !error && <>
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <button className="shorts-player-control pointer-events-auto" onClick={toggle} aria-label={playing ? '一時停止' : '再生'}>{playing ? <Pause size={21} /> : <Play size={21} />}</button>
        <button className="shorts-player-control pointer-events-auto" onClick={() => { if (muted) player.current?.unMute(); else player.current?.mute(); setMuted(!muted); }} aria-label={muted ? '音声をオン' : 'ミュート'}>{muted ? <VolumeX size={21} /> : <Volume2 size={21} />}</button>
      </div>
      <input type="range" min="0" max="100" step="0.1" value={progress} aria-label="ショートの再生位置" className="shorts-progress" onChange={event => { const value = Number(event.target.value); player.current?.seekTo(player.current.getDuration() * value / 100, true); setProgress(value); }} />
    </>}
  </>;
}

export default function ShortsViewer({ initialId, context, onRecord, onSelectChannel, onSave }: {
  initialId?: string; context: ShortsContext; onRecord: (video: Video) => void;
  onSelectChannel: (id: string) => void; onSave: (video: Video) => void;
}) {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeId, setActiveId] = useState(initialId || '');
  const [metadata, setMetadata] = useState<Record<string, Video>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [ratings, setRatings] = useState<Record<string, 'like' | 'dislike'>>(() => {
    try { return JSON.parse(localStorage.getItem('xerox_shorts_ratings_v1') || '{}'); } catch { return {}; }
  });
  const scroll = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const initial = useRef(initialId);
  const currentId = useRef(activeId); currentId.current = activeId;
  const initialScroll = useRef(false);
  const query = shortsQuery(context).toString();
  useEffect(() => {
    setVideos(initial.current ? [{ videoId: initial.current, title: 'ショート動画', author: 'チャンネル', isShort: true, viewCount: 0, publishedText: '', lengthSeconds: 0, videoThumbnails: [] }] : []);
    setActiveId(initial.current || ''); setPage(1); setHasMore(true); setCommentsOpen(false); initialScroll.current = false;
  }, [query]);
  useEffect(() => {
    let cancelled = false;
    pending.current = true;
    setLoading(true); setError('');
    fetchJSON(`/api/shorts?${query}&page=${page}`).then(data => {
      if (cancelled) return;
      const items: Video[] = (data.videos || []).filter((v: Video) => v.isShort);
      setVideos(old => [...new Map([...old, ...items].map(v => [v.videoId, v])).values()]);
      setActiveId(old => old || items[0]?.videoId || '');
      setHasMore(Boolean(data.hasMore));
    }).catch(err => { if (!cancelled) setError(err.message || 'ショートを読み込めませんでした'); })
      .finally(() => { if (!cancelled) { pending.current = false; setLoading(false); } });
    return () => { cancelled = true; };
  }, [query, page, attempt]);
  // Back/forward and direct links select the requested short without restarting the feed.
  useEffect(() => {
    if (!initialId || initialId === currentId.current) return;
    setActiveId(initialId); setCommentsOpen(false);
    setVideos(old => old.some(v => v.videoId === initialId) ? old : [...old, { videoId: initialId, title: 'ショート動画', author: 'チャンネル', isShort: true, viewCount: 0, publishedText: '', lengthSeconds: 0, videoThumbnails: [] }]);
    initialScroll.current = true;
  }, [initialId]);
  useEffect(() => {
    const container = scroll.current;
    if (!container) return;
    if (initialScroll.current) {
      container.querySelector<HTMLElement>(`[data-short-id="${activeId}"]`)?.scrollIntoView({ block: 'start', behavior: 'instant' });
      initialScroll.current = false;
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
        const id = (entry.target as HTMLElement).dataset.shortId!;
        setActiveId(id); setCommentsOpen(false);
      }
    }, { root: container, threshold: [0.7] });
    container.querySelectorAll('[data-short-id]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [videos]);
  useEffect(() => {
    if (!activeId) return;
    navigate(`/shorts/${activeId}?${query}`, { replace: true });
    setNotice('');
    const index = videos.findIndex(v => v.videoId === activeId);
    if (index >= videos.length - 3 && hasMore && !loading && !pending.current && !error && page < 6) setPage(p => p + 1);
  }, [activeId, videos, hasMore, loading, error, query, navigate, page]);
  const activeIndex = videos.findIndex(v => v.videoId === activeId);
  const activeVideo = metadata[activeId] || videos[activeIndex];
  // Metadata is fetched once in the active card; store the result for title/actions.
  const record = useCallback((video: Video) => {
    setMetadata(old => ({ ...old, [video.videoId!]: video }));
    onRecord(video);
  }, [onRecord]);
  const move = useCallback((direction: number) => {
    const container = scroll.current;
    if (!container) return;
    const target = container.children[activeIndex + direction] as HTMLElement;
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }, [activeIndex]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (commentsOpen || /INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as HTMLElement)?.tagName)) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); move(-1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [move, commentsOpen]);
  const rate = (rating: 'like' | 'dislike') => {
    const updated = { ...ratings };
    if (updated[activeId] === rating) delete updated[activeId]; else updated[activeId] = rating;
    setRatings(updated);
    try { localStorage.setItem('xerox_shorts_ratings_v1', JSON.stringify(updated)); } catch {}
    setNotice('評価をこの端末に保存しました（YouTubeには送信されません）');
  };
  return <div className={`shorts-viewer ${commentsOpen ? 'shorts-with-comments' : ''}`}>
    <div className="shorts-stage" inert={commentsOpen ? true : undefined}>
      <div className="shorts-scroll" ref={scroll} tabIndex={0} aria-label="ショート動画。上下にスワイプして切り替え">
        {videos.map(video => <article className="shorts-slide" key={video.videoId} data-short-id={video.videoId} aria-label={video.title}>
          <div className="shorts-frame">
            {video.videoId === activeId ? <ShortPlayback key={video.videoId} videoId={video.videoId!} title={video.title} onRecord={record} onMetadata={(detail) => setMetadata(old => ({ ...old, [detail.videoId!]: detail }))} />
              : <img className="w-full h-full object-cover opacity-70" alt="" loading="lazy" src={video.videoThumbnails[0]?.url} />}
            <div className="shorts-caption">
              <button onClick={() => onSelectChannel((metadata[video.videoId!]?.authorId || video.authorId) || (metadata[video.videoId!]?.author || video.author))} className="font-bold text-sm mb-2 hover:underline">{metadata[video.videoId!]?.author || video.author}</button>
              <h1 className="text-sm font-medium line-clamp-3 leading-relaxed">{metadata[video.videoId!]?.title || video.title}</h1>
            </div>
          </div>
        </article>)}
        <div className="shorts-feed-end">
          {loading && <p className="flex gap-2 items-center"><Loader2 size={20} className="animate-spin" />ショートを読み込み中…</p>}
          {error && <><p role="status">{error}</p><button onClick={() => setAttempt(a => a + 1)} className="underline mt-3">再試行</button></>}
          {!loading && !error && <p>{videos.length ? 'ここまでのショートをすべて表示しました' : '縦長のショート動画が見つかりませんでした'}</p>}
          {!loading && !error && hasMore && page < 6 && <button className="mt-4 underline" onClick={() => setPage(p => p + 1)}>続きを読み込む</button>}
        </div>
      </div>
      {activeVideo && <div className="shorts-actions">
        <button className="shorts-action" aria-pressed={ratings[activeId] === 'like'} title="高評価をこの端末に保存" onClick={() => rate('like')}><span><ThumbsUp size={23} fill={ratings[activeId] === 'like' ? 'currentColor' : 'none'} /></span><small>{activeVideo.likeCount == null ? '高評価' : formatNumberJP(activeVideo.likeCount)}</small></button>
        <button className="shorts-action" aria-pressed={ratings[activeId] === 'dislike'} title="低評価をこの端末に保存" onClick={() => rate('dislike')}><span><ThumbsDown size={23} fill={ratings[activeId] === 'dislike' ? 'currentColor' : 'none'} /></span><small>低評価</small></button>
        <button className="shorts-action" onClick={() => setCommentsOpen(true)}><span><MessageCircle size={23} /></span><small>コメント</small></button>
        <button className="shorts-action" onClick={async () => {
          const url = `${window.location.origin}/shorts/${activeId}`;
          try { if (navigator.share) await navigator.share({ title: activeVideo.title, url }); else { await navigator.clipboard.writeText(url); setNotice('リンクをコピーしました'); } } catch { setNotice('共有を完了できませんでした'); }
        }}><span><Share2 size={23} /></span><small>共有</small></button>
        <button className="shorts-action" onClick={() => onSave(activeVideo)}><span><Plus size={23} /></span><small>保存</small></button>
        <button className="shorts-action" onClick={() => navigate(`/watch?v=${activeId}`)}><span><ExternalLink size={20} /></span><small>通常表示</small></button>
      </div>}
      <div className="shorts-navigation">
        <button disabled={activeIndex <= 0} onClick={() => move(-1)} aria-label="前のショート"><ArrowUp size={24} /></button>
        <button disabled={activeIndex < 0 || activeIndex >= videos.length - 1} onClick={() => move(1)} aria-label="次のショート"><ArrowDown size={24} /></button>
      </div>
      <p className="shorts-instruction"><Zap size={13} />上下にスワイプ / ↑ ↓</p>
    </div>
    {commentsOpen && activeId && <ShortsComments key={activeId} videoId={activeId} onClose={() => setCommentsOpen(false)} onSelectChannel={onSelectChannel} />}
    {notice && <p className="shorts-notice" role="status">{notice}</p>}
  </div>;
}
