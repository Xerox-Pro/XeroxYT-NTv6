export function publicationTime(video, now=Date.now()) {
  for (const value of [video.publishedAt,video.publishedTimestamp,video.published]) {
    if (typeof value==='number'&&Number.isFinite(value)) return value<1e12?value*1000:value;
    if (typeof value==='string'&&/^\d{4}[-/]/.test(value)) {const parsed=Date.parse(value);if(Number.isFinite(parsed))return parsed;}
  }
  const text=String(video.publishedText||'').trim();
  const relative=text.match(/([\d,.]+)\s*(秒|分|時間|日|週間?|か月|ヶ月|月|年|seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*(?:前|ago)/i);
  if(relative){const n=Number(relative[1].replaceAll(',','')),unit=relative[2].toLowerCase();const seconds=/秒|second/.test(unit)?1:/^分|minute/.test(unit)?60:/時間|hour/.test(unit)?3600:/^日|day/.test(unit)?86400:/週|week/.test(unit)?604800:/月|month/.test(unit)?2592000:31536000;return now-n*seconds*1000;}
  if(/^(今日|today)$/i.test(text))return now;
  if(/^(昨日|yesterday)$/i.test(text))return now-86400000;
  if(/^\d{4}[-/年]/.test(text)){const parsed=Date.parse(text.replace('年','/').replace('月','/').replace('日',''));if(Number.isFinite(parsed))return parsed;}
  return 0;
}
export function sortSubscriptions(videos,now=Date.now()) {return videos.map((video,index)=>({video,index,time:publicationTime(video,now)})).sort((a,b)=>b.time-a.time||a.index-b.index).map(item=>item.video);}
