import {sortSubscriptions} from './subscriptionOrder.mjs';
// Fetch real channel uploads, rather than search results matching channel names.
export async function fetchSubscriptionPage(subscriptions, selectedId, page, fetchJSON) {
  const channels = subscriptions.filter(s => selectedId === 'all' || s.id === selectedId);
  // Fetch all registered channels with at most three channel requests in flight.
  // Paging channel groups cannot produce a globally newest-first feed.
  const channelPage = page;
  const results = new Array(channels.length);
  let cursor = 0;
  const load = async channel => {
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
  };
  await Promise.all(Array.from({length: Math.min(3,channels.length)},async()=>{
    while(cursor<channels.length){const index=cursor++;try{results[index]={status:'fulfilled',value:await load(channels[index])};}catch(reason){results[index]={status:'rejected',reason};}}
  }));
  if (results.length && results.every(r => r.status === 'rejected')) throw new Error('登録チャンネルを読み込めませんでした。時間をおいて再試行してください。');
  const videos = [...new Map(results.flatMap(r => r.status === 'fulfilled' ? r.value : []).filter(v => v?.videoId).map(v => [v.videoId, v])).values()];
  return {videos:sortSubscriptions(videos), hasMore:videos.length > 0};
}
