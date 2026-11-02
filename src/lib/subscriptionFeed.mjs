// Fetch real channel uploads, rather than search results matching channel names.
export async function fetchSubscriptionPage(subscriptions, selectedId, page, fetchJSON) {
  const channels = subscriptions.filter(s => selectedId === 'all' || s.id === selectedId);
  const batchSize = 3;
  const batches = Math.max(1, Math.ceil(channels.length / batchSize));
  const channelPage = Math.floor((page - 1) / batches) + 1;
  const batch = channels.slice(((page - 1) % batches) * batchSize, (((page - 1) % batches) + 1) * batchSize);
  const results = await Promise.allSettled(batch.map(async channel => {
    const base = `/api/channel/${encodeURIComponent(channel.id || channel.title)}`;
    if (channelPage === 1) {
      const data = await fetchJSON(`${base}?v=2`);
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.videos) && !Array.isArray(data?.shortVideos)) throw new Error('チャンネルの動画を取得できませんでした。');
      return [...(data.videos || []), ...(data.liveVideos || []).map(v => ({...v, isLive: true})), ...(data.shortVideos || []).map(v => ({...v, isShort: true}))];
    }
    const tabs = await Promise.allSettled(['videos', 'shorts'].map(async tab => {
      const data = await fetchJSON(`${base}/tab/${tab}?page=${channelPage}&sort=latest`);
      if (!Array.isArray(data?.videos)) throw new Error('投稿を取得できませんでした。');
      return data.videos.map(v => tab === 'shorts' ? {...v, isShort: true} : v);
    }));
    if (tabs.every(t => t.status === 'rejected')) throw tabs[0].reason;
    return tabs.flatMap(t => t.status === 'fulfilled' ? t.value : []);
  }));
  if (results.length && results.every(r => r.status === 'rejected')) throw new Error('登録チャンネルを読み込めませんでした。時間をおいて再試行してください。');
  const videos = [...new Map(results.flatMap(r => r.status === 'fulfilled' ? r.value : []).filter(v => v?.videoId).map(v => [v.videoId, v])).values()];
  return {videos, hasMore: page % batches !== 0 || videos.length > 0};
}
