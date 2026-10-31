import { createAsyncCache } from './async-cache.mjs';
import { shuffleSeeded } from './shorts-discovery.mjs';

const TOPICS = ['音楽 人気', 'ゲーム 実況', '科学 実験', '料理 レシピ', 'お笑い コント', '旅行 日本', 'ガジェット レビュー', 'スポーツ', 'アニメ'];

// Reuse small normalized public candidate pools, not large parser graphs or
// user-specific feeds. Never include credentials in either loaders or keys.
export function createRecommendationLoader(getYoutube, format, accept = (_video) => true) {
  const cached = createAsyncCache({ ttlMs: 15 * 60000, maxEntries: 200 });
  const normalize = items => (items || []).map(format).filter(v => v?.videoId && accept(v));
  return async ({ historyIds = [], keywords = '', page = 1, seed = 'default' } = {}) => {
    const youtube = await getYoutube();
    const history = [...new Set(historyIds.filter(id => /^[\w-]{11}$/.test(id)))].slice(0, 20);
    const shuffled = shuffleSeeded(history, `${seed}:history`);
    const offset = ((page - 1) * 4) % Math.max(1, shuffled.length);
    const selected = [...shuffled.slice(offset), ...shuffled.slice(0, offset)].slice(0, 4);
    const topics = shuffleSeeded(TOPICS, String(seed));
    const terms = [...new Set(String(keywords).split(/\s+/u).filter(Boolean))].slice(0, 8);
    const personalQuery = terms.length ? terms[(page - 1) % terms.length].slice(0, 100) : '';
    const queries = [...new Set([personalQuery, topics[(page - 1) % topics.length], topics[page % topics.length]].filter(Boolean))];
    const relatedTasks = selected.map(id => cached(`related:${id}`, async () => {
      const info = await youtube.getInfo(id);
      return normalize(info.watch_next_feed);
    }));
    const searchTasks = queries.map(q => cached(`search:${q}`, async () => {
      const result = await youtube.search(q, { type: 'video', prioritize: 'popularity' });
      return normalize(result.videos);
    }));
    const results = await Promise.allSettled([...relatedTasks, ...searchTasks]);
    const personal = results.slice(0, selected.length).flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const general = results.slice(selected.length).flatMap(r => r.status === 'fulfilled' ? r.value : []);
    if (!personal.length && !general.length && results.every(r => r.status === 'rejected')) throw new Error('Candidate sources unavailable');
    // Return a broad pool for local ranking, keeping history relevance and exploration.
    const unique = new Map();
    for (const item of [...shuffleSeeded(personal, `${seed}:${page}:p`).slice(0, 60), ...shuffleSeeded(general, `${seed}:${page}:g`).slice(0, 40)]) unique.set(item.videoId, item);
    return [...unique.values()];
  };
}
