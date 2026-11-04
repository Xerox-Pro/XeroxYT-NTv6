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
 let account = 'local';
 try { account = localStorage.getItem('xerox_last_account_id') || 'local'; } catch {}
 const key = `xerox_ranking_day_v1_${account}`;
 const read = () => {try { return JSON.parse(localStorage.getItem(key)||'null'); } catch { return null; }};
 const previous = read();
 // Ranking data is refreshed a few times a day. Share a recent result across
 // page/shelf visits to avoid unnecessary requests from the same device.
 if (previous?.day === dayJst(Date.now()) && previous.videos?.length && Date.now() - (previous.fetchedAt || 0) < 5 * 60 * 1000) return previous;
 try {
  const latest = await fetchRanking();
  const result = {...mergeDailyRanking(read(), latest), fetchedAt: Date.now()};
  try {localStorage.setItem(key,JSON.stringify(result));} catch {}
  return result;
 } catch(error) {
  if(previous?.day===dayJst(Date.now()) && previous.videos?.length) return previous;
  throw error;
 }
}
