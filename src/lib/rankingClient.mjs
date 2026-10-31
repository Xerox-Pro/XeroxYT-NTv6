import { createRankingLoader } from '../../shorts-ranking.mjs';
// Direct browser fetch: no app proxy, no persisted ranking cache.
export const loadShortsRanking = createRankingLoader((...args) => fetch(...args));
