const RANKING_URL = 'https://shorts-ranking.com/latest.json';
export function parseRanking(data) {
  if (!data || !Array.isArray(data.items)) throw new Error('ランキングのデータ形式が変わりました。');
  const seen = new Set();
  const videos = [...data.items].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).flatMap(item => {
    const id = item.video_id;
    if (!/^[\w-]{11}$/.test(id) || seen.has(id)) return [];
    // Only IDs are used to construct playback URLs; arbitrary upstream URLs are ignored.
    seen.add(id);
    return [{ videoId: id, type: 'video', isShort: true, shortSource: 'ranking',
      title: String(item.title || 'ショート動画').slice(0, 500),
      author: String(item.channel_title || 'チャンネル').slice(0, 200),
      viewCount: Math.max(0, Number(item.views) || 0), publishedText: '', lengthSeconds: 0,
      videoThumbnails: [{ url: `https://i.ytimg.com/vi/${id}/frame0.jpg` }],
    }];
  }).slice(0, 200);
  return { videos, count: videos.length, limit: 200, updatedAt: typeof data.updated_at === 'string' ? data.updated_at.slice(0, 100) : '', sourceUrl: 'https://shorts-ranking.com/' };
}
export function createRankingLoader(fetchUpstream = fetch, { retryDelays = [400, 1000] } = {}) {
  let pending;
  return async () => {
    if (pending) return pending;
    pending = (async () => {
      for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        let retryable = true;
        try {
          // The browser contacts the ranking site directly; no Vercel or
          // Cloudflare API is involved, and no user credentials are sent.
          const response = await fetchUpstream(`${RANKING_URL}?t=${Date.now()}`, {
            cache: 'no-store', signal: controller.signal, credentials: 'omit',
            mode: 'cors', redirect: 'follow', headers: { accept: 'application/json' },
          });
          if (!response.ok) {
            retryable = [408, 429].includes(response.status) || response.status >= 500;
            throw new Error(`ランキング取得失敗（${response.status}）`);
          }
          const limit = 2 * 1024 * 1024;
          if (Number(response.headers.get('content-length')) > limit) throw new Error('ランキングのデータが大きすぎます。');
          const reader = response.body?.getReader?.();
          if (!reader) {
            const raw = await response.text();
            if (new TextEncoder().encode(raw).length > limit) throw new Error('ランキングのデータが大きすぎます。');
            return parseRanking(JSON.parse(raw));
          }
          const chunks = []; let size = 0;
          try {
            for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('ランキングのデータが大きすぎます。'); chunks.push(value); }
          } finally { await reader.cancel().catch(() => {}); }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
          return parseRanking(JSON.parse(new TextDecoder().decode(bytes)));
        } catch (error) {
          // A malformed response will not be fixed by a retry. Network errors,
          // timeouts and temporary upstream errors often will.
          if (!retryable || attempt >= retryDelays.length || (error instanceof SyntaxError) || /データが大きすぎ|データ形式/.test(String(error?.message))) throw error;
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        } finally {
          clearTimeout(timeout);
        }
      }
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
export function registerRankingRoute(app, load = createRankingLoader()) {
  app.get('/api/shorts-ranking', async (_req, res) => {
    try { const result = await load(); res.setHeader('Cache-Control', 'private, no-store'); return res.json(result); }
    catch (error) { console.error('[Shorts ranking]', error.message); return res.status(502).json({ error: 'ランキングを取得できませんでした。通常のショート候補を表示します。' }); }
  });
}
