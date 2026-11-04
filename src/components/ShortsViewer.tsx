import RichText from './RichText';
import {useAudioPreference,readMuted} from '../lib/audioPreference';
import CompactError from './CompactError';
import { createPlaybackTracker, learnInteraction, rankCandidates } from '../lib/localRecommendations.mjs';
import { loadShortsRanking } from '../lib/rankingClient.mjs';
import { withShortsInterests } from '../lib/shortsInterests.mjs';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ThumbsUp, MessageCircle, AlignLeft, X, ArrowLeft, Search, Share2, MoreVertical, Captions, Volume2, VolumeX, ChevronsDown } from 'lucide-react';
import type { ReactNode } from 'react';
import Avatar from './Avatar';
import { Video } from '../types';
import { fetchJSON, formatNumberJP } from '../utils';
import { excludeSeenShorts, isShortsLocation, MAX_SHORT_PAGES, mixShorts, createShortsSession, readSeenShorts, recordSeenShort, discoveryRequest, unseenRankingFirst } from '../lib/shortsFeed.mjs';
import ShortsComments from './ShortsComments';
import { getShortEmbedUrl } from '../lib/shortsEmbedCache.mjs';
import { ShortsContext, shortsQuery } from './ShortsShelf';

async function fetchShortsPage(url: string, signal: AbortSignal) {
  try {
    return await fetchJSON(url, { signal });
  } catch (reason: any) {
    // Retry transient network/upstream failures once without retrying account
    // errors or daily limits. Keep the same URL/session so paging is stable.
    if (signal.aborted || reason?.isDailyLimit || [400, 401, 403, 404, 429].includes(reason?.status)) throw reason;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 450);
      const cancel = () => { clearTimeout(timer); reject(signal.reason); };
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
    return fetchJSON(url, { signal });
  }
}

