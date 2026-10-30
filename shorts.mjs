// Shorts are identified by YouTube's renderer/endpoint AND a portrait thumbnail,
// never by a title, hashtag or duration. Playback verifies actual video dimensions.
export function isShortAspect(width, height) {
  const ratio = Number(width) / Number(height);
  return Number(width) > 0 && Number(height) > 0 && ratio >= 0.48 && ratio <= 0.65;
}

export function normalizeShort(item) {
  if (!item || typeof item !== 'object') return null;
  const endpoint = item.on_tap_endpoint || item.endpoint;
  const nativeShort = ['ShortsLockupView', 'ReelItem'].includes(item.type) ||
    item.content_type === 'SHORT' || endpoint?.metadata?.api_url?.includes('/reel/') ||
    endpoint?.name === 'reelWatchEndpoint';
  if (!nativeShort) return null;
  const videoId = endpoint?.payload?.videoId || item.id || item.content_id ||
    (typeof item.entity_id === 'string' ? item.entity_id.replace(/^shorts-shelf-item-/, '') : '');
  if (!/^[\w-]{11}$/.test(videoId)) return null;
  const thumbnails = [item.thumbnail, item.thumbnails, item.content_image?.image, endpoint?.payload?.thumbnail?.thumbnails].filter(Array.isArray).flat();
  const portrait = Array.isArray(thumbnails) ? thumbnails.filter(t => isShortAspect(t.width, t.height)) : [];
  if (!portrait.length) return null;
  const text = value => typeof value === 'string' ? value : value?.text || '';
  return {
    videoId, type: 'video', isShort: true, shortSource: 'youtube',
    title: text(item.overlay_metadata?.primary_text) || text(item.title) || text(item.metadata?.title) || 'ショート動画',
    author: item.author?.name || (typeof item.author === 'string' ? item.author : '') || 'チャンネル',
    authorId: item.author?.id,
    authorAvatar: item.author?.thumbnails?.[0]?.url,
    originalAspect: endpoint?.payload?.thumbnail?.isOriginalAspectRatio === true
      ? portrait.find(t => endpoint.payload.thumbnail.thumbnails?.some(original => original.url === t.url && original.width === t.width && original.height === t.height))
      : undefined,
    viewCount: 0,
    viewCountText: text(item.overlay_metadata?.secondary_text) || text(item.views),
    publishedText: '', lengthSeconds: 0, videoThumbnails: portrait,
  };
}

export function collectShorts(feed) {
  const result = new Map();
  const seen = new WeakSet();
  let visited = 0;
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 16 || visited++ > 12000) return;
    seen.add(value);
    const short = normalizeShort(value);
    if (short) result.set(short.videoId, short);
    if (value instanceof Map) { for (const entry of value.values()) walk(entry, depth + 1); }
    else for (const child of Object.values(value)) walk(child, depth + 1);
  }
  walk(feed?.videos);
  walk(feed?.watch_next_feed);
  walk(feed?.page);
  walk(feed);
  return [...result.values()];
}

export function shortDetails(info, videoId, originalAspect) {
  const basic = info.basic_info || {};
  const formats = [...(info.streaming_data?.adaptive_formats || []), ...(info.streaming_data?.formats || [])];
  const dimensions = formats.find(f => f.width > 0 && f.height > 0) || originalAspect;
  // Only YouTube thumbnails explicitly marked isOriginalAspectRatio may substitute
  // for unavailable stream dimensions. Ordinary cropped covers are never trusted.
  if (!dimensions) return { error: '動画の縦横比を確認できませんでした。再試行するか次のショートへ移動してください。', status: 422 };
  if (!isShortAspect(dimensions.width, dimensions.height) || basic.is_live || basic.duration > 180) {
    return { error: 'この動画は縦長のショート動画ではありません。', status: 422 };
  }
  const owner = info.secondary_info?.owner;
  return { video: {
    videoId, type: 'video', isShort: true, shortSource: 'youtube', aspectVerified: true,
    width: dimensions.width, height: dimensions.height,
    title: basic.title || info.primary_info?.title?.text || originalAspect?.title || 'ショート動画',
    author: owner?.author?.name || basic.author || originalAspect?.author || 'チャンネル',
    authorId: owner?.author?.id || basic.channel_id,
    authorAvatar: owner?.author?.thumbnails?.[0]?.url,
    description: basic.short_description || '',
    viewCount: basic.view_count || 0,
    likeCount: Number.isFinite(basic.like_count) ? basic.like_count : undefined,
    publishedText: info.primary_info?.published?.text || '',
    lengthSeconds: basic.duration || 0, videoThumbnails: basic.thumbnail || [],
  } };
}

