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