function ShortEmbed({ video, onRecord, onMetadata, onEnded, autoScroll, children, active, isSelected, captionsEnabled }: {
  video: Video; onRecord: (video: Video) => void; onMetadata: (video: Video) => void; onEnded: (id: string) => boolean; autoScroll: boolean; children?: ReactNode; active: boolean; isSelected: () => boolean; captionsEnabled: boolean;
}) {
  const [muted] = useAudioPreference();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const detail = useRef<Video | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const activeRef = useRef(active); activeRef.current = active;
  const recorded = useRef(false);
  const captionsRef = useRef(captionsEnabled); captionsRef.current = captionsEnabled;
  const command = (func: string, args: unknown[] = []) => { if (frame.current?.contentWindow && url) frame.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), new URL(url).origin); };
  const syncCaptions = () => {
    if (captionsRef.current) { command('loadModule', ['captions']); command('setOption', ['captions', 'reload', true]); }
    else { command('setOption', ['captions', 'track', {}]); command('unloadModule', ['captions']); }
  };
  useEffect(() => {
    if (!url) return;
    syncCaptions();
    const timers = [400, 1200, 2400].map(delay => window.setTimeout(syncCaptions, delay));
    return () => timers.forEach(clearTimeout);
  }, [captionsEnabled, url]);
  useEffect(() => {
    if (!url) return;
    const sync = () => command(readMuted() ? 'mute' : 'unMute');
    sync(); const timers = [300, 1000].map(delay => window.setTimeout(sync,delay));
    return () => timers.forEach(clearTimeout);
  }, [muted,url]);
  const record = () => { if (activeRef.current && detail.current && !recorded.current) { recorded.current = true; callbacks.current.onRecord(detail.current); } };
  const callbacks = useRef({ onRecord, onMetadata, onEnded, autoScroll, isSelected }); callbacks.current = { onRecord, onMetadata, onEnded, autoScroll, isSelected };
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setUrl(''); setError(''); detail.current = null;
    detail.current = video;
    // Metadata is optional: it must never block the device-built player.
    fetchJSON(`/api/shorts/${video.videoId}?title=${encodeURIComponent(video.title.slice(0, 160))}&details=2`, {signal:controller.signal}).then(metadata=>{
      if(!cancelled&&metadata){detail.current=metadata;callbacks.current.onMetadata(metadata);}
    }).catch(()=>{});
    getShortEmbedUrl(video.videoId,controller.signal).then(rawUrl=>{
      if(cancelled)return;
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' || !['www.youtubeeducation.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(parsed.hostname)) throw new Error('埋め込みURLが正しくありません。');
      parsed.searchParams.set('enablejsapi', '1');
      parsed.searchParams.set('origin', window.location.origin);
      // Handle repeat ourselves so an ended event can advance when enabled.
      for (const [key, value] of Object.entries({ loop: '0', playlist: video.videoId!, controls: '1', playsinline: '1', autoplay: activeRef.current ? '1' : '0', mute: readMuted() ? '1' : '0', rel: '0', cc_load_policy: captionsRef.current ? '1' : '0' })) parsed.searchParams.set(key, value);
      setUrl(parsed.toString());
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
    let handledEnd = false;
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!['infoDelivery', 'initialDelivery', 'onStateChange'].includes(data?.event)) return;
        const info = data.info && typeof data.info === 'object' ? data.info : {};
        const playerState = data.event === 'onStateChange' && typeof data.info === 'number' ? data.info : info.playerState;
        if (typeof playerState === 'number') {
          playing = playerState === 1;
          if (playing) handledEnd = false;
          if (playerState === 0 && !handledEnd && activeRef.current && callbacks.current.isSelected()) {
            handledEnd = true;
            if (!callbacks.current.autoScroll || !callbacks.current.onEnded(video.videoId!)) {
              command('seekTo', [0, true]);
              command('playVideo');
            }
          }
        }
        if (typeof info.currentTime === 'number') tracker.update(info.currentTime, info.duration || detail.current?.lengthSeconds, playing, document.visibilityState !== 'hidden');
      } catch {}
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); tracker.finish(callbacks.current.isSelected() ? 'leave' : 'skip'); };
  }, [active, url, video.videoId]);
  return <div className="shorts-frame">
    {url && <iframe ref={frame} tabIndex={active ? 0 : -1} aria-hidden={!active} src={url} title={video.title} className="shorts-iframe" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), new URL(url).origin); command(readMuted() ? 'mute' : 'unMute'); command(activeRef.current ? 'playVideo' : 'pauseVideo'); syncCaptions(); record(); }} />}
    {!url && !error && <div className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin" size={28} /></div>}
    {children}
    {error && <div className="shorts-embed-error !z-10 pointer-events-auto touch-auto [&_button]:min-h-11 [&_button]:min-w-16"><CompactError error={error} onRetry={() => setAttempt(value => value + 1)}/></div>}
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
  const [muted,setMuted] = useAudioPreference();
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [autoScroll, setAutoScroll] = useState(() => {
    try { return localStorage.getItem('xerox_shorts_auto_scroll_v1') !== 'off'; }
    catch { return true; }
  });
  const [metadata, setMetadata] = useState<Record<string, Video>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(channelStart?.page || 1);
  const [hasMore, setHasMore] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [commentsId, setCommentsId] = useState('');
  const [descriptionId, setDescriptionId] = useState('');
  const [settingsId, setSettingsId] = useState('');
  const [likes, setLikes] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('xerox_shorts_likes_v1') || '{}'); } catch { return {}; } });
  const scroll = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const touchStartY = useRef<number | null>(null);
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const query = shortsQuery(context).toString();
  regularRef.current = regular;
  const ranked = unseenRankingFirst(excludeSeenShorts(ranking, seenOnEntry, seed.current?.videoId), seenOnEntry, seed.current?.videoId);
  // The independent ranking service must not hold YouTube's Shorts feed hostage.
  const videos: Video[] = ranked.length ? mixShorts(regular, ranked, seed.current?.videoId, !hasMore || Boolean(error)) : regular;
  const ids = videos.map(video => video.videoId).join(',');
  useEffect(() => {
    try { localStorage.setItem('xerox_shorts_auto_scroll_v1', autoScroll ? 'on' : 'off'); } catch {}
  }, [autoScroll]);
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
    const controller = new AbortController();
    if (channelMode) {
      fetchShortsPage(`/api/channel/${encodeURIComponent(context.channelId!)}/tab/shorts?page=${page}&sort=latest`, controller.signal).then(data => {
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
      return () => { cancelled = true; controller.abort(); };
    }
    const excluded = [...regularRef.current.map(video => video.videoId!), ...readSeenShorts()];
    fetchShortsPage(discoveryRequest(withShortsInterests(query, page), page, session, excluded), controller.signal).then(data => {
      if (cancelled) return;
      const items: Video[] = rankCandidates(excludeSeenShorts((data.videos || []).filter((video: Video) => video.isShort), readSeenShorts(), seed.current?.videoId), { short: true, seed: session, seen: readSeenShorts() });
      setRegular(previous => [...new Map([...previous, ...items].map(video => [video.videoId, video])).values()]);
      setHasMore(Boolean(data.hasMore));
    }).catch(reason => { if (!cancelled) setError(reason.message || 'ショートを読み込めませんでした。'); })
      .finally(() => { if (!cancelled) { pending.current = false; setLoading(false); } });
    return () => { cancelled = true; controller.abort(); };
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
    if (videos.length && !filledRanking && (channelMode ? index >= videos.length - 3 : index >= videos.length - 6) && hasMore && !loading && !pending.current && !error && page < (channelMode ? 100 : MAX_SHORT_PAGES)) setPage(value => value + 1);
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
    // A failed next-page request must be recoverable with another downward
    // swipe/scroll, including when there are no slides to scroll to yet.
    if (direction > 0 && error && !pending.current && !loading) {
      pending.current = true;
      setAttempt(value => value + 1);
      return;
    }
    const index = videos.findIndex(video => video.videoId === activeRef.current);
    (scroll.current?.querySelectorAll<HTMLElement>('[data-short-id]')[index + direction])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ids, error, loading]);
  const advanceOnEnd = useCallback((id: string) => {
    if (!isShortsLocation(route.current.pathname) || activeRef.current !== id) return false;
    const nodes = scroll.current?.querySelectorAll<HTMLElement>('[data-short-id]');
    const index = videos.findIndex(video => video.videoId === id);
    const next = index >= 0 ? nodes?.[index + 1] : undefined;
    if (next) {
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    // At the end of a partially fetched feed, request another page. Replay
    // this clip meanwhile so the player does not stop on an empty frame.
    if (index >= 0 && hasMore && !loading && !pending.current && !error && page < (channelMode ? 100 : MAX_SHORT_PAGES)) {
      setPage(value => value + 1);
    }
    return false;
  }, [ids, hasMore, loading, error, page, channelMode]);
  const retryOnScroll = (direction: number) => {
    if (direction > 0 && error && !loading && !pending.current) {
      pending.current = true;
      setAttempt(value => value + 1);
    }
  };
  const retryFeed = () => {
    if (loading || pending.current) return;
    pending.current = true;
    setAttempt(value => value + 1);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (commentsId || descriptionId)) { setCommentsId(''); setDescriptionId(''); return; }
      if (!isShortsLocation(route.current.pathname) || commentsId || descriptionId || /INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as HTMLElement)?.tagName)) return;
      if (['ArrowDown', 'PageDown', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); move(['ArrowDown', 'PageDown'].includes(event.key) ? 1 : -1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [move, commentsId, descriptionId]);
  return <section className={`shorts-viewer ${activeId && (commentsId === activeId || descriptionId === activeId) ? "shorts-has-panel" : ""}`} aria-label="ショート動画">
    <header className="shorts-mobile-header"><button aria-label="ショートを閉じる" onClick={()=>navigate('/')}><ArrowLeft size={27}/></button><div><button aria-label="検索" onClick={()=>navigate('/search')}><Search size={26}/></button><button aria-label="概要欄" onClick={()=>{setCommentsId('');setDescriptionId(activeId||'');}}><MoreVertical size={25}/></button></div></header>
    <div className="shorts-scroll" ref={scroll} tabIndex={0} aria-label="動画の外側を上下にスクロールして切り替え"
      onWheel={event => retryOnScroll(event.deltaY)}
      onTouchStart={event => { touchStartY.current = event.touches[0]?.clientY ?? null; }}
      onTouchEnd={event => {
        if (touchStartY.current !== null && event.changedTouches[0]) {
          const delta = touchStartY.current - event.changedTouches[0].clientY;
          if (delta > 40) retryOnScroll(delta);
        }
        touchStartY.current = null;
      }}
      onTouchCancel={() => { touchStartY.current = null; }}>
      {videos.map((video, index) => {
        const detail = metadata[video.videoId!];
        const info = detail ? { ...video, ...detail, viewCount: detail.viewCount || video.viewCount, description: detail.description || video.description, publishedText: detail.publishedText || video.publishedText } : video;
        const active = video.videoId === activeId;
        const activeIndex = videos.findIndex(item => item.videoId === activeId);
        const prepare = index >= activeIndex && index <= activeIndex + 2;
        const overlay = <div className="shorts-overlay">
          <button className="shorts-channel" onClick={() => onSelectChannel(info.authorId || info.author)} aria-label={`${info.author}のチャンネル`}>
            {active && (info.authorAvatar || metadata[video.videoId!]) ? <Avatar src={info.authorAvatar} name={info.author} channelId={info.authorId} videoId={info.videoId} className="w-9 h-9 text-sm" />
              : info.authorAvatar ? <img src={info.authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" /> : <span className="shorts-channel-placeholder">{info.author.slice(0, 1)}</span>}
            <span>{info.author}</span>
          </button>
          <button className="shorts-title-button" onClick={()=>{setCommentsId('');setDescriptionId(video.videoId!);}}><h1 className="shorts-overlay-title">{info.title}</h1></button>
          <p className="shorts-overlay-stats">{info.viewCount > 0 ? `${formatNumberJP(info.viewCount)}回視聴` : ''}{info.likeCount == null ? '' : ` · 高評価 ${formatNumberJP(info.likeCount)}`}</p>
        </div>;
        return <article className="shorts-slide" key={video.videoId} data-short-id={video.videoId} aria-label={info.title}>
          <div className="shorts-player-row">
          {prepare ? <ShortEmbed video={video} active={active} captionsEnabled={captionsEnabled} autoScroll={autoScroll} onEnded={advanceOnEnd} isSelected={() => !isShortsLocation(route.current.pathname) || activeRef.current === video.videoId} onRecord={detail => { recordSeenShort(detail.videoId!); onRecord(detail); }} onMetadata={detail => setMetadata(previous => ({ ...previous, [detail.videoId!]: detail }))}>{overlay}</ShortEmbed>
            : <div className="shorts-frame"><img src={video.videoThumbnails[0]?.url} alt="" loading="lazy" className="w-full h-full object-cover" />{overlay}</div>}
          <div className="shorts-side-actions">
            <button aria-label="高評価（この端末に保存）" aria-pressed={!!likes[video.videoId!]} title="この端末に保存・YouTubeには送信されません" onClick={() => { learnInteraction(info, likes[video.videoId!] ? 'unlike' : 'like'); const next = { ...likes, [video.videoId!]: !likes[video.videoId!] }; setLikes(next); try { localStorage.setItem('xerox_shorts_likes_v1', JSON.stringify(next)); } catch {} }}><span><ThumbsUp size={24} fill={likes[video.videoId!] ? 'currentColor' : 'none'} /></span><small>{info.likeCount == null ? '高評価' : formatNumberJP(info.likeCount)}</small></button>
            <button aria-label="コメントを表示" onClick={() => { if (commentsId !== video.videoId) learnInteraction(info, 'comment'); setDescriptionId(''); setCommentsId(commentsId === video.videoId ? '' : video.videoId!); }}><span><MessageCircle size={24} /></span><small>コメント</small></button>
            <button aria-label="その他の設定" aria-expanded={settingsId === video.videoId} onClick={() => setSettingsId(settingsId === video.videoId ? '' : video.videoId!)}><span><MoreVertical size={25}/></span><small>その他</small></button>
            <button aria-label="共有" onClick={async()=>{const url=new URL(`/shorts/${video.videoId}`,window.location.origin).href;try{if(navigator.share)await navigator.share({title:info.title,url});else await navigator.clipboard.writeText(url);}catch{}}}><span><Share2 size={25}/></span><small>共有</small></button>
            <button className="shorts-description-action" aria-label="概要欄を表示" onClick={() => { setCommentsId(''); setDescriptionId(descriptionId === video.videoId ? '' : video.videoId!); }}><span><AlignLeft size={24} /></span><small>概要</small></button>
          </div>
          </div>
          {active && (commentsId === video.videoId || descriptionId === video.videoId) && <><button className="shorts-panel-backdrop" aria-label="背景を押してパネルを閉じる" onClick={() => { setCommentsId(''); setDescriptionId(''); }} /><aside className="shorts-info-panel" aria-label={commentsId ? 'コメント' : '概要欄'}>
            <header><strong>{commentsId ? 'コメント' : '概要欄'}</strong><button aria-label="パネルを閉じる" onClick={() => { setCommentsId(''); setDescriptionId(''); }}><X size={22} /></button></header>
            {commentsId ? <ShortsComments videoId={video.videoId!} inline onSelectChannel={onSelectChannel} /> : <div className="shorts-description"><h2>{info.title}</h2><p>{info.author}</p><p>{info.viewCount > 0 ? `${formatNumberJP(info.viewCount)}回視聴` : '再生数を取得できませんでした'} {info.publishedText || ''}</p><p className="whitespace-pre-wrap break-words"><RichText text={info.description || '概要欄はありません。'} onSelectChannel={onSelectChannel} onSelectVideo={id=>navigate('/watch?v='+id)}/></p></div>}
          </aside></>}

        </article>;
      })}
      <div className={channelMode && videos.length ? "shorts-channel-status" : "shorts-feed-end"}>
        {(loading || (!videos.length && !rankingReady)) && <p className="flex gap-2"><Loader2 size={18} className="animate-spin" />読み込み中…</p>}
        {!loading && rankingReady && !error && (!channelMode || !videos.length) && <p>{videos.length ? 'ここまでのショートを表示しました。' : '表示できる縦長ショートがありません。'}</p>}
        {!loading && !error && hasMore && (!channelMode || activeId === videos[videos.length - 1]?.videoId) && page < (channelMode ? 100 : MAX_SHORT_PAGES) && <button className="underline mt-3" onClick={() => setPage(value => value + 1)}>{channelMode ? '古いショートを読み込む' : '続きを読み込む'}</button>}
      </div>
    </div>
    {error && <div className="absolute bottom-9 left-1/2 z-20 w-[min(94%,480px)] -translate-x-1/2 pointer-events-auto touch-auto rounded-xl bg-white/95 shadow-lg [&_button]:min-h-11 [&_button]:min-w-16" role="alert"><CompactError error={error} onRetry={retryFeed}/></div>}
    {settingsId === activeId && <>
      <button type="button" aria-label="設定メニューの外側を閉じる" className="fixed inset-0 z-[9998] cursor-default bg-black/5" onClick={() => setSettingsId('')}/>
      <div className="fixed right-4 bottom-16 z-[9999] w-[min(19rem,calc(100vw-2rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 text-gray-900 shadow-xl" role="group" aria-label="ショートの再生設定">
        <div className="mb-2 flex items-center justify-between border-b border-gray-100 px-2 pb-2">
          <strong className="text-sm font-semibold">再生設定</strong>
          <button type="button" aria-label="設定を閉じる" className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 hover:bg-gray-200" onClick={() => setSettingsId('')}><X size={18}/></button>
        </div>
        <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-gray-100" aria-label={muted ? 'ミュート解除' : 'ミュート'} aria-pressed={!muted} onClick={() => setMuted(!muted)}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100">{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</span>
          <span className="flex-1 text-sm font-medium">音声</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${muted ? 'bg-gray-100 text-gray-600' : 'bg-gray-900 text-white'}`}>{muted ? 'OFF' : 'ON'}</span>
        </button>
        <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-gray-100" aria-label={captionsEnabled ? '字幕をオフにする' : '字幕をオンにする'} aria-pressed={captionsEnabled} onClick={() => setCaptionsEnabled(value => !value)}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100"><Captions size={19}/></span>
          <span className="flex-1 text-sm font-medium">字幕</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${captionsEnabled ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{captionsEnabled ? 'ON' : 'OFF'}</span>
        </button>
        <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-gray-100" aria-label={autoScroll ? '自動スクロールをオフにする' : '自動スクロールをオンにする'} aria-pressed={autoScroll} onClick={() => setAutoScroll(value => !value)}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100"><ChevronsDown size={19}/></span>
          <span className="flex-1 text-sm font-medium">自動スクロール</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${autoScroll ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{autoScroll ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </>}
    <footer className="shorts-feed-source"><span>動画の外側を上下にスクロール</span>{rankingReady && context.source !== 'search' && !channelMode && <span>{rankingError ? rankingError : <><a href="https://shorts-ranking.com/" target="_blank" rel="noreferrer">Shortsランキング</a> {ranking.length}件（当日取得分を保持）{rankingUpdated ? `（${rankingUpdated}）` : ''}</>}</span>}</footer>
  </section>;
}
