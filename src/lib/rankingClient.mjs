import { createRankingLoader } from '../../shorts-ranking.mjs';
const fetchRanking = createRankingLoader((...args) => fetch(...args));
const dayJst = now => new Date(now + 9 * 3600000).toISOString().slice(0,10);
export function mergeDailyRanking(previous, latest, now = Date.now()) {
 const day = dayJst(now);
 const old = previous?.day === day && Array.isArray(previous.videos) ? previous.videos : [];
 const videos = [...new Map([...old, ...(latest.videos || [])].filter(v => /^[\w-]{11}$/.test(v?.videoId)).map(v => [v.videoId,v])).values()];
 return { ...latest, day, videos, count: videos.length };
}
export async function loadShortsRanking() {
 const key = `xerox_ranking_day_v1_${localStorage.getItem('xerox_last_account_id') || 'local'}`;
 const read = () => {try { return JSON.parse(localStorage.getItem(key)||'null'); } catch { return null; }};
 const previous = read();
 try {
  const latest = await fetchRanking(); // Always fetch directly; retain the day's unseen candidates separately.
  const result = mergeDailyRanking(read(), latest);
  try {localStorage.setItem(key,JSON.stringify(result));} catch {}
  return result;
 } catch(error) {
  if(previous?.day===dayJst(Date.now()) && previous.videos?.length) return previous;
  throw error;
 }
}
