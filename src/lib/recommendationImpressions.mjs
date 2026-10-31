import { rankCandidates } from './localRecommendations.mjs';
const key = () => `xerox_recommendation_seen_v1_${localStorage.getItem('xerox_last_account_id') || 'local'}`;
export function readImpressions() {
  try { const rows=JSON.parse(localStorage.getItem(key()) || '[]'); return new Set(Array.isArray(rows)?rows.filter(x=>typeof x.id==='string' && Date.now()-x.at<30*86400000).map(x=>x.id):[]); } catch { return new Set(); }
}
export function recordImpression(id) {
  if (!id) return;
  try { const rows=JSON.parse(localStorage.getItem(key()) || '[]'); localStorage.setItem(key(),JSON.stringify([{id,at:Date.now()},...(Array.isArray(rows)?rows:[]).filter(x=>x.id!==id)].slice(0,2000))); } catch {}
}
export function prioritizeUnshown(videos) {
 const seen = readImpressions();
 return rankCandidates(videos.filter(video => !seen.has(video.videoId)), { seen: [...seen] });
}
