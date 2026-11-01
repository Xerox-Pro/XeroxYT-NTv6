import { createPlaybackTracker, learnInteraction, rankCandidates } from '../lib/localRecommendations.mjs';
import { loadShortsRanking } from '../lib/rankingClient.mjs';
import { withShortsInterests } from '../lib/shortsInterests.mjs';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ThumbsUp, MessageCircle, AlignLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';
import Avatar from './Avatar';
import { Video } from '../types';
import { fetchJSON, formatNumberJP } from '../utils';
import { excludeSeenShorts, isShortsLocation, MAX_SHORT_PAGES, mixShorts, createShortsSession, readSeenShorts, recordSeenShort, discoveryRequest, unseenRankingFirst } from '../lib/shortsFeed.mjs';
import ShortsComments from './ShortsComments';
import { getShortEmbedUrl } from '../lib/shortsEmbedCache.mjs';
import { ShortsContext, shortsQuery } from './ShortsShelf';

function ShortEmbed({ video, onRecord, onMetadata, children, active, isSelected }: {
  video: Video; onRecord: (video: Video) => void; onMetadata: (video: Video) => void; children?: ReactNode; active: boolean; isSelected: () => boolean;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const detail = useRef<Video | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const activeRef = useRef(active); activeRef.current = active;
  const recorded = useRef(false);
  const command = (func: string) => { if (frame.current?.contentWindow && url) frame.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), new URL(url).origin); };
  const record = () => { if (activeRef.current && detail.current && !recorded.current) { recorded.current = true; callbacks.current.onRecord(detail.current); } };
  const callbacks = useRef({ onRecord, onMetadata, isSelected }); callbacks.current = { onRecord, onMetadata, isSelected };
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setUrl(''); setError(''); detail.current = null;
    Promise.all([
      fetchJSON(`/api/shorts/${video.videoId}?title=${encodeURIComponent(video.title.slice(0, 160))}&details=2`, { signal: controller.signal }),
      getShortEmbedUrl(video.videoId, controller.signal),
    ]).then(([metadata, rawUrl]) => {
      if (cancelled) return;
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' || !['www.youtubeeducation.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(parsed.hostname)) throw new Error('埋め込みURLが正しくありません。');
      parsed.searchParams.set('enablejsapi', '1');
      parsed.searchParams.set('origin', window.location.origin);
      for (const [key, value] of Object.entries({ loop: '1', playlist: video.videoId!, controls: '1', playsinline: '1', autoplay: activeRef.current ? '1' : '0', mute: '1', rel: '0' })) parsed.searchParams.set(key, value);
      detail.current = metadata; callbacks.current.onMetadata(metadata); setUrl(parsed.toString());
    }).catch(reason => { if (!cancelled) setError(reason.message || '動画を読み込めませんでした。'); });
    return () => { cancelled = true; controller.abort(); };
  }, [video.videoId, video.title, attempt]);
  useEffect(() => {
    if (!url) return;
    const sync = () => { command(active ? 'playVideo' : 'pauseVideo'); if (active) record(); };
    sync(); const timers = [300, 800, 1600].map(delay => window.setTimeout(sync, delay));
    return () => timers.forEach(clearTimeout);
  }, [active, url]);
  useEffect(() => {
    if (!active || !url) return;
    const tracker = createPlaybackTracker(detail.current || video);
    let playing = false;
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!['infoDelivery', 'initialDelivery'].includes(data?.event) || !data.info) return;
        if (typeof data.info.playerState === 'number') playing = data.info.playerState === 1;
        if (typeof data.info.currentTime === 'number') tracker.update(data.info.currentTime, data.info.duration || detail.current?.lengthSeconds, playing, document.visibilityState !== 'hidden');
      } catch {}
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); tracker.finish(callbacks.current.isSelected() ? 'leave' : 'skip'); };
  }, [active, url, video.videoId]);
  return <div className="shorts-frame">
    {url && <iframe ref={frame} tabIndex={active ? 0 : -1} aria-hidden={!active} src={url} title={video.title} className="shorts-iframe" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), new URL(url).origin); command(activeRef.current ? 'playVideo' : 'pauseVideo'); record(); }} />}
    {!url && !error && <div className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin" size={28} /></div>}
    {children}
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
  const channelMode = context.source === 'channel' && !!context.channelId;
  const [channelStart] = useState(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem(`xerox_channel_shorts_${context.channelId}`) || 'null');
      if (channelMode && Array.isArray(data?.videos)) return data;
    } catch {}
    return null;
  });
  const positioned = useRef(false);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const seed = useRef(initialId ? initialVideo || { videoId: initialId, title: 'ショート動画', author: 'チャンネル', isShort: true, viewCount: 0, publishedText: '', lengthSeconds: 0, videoThumbnails: [] } as Video : null);
  const [session] = useState(createShortsSession);
  const [seenOnEntry] = useState(readSeenShorts);
  const regularRef = useRef<Video[]>([]);
  const [regular, setRegular] = useState<Video[]>(channelMode && channelStart ? [...channelStart.videos] : seed.current ? [seed.current] : []);
  const [ranking, setRanking] = useState<Video[]>([]);
  const [rankingReady, setRankingReady] = useState(false);
  const [rankingError, setRankingError] = useState('');
  const [rankingUpdated, setRankingUpdated] = useState('');
  const [activeId, setActiveId] = useState(initialId || '');
  const [metadata, setMetadata] = useState<Record<string, Video>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(channelStart?.page || 1);
  const [hasMore, setHasMore] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [commentsId, setCommentsId] = useState('');
  const [descriptionId, setDescriptionId] = useState('');
  const [likes, setLikes] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('xerox_shorts_likes_v1') || '{}'); } catch { return {}; } });
  const scroll = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const query = shortsQuery(context).toString();
  regularRef.current = regular;
  const ranked = unseenRankingFirst(excludeSeenShorts(ranking, seenOnEntry, seed.current?.videoId), seenOnEntry, seed.current?.videoId);
  const videos: Video[] = !rankingReady ? [] : ranked.length ? mixShorts(regular, ranked, seed.current?.videoId) : regular;
  const ids = videos.map(video => video.videoId).join(',');
  useEffect(() => {
    let cancelled = false;
    ((context.source === 'search' || channelMode) ? Promise.resolve({ videos: [], updatedAt: '' }) : loadShortsRanking()).then(data => {
      if (!cancelled) { setRanking(rankCandidates(excludeSeenShorts(data.videos || [], readSeenShorts(), seed.current?.videoId), { short: true, seed: session, seen: seenOnEntry })); setRankingUpdated(data.updatedAt || ''); }
    }).catch(reason => { if (!cancelled) setRankingError(reason.message || 'ランキングを取得できませんでした。'); })
      .finally(() => { if (!cancelled) setRankingReady(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false; pending.current = true; setLoading(true); setError('');
    if (channelMode) {
      fetchJSON(`/api/channel/${encodeURIComponent(context.channelId!)}/tab/shorts?page=${page}&sort=latest`).then(data => {
        if (cancelled) return;
        const current = scroll.current?.querySelector<HTMLElement>(`[data-short-id="${activeRef.current}"]`);
        if (current) anchor.current = { id: activeRef.current, top: current.getBoundingClientRect().top };
        const older = (data.videos || []).filter((video: Video) => video.videoId);
        const combined: Video[] = [...new Map([...regularRef.current, ...older].map(video => [video.videoId, video])).values()] as Video[];
        setRegular(combined);
        try { sessionStorage.setItem(`xerox_channel_shorts_${context.channelId}`, JSON.stringify({ videos: combined, page, hasMore: Boolean(data.hasMore) })); } catch {}
        setHasMore(Boolean(data.hasMore));
      }).catch(reason => { if (!cancelled) setError(reason.message || 'チャンネルのショートを取得できませんでした。'); })
        .finally(() => { if (!cancelled) { pending.current = false; setLoading(false); } });
      return () => { cancelled = true; };
    }
    const excluded = [...regularRef.current.map(video => video.videoId!), ...readSeenShorts()];
    fetchJSON(discoveryRequest(withShortsInterests(query, page), page, session, excluded)).then(data => {
      if (cancelled) return;
      const items: Video[] = rankCandidates(excludeSeenShorts((data.videos || []).filter((video: Video) => video.isShort), readSeenShorts(), seed.current?.videoId), { short: true, seed: session, seen: readSeenShorts() });
      setRegular(previous => [...new Map([...previous, ...items].map(video => [video.videoId, video])).values()]);
      setHasMore(Boolean(data.hasMore));
    }).catch(reason => { if (!cancelled) setError(reason.message || 'ショートを読み込めませんでした。'); })
      .finally(() => { if (!cancelled) { pending.current = false; setLoading(false); } });
    return () => { cancelled = true; };
  }, [query, page, session, attempt]);
  useLayoutEffect(() => {
    if (!channelMode || !scroll.current || !videos.length) return;
    const selected = scroll.current.querySelector<HTMLElement>(`[data-short-id="${initialId}"]`);
    if (!positioned.current && selected) {
      scroll.current.scrollTop += selected.getBoundingClientRect().top - scroll.current.getBoundingClientRect().top;
      positioned.current = true;
    } else if (anchor.current) {
      const node = scroll.current.querySelector<HTMLElement>(`[data-short-id="${anchor.current.id}"]`);
      if (node) scroll.current.scrollTop += node.getBoundingClientRect().top - anchor.current.top;
    }
    anchor.current = null;
  }, [ids]);
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
        recordSeenShort((entry.target as HTMLElement).dataset.shortId!);
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
    if (rankingReady && !filledRanking && (channelMode ? videos.length > 0 && index >= videos.length - 3 : index >= videos.length - 6) && hasMore && !loading && !pending.current && !error && page < (channelMode ? 100 : MAX_SHORT_PAGES)) setPage(value => value + 1);
  }, [activeId, ids, rankingReady, ranking.length, hasMore, loading, error, page]);
  useEffect(() => {
    if (channelMode || context.source === 'search' || !activeId) return;
    // Preserve everything already visited and the two prepared embeds.
    const index = videos.findIndex(v => v.videoId === activeId);
    const locked = new Set(videos.slice(0, index + 3).map(v => v.videoId));
    const adapt = (list: Video[]) => {
      let end = 0;
      list.forEach((v, i) => { if (locked.has(v.videoId)) end = i + 1; });
      return [...list.slice(0, end), ...rankCandidates(list.slice(end), { short: true, seed: session, seen: readSeenShorts() })];
    };
    setRegular(adapt); setRanking(adapt);
  }, [activeId]);
  const move = useCallback((direction: number) => {
    const index = videos.findIndex(video => video.videoId === activeRef.current);
    (scroll.current?.querySelectorAll<HTMLElement>('[data-short-id]')[index + direction])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ids]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (commentsId || descriptionId)) { setCommentsId(''); setDescriptionId(''); return; }
      if (!isShortsLocation(route.current.pathname) || commentsId || descriptionId || /INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as HTMLElement)?.tagName)) return;
      if (['ArrowDown', 'PageDown', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); move(['ArrowDown', 'PageDown'].includes(event.key) ? 1 : -1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [move, commentsId, descriptionId]);
  return <section className={`shorts-viewer ${activeId && (commentsId === activeId || descriptionId === activeId) ? "shorts-has-panel" : ""}`} aria-label="ショート動画">
    <div className="shorts-scroll" ref={scroll} tabIndex={0} aria-label="動画の外側を上下にスクロールして切り替え">
      {videos.map((video, index) => {
        const info = metadata[video.videoId!] || video;
        const active = video.videoId === activeId;
        const activeIndex = videos.findIndex(item => item.videoId === activeId);
        const prepare = index >= activeIndex && index <= activeIndex + 2;
        const overlay = <div className="shorts-overlay">
          <button className="shorts-channel" onClick={() => onSelectChannel(info.authorId || info.author)} aria-label={`${info.author}のチャンネル`}>
            {active && (info.authorAvatar || metadata[video.videoId!]) ? <Avatar src={info.authorAvatar} name={info.author} channelId={info.authorId} videoId={info.videoId} className="w-9 h-9 text-sm" />
              : info.authorAvatar ? <img src={info.authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" /> : <span className="shorts-channel-placeholder">{info.author.slice(0, 1)}</span>}
            <span>{info.author}</span>
          </button>
          <h1 className="shorts-overlay-title">{info.title}</h1>
          <p className="shorts-overlay-stats">{info.viewCount > 0 ? `${formatNumberJP(info.viewCount)}回視聴` : ''}{info.likeCount == null ? '' : ` · 高評価 ${formatNumberJP(info.likeCount)}`}</p>
        </div>;
        return <article className="shorts-slide" key={video.videoId} data-short-id={video.videoId} aria-label={info.title}>
          <div className="shorts-player-row">
          {prepare ? <ShortEmbed video={video} active={active} isSelected={() => !isShortsLocation(route.current.pathname) || activeRef.current === video.videoId} onRecord={detail => { recordSeenShort(detail.videoId!); onRecord(detail); }} onMetadata={detail => setMetadata(previous => ({ ...previous, [detail.videoId!]: detail }))}>{overlay}</ShortEmbed>
            : <div className="shorts-frame"><img src={video.videoThumbnails[0]?.url} alt="" loading="lazy" className="w-full h-full object-cover" />{overlay}</div>}
          <div className="shorts-side-actions">
            <button aria-label="高評価（この端末に保存）" aria-pressed={!!likes[video.videoId!]} title="この端末に保存・YouTubeには送信されません" onClick={() => { learnInteraction(info, likes[video.videoId!] ? 'unlike' : 'like'); const next = { ...likes, [video.videoId!]: !likes[video.videoId!] }; setLikes(next); try { localStorage.setItem('xerox_shorts_likes_v1', JSON.stringify(next)); } catch {} }}><span><ThumbsUp size={24} fill={likes[video.videoId!] ? 'currentColor' : 'none'} /></span><small>{info.likeCount == null ? '高評価' : formatNumberJP(info.likeCount)}</small></button>
            <button aria-label="コメントを表示" onClick={() => { if (commentsId !== video.videoId) learnInteraction(info, 'comment'); setDescriptionId(''); setCommentsId(commentsId === video.videoId ? '' : video.videoId!); }}><span><MessageCircle size={24} /></span><small>コメント</small></button>
            <button aria-label="概要欄を表示" onClick={() => { setCommentsId(''); setDescriptionId(descriptionId === video.videoId ? '' : video.videoId!); }}><span><AlignLeft size={24} /></span><small>概要</small></button>
          </div>
          </div>
          {active && (commentsId === video.videoId || descriptionId === video.videoId) && <><button className="shorts-panel-backdrop" aria-label="背景を押してパネルを閉じる" onClick={() => { setCommentsId(''); setDescriptionId(''); }} /><aside className="shorts-info-panel" aria-label={commentsId ? 'コメント' : '概要欄'}>
            <header><strong>{commentsId ? 'コメント' : '概要欄'}</strong><button aria-label="パネルを閉じる" onClick={() => { setCommentsId(''); setDescriptionId(''); }}><X size={22} /></button></header>
            {commentsId ? <ShortsComments videoId={video.videoId!} inline onSelectChannel={onSelectChannel} /> : <div className="shorts-description"><h2>{info.title}</h2><p>{info.author}</p><p>{formatNumberJP(info.viewCount || 0)}回視聴 {info.publishedText}</p><p className="whitespace-pre-wrap break-words">{info.description || '概要欄はありません。'}</p></div>}
          </aside></>}

        </article>;
      })}
      <div className={channelMode && videos.length ? "shorts-channel-status" : "shorts-feed-end"}>
        {(loading || !rankingReady) && <p className="flex gap-2"><Loader2 size={18} className="animate-spin" />読み込み中…</p>}
        {error && <p role="status">{error}<button className="underline ml-2" onClick={() => setAttempt(value => value + 1)}>再試行</button></p>}
        {!loading && rankingReady && !error && (!channelMode || !videos.length) && <p>{videos.length ? 'ここまでのショートを表示しました。' : '表示できる縦長ショートがありません。'}</p>}
        {!loading && !error && hasMore && (!channelMode || activeId === videos[videos.length - 1]?.videoId) && page < (channelMode ? 100 : MAX_SHORT_PAGES) && (!ranking.length || videos.length < ranking.length * 2) && <button className="underline mt-3" onClick={() => setPage(value => value + 1)}>{channelMode ? '古いショートを読み込む' : '続きを読み込む'}</button>}
      </div>
    </div>
    <footer className="shorts-feed-source"><span>動画の外側を上下にスクロール</span>{rankingReady && context.source !== 'search' && !channelMode && <span>{rankingError ? rankingError : <><a href="https://shorts-ranking.com/" target="_blank" rel="noreferrer">Shortsランキング</a> {ranking.length}件（当日取得分を保持）{rankingUpdated ? `（${rankingUpdated}）` : ''}</>}</span>}</footer>
  </section>;
}
