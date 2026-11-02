const prefix='xerox_home_snapshot_v1_';
export function loadHomeSnapshot(category,scope='guest',storage=globalThis.localStorage){try{const data=JSON.parse(storage.getItem(prefix+scope)||'{}');return Array.isArray(data[category]?.videos)?data[category].videos.filter(v=>v?.videoId):[];}catch{return [];}}
export function saveHomeSnapshot(category,videos,scope='guest',append=false,storage=globalThis.localStorage){
 try{const previous=JSON.parse(storage.getItem(prefix+scope)||'{}');const merged=append?[...loadHomeSnapshot(category,scope,storage),...videos]:videos;const clean=[...new Map(merged.filter(v=>v?.videoId).map(v=>[v.videoId,v])).values()].slice(0,80).map(v=>{const {recommendedVideos,description,...summary}=v;return summary;});if(!clean.length)return;
 const entries=Object.entries({...previous,[category]:{updated:Date.now(),videos:clean}}).sort((a,b)=>b[1].updated-a[1].updated).slice(0,8);storage.setItem(prefix+scope,JSON.stringify(Object.fromEntries(entries)));}catch{}
}
