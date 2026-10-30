const key = () => `xerox_shorts_interests_v1_${localStorage.getItem('xerox_last_account_id') || 'local'}`;
const clean = value => String(value || '').replace(/#shorts(?![\p{L}\p{N}_])/giu, '').trim().slice(0, 160);
export function readShortsInterests() {
  try { const data = JSON.parse(localStorage.getItem(key()) || '[]'); return Array.isArray(data) ? data.filter(x => typeof x?.term === 'string' && Date.now() - x.at < 90 * 86400000).slice(0, 80) : []; } catch { return []; }
}
export function saveShortsInterest(value, kind = 'search') {
  const term = clean(value);
  if (!term || /^https?:\/\//i.test(term)) return;
  try { localStorage.setItem(key(), JSON.stringify([{ term, kind, at: Date.now() }, ...readShortsInterests().filter(x => x.term.toLowerCase() !== term.toLowerCase())].slice(0, 80))); } catch {}
}
export function saveVideoHashtags(video) {
  if (video?.isShort || video?.type === 'short') return;
  const text = [video?.title, video?.description, ...(video?.hashtags || []).map(x => typeof x === 'string' ? '#' + x.replace(/^#/, '') : '')].filter(x => typeof x === 'string').join(' ');
  for (const tag of new Set(text.match(/#[\p{L}\p{N}_]+/gu) || [])) saveShortsInterest(tag, 'hashtag');
}
export function personalShortsTerm(page) {
  const saved = readShortsInterests();
  let history = [];
  try { history = JSON.parse(localStorage.getItem('xerox_watch_history') || '[]'); } catch {}
  // Older histories retain titles even when full descriptions were not saved.
  const tags = Array.isArray(history) ? history.filter(x => x.type !== 'short').flatMap(x => (x.title || '').match(/#[\p{L}\p{N}_]+/gu) || []) : [];
  const terms = [...new Set([...saved.map(x => clean(x.term)), ...tags.map(clean)].filter(Boolean))].slice(0, 40);
  return terms.length ? terms[(page - 1) % terms.length] : '';
}
