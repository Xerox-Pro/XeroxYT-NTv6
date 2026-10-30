export const MAX_SHORT_PAGES = 20;
// A clip belongs to one source only. New pages add pairs after existing pairs.
export function mixShorts(regular, ranking, startId = '') {
  const unique = list => [...new Map(list.filter(v => v?.videoId).map(v => [v.videoId, v])).values()];
  const ranked = unique(ranking);
  const rankingIds = new Set(ranked.map(v => v.videoId));
  const native = unique(regular).filter(v => !rankingIds.has(v.videoId));
  const rotate = list => {
    const index = list.findIndex(v => v.videoId === startId);
    return index > 0 ? [...list.slice(index), ...list.slice(0, index)] : list;
  };
  const first = rankingIds.has(startId) ? rotate(ranked) : rotate(native);
  const second = rankingIds.has(startId) ? native : ranked;
  const result = [];
  for (let i = 0; i < Math.min(first.length, second.length); i++) result.push(first[i], second[i]);
  return result;
}
export function isShortsLocation(pathname) {
  return pathname === '/shorts' || pathname.startsWith('/shorts/');
}

const seenKey = () => `xerox_shorts_seen_v1_${localStorage.getItem('xerox_last_account_id') || 'local'}`;
export function createShortsSession() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function readSeenShorts() {
  try {
    const saved = JSON.parse(localStorage.getItem(seenKey()) || '[]');
    const items = Array.isArray(saved) ? saved : [];
    const recent = items.filter(item => /^[\w-]{11}$/.test(item?.id) && Date.now() - item.at < 30 * 86400000).map(item => item.id);
    const history = JSON.parse(localStorage.getItem('xerox_watch_history') || '[]');
    const earlier = Array.isArray(history) ? history.filter(item => item?.type === 'short' && /^[\w-]{11}$/.test(item.videoId)).map(item => item.videoId) : [];
    return [...new Set([...recent, ...earlier])].slice(0, 1000);
  } catch { return []; }
}
export function recordSeenShort(id) {
  if (!/^[\w-]{11}$/.test(id)) return;
  try {
    const saved = JSON.parse(localStorage.getItem(seenKey()) || '[]');
    const items = Array.isArray(saved) ? saved : [];
    localStorage.setItem(seenKey(), JSON.stringify([{ id, at: Date.now() }, ...items.filter(item => item?.id !== id)].slice(0, 1000)));
  } catch { /* Watching remains available without storage. */ }
}
export function discoveryRequest(query, page, session, excluded = []) {
  const params = new URLSearchParams(query);
  params.set('page', String(page)); params.set('session', session);
  const ids = [...new Set(excluded.filter(id => /^[\w-]{11}$/.test(id)))].slice(0, 300);
  if (ids.length) params.set('exclude', ids.join(','));
  return `/api/shorts?${params}`;
}
export function unseenRankingFirst(videos, seenIds, keepId) {
  const seen = new Set(seenIds);
  return [...videos.filter(video => video.videoId === keepId || !seen.has(video.videoId)), ...videos.filter(video => video.videoId !== keepId && seen.has(video.videoId))];
}
