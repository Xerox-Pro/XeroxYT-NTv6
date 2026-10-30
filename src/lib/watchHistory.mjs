export function splitWatchHistory(items = []) {
  const normal = new Map(), shorts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.videoId) continue;
    const target = item.type === 'short' ? shorts : normal;
    if (!target.has(item.videoId) || (target.get(item.videoId).timestamp || 0) < (item.timestamp || 0)) target.set(item.videoId, item);
  }
  const recent = map => [...map.values()].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,50);
  return { videos: recent(normal), shorts: recent(shorts) };
}
export function loadWatchHistories() {
  try { return splitWatchHistory([...JSON.parse(localStorage.getItem('xerox_watch_history') || '[]'), ...JSON.parse(localStorage.getItem('xerox_short_history') || '[]')]); }
  catch { return { videos: [], shorts: [] }; }
}