export function registerShortsRoutes(app, getYoutube) {
  // Public feed cache, bounded and independent of serverless affinity. Cold instances
  // replay real continuations, rather than inventing another search query per page.
  const cache = new Map();
  const originalAspects = new Map();
  function rememberOriginalAspects(videos) {
    for (const video of videos) if (video.originalAspect) {
      if (originalAspects.size >= 500) originalAspects.delete(originalAspects.keys().next().value);
      originalAspects.set(video.videoId, { ...video, ...video.originalAspect, expires: Date.now() + 300000 });
    }
  }
  const cached = async (key, load) => {
    const old = cache.get(key);
    if (old && old.expires > Date.now()) return old.value;
    const value = await load();
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + 300000 });
    return value;
  };
  app.get('/api/shorts', async (req, res) => {
    const source = req.query.source || 'home';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const videoId = typeof req.query.videoId === 'string' ? req.query.videoId : '';
    const page = Number(req.query.page || 1);
    if (!['home', 'search', 'related'].includes(source) || q.length > 200 ||
      !Number.isInteger(page) || page < 1 || page > 20 ||
      (source === 'search' && !q) || (source === 'related' && !/^[\w-]{11}$/.test(videoId))) {
      return res.status(400).json({ error: 'ショートの取得条件を確認してください。' });
    }
    try {
      const result = await cached(JSON.stringify([source, q, videoId, page]), async () => {
        const youtube = await getYoutube();
        let query = q;
        let relatedShorts = [];
        let feed;
        if (source === 'home' && !q) {
          try {
            const home = await cached('home-feed', () => youtube.getHomeFeed());
            if (collectShorts(home).length) feed = home;
          } catch { /* Some anonymous sessions have no home feed. */ }
        }
        if (source === 'related') {
          const info = await cached(`info:${videoId}`, () => youtube.getInfo(videoId));
          if (page === 1) relatedShorts = collectShorts(info).filter(v => v.videoId !== videoId);
          query = info.basic_info?.title?.slice(0, 160) || '';
        }
        if (!feed) {
          feed = await cached(`search-feed:${query}`, async () => {
            let search = await youtube.search(query || '日本 ショート', { type: 'all' });
            const refinement = search.refinement_filters?.find(name => /^(shorts|ショート(?:動画)?)$/i.test(name));
            if (refinement) search = await search.applyRefinement(refinement);
            return search;
          });
        }
        for (let index = 1; index < page; index++) {
          if (!feed.has_continuation) return { videos: [], hasMore: false, page };
          const previous = feed;
          feed = await cached(`continuation:${source}:${query}:${videoId}:${index}`, () => previous.getContinuation());
        }
        return {
          videos: [...new Map([...relatedShorts, ...collectShorts(feed)].filter(v => v.videoId !== videoId).map(v => [v.videoId, v])).values()],
          hasMore: Boolean(feed.has_continuation) && page < 20, page,
        };
      });
      rememberOriginalAspects(result.videos);
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      res.json(result);
    } catch (error) {
      console.error('[Shorts feed]', error?.message);
      res.status(502).json({ error: 'ショート動画を取得できませんでした。時間をおいて再試行してください。' });
    }
  });
  app.get('/api/shorts/:id', async (req, res) => {
    if (!/^[\w-]{11}$/.test(req.params.id)) return res.status(400).json({ error: '動画IDが正しくありません。' });
    try {
      const info = await cached(`info:${req.params.id}`, async () => (await getYoutube()).getInfo(req.params.id));
      let original = originalAspects.get(req.params.id);
      if (original?.expires < Date.now()) original = undefined;
      if (!original && !info.streaming_data?.adaptive_formats?.some(f => f.width && f.height)) {
        // Recover proof on a cold serverless instance. Never trust client dimensions.
        const title = info.basic_info?.title || (typeof req.query.title === 'string' ? req.query.title.slice(0, 160) : '') || req.params.id;
        const youtube = await getYoutube();
        const proof = await cached(`aspect-search:${req.params.id}:${title}`, () => youtube.search(title, { type: 'all' }));
        const matches = collectShorts(proof);
        rememberOriginalAspects(matches);
        original = originalAspects.get(req.params.id);
      }
      const result = shortDetails(info, req.params.id, original);
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.json(result.video);
    } catch (error) {
      console.error('[Shorts details]', error?.message);
      return res.status(502).json({ error: 'ショートの動画情報を取得できませんでした。再試行してください。' });
    }
  });
}
