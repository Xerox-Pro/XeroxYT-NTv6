// Local content-based online learner. No remote model or cross-user tracking.
const storeKey = () => `xerox_recommender_v1_${localStorage.getItem('xerox_last_account_id') || 'local'}`;
const HALF_LIFE = 21 * 86400000;
const stop = new Set(['shorts','short','動画','公式','これ','それ','こと','さん','です','ます','する','ある','いる','なる','youtube','official']);
export function features(video) {
  const text = [video.title, ...(video.hashtags || []), ...(video.tags || [])].filter(x=>typeof x==='string').join(' ').toLowerCase().slice(0,1500);
  const tags = `${text} ${(video.description || '').slice(0,5000)}`.match(/#[\p{L}\p{N}_]+/gu) || [];
  let words = text.match(/[\p{L}\p{N}_]{2,30}/gu) || [];
  if (typeof Intl.Segmenter === 'function') words = [...new Intl.Segmenter('ja',{granularity:'word'}).segment(text)].filter(x=>x.isWordLike).map(x=>x.segment);
  return [...new Set([...tags,...words.filter(x=>x.length>=2&&!stop.has(x))])].slice(0,32);
}
export function readLocalModel() {
  try {const x=JSON.parse(localStorage.getItem(storeKey())||'null');if(x?.normal&&x?.short)return x;} catch {}
  return {normal:{},short:{}};
}
const decay = row => Math.pow(0.5,Math.max(0,Date.now()-row.at)/HALF_LIFE);
export function learnInteraction(video, kind, value=1) {
  if (!video?.videoId) return;
  const lane=video.isShort||video.type==='short'?'short':'normal';
  const weights={like:3,unlike:-3,save:4,unsave:-4,dislike:-4,notInterested:-6,search:2,comment:0.3,watch:1};
  const weight=Math.max(-6,Math.min(6,(weights[kind]||0)*value));
  if(!weight)return;
  const model=readLocalModel();const rows=model[lane];
  const id=`${kind}:${video.videoId}`;
  const old=rows[id];
  // Repeated callbacks for a single video cannot endlessly strengthen its topic.
  const strength=kind==='watch'?Math.max(-2,Math.min(2,(old?.score||0)+weight)):weight;
  rows[id]={score:strength,at:Date.now(),terms:features(video),channel:String(video.authorId||video.author||'').slice(0,160)};
  model[lane]=Object.fromEntries(Object.entries(rows).sort((a,b)=>b[1].at-a[1].at).slice(0,500));
  try{localStorage.setItem(storeKey(),JSON.stringify(model));}catch{}
}
export function learnSearch(query) {
  const text=String(query||'').trim().slice(0,160);
  if(!text||/^https?:\/\//i.test(text))return;
  learnInteraction({videoId:`query:${text}`,title:text},'search');
}
export function topicScores(short=false) {
  const model=readLocalModel();const scores=new Map();
  for(const [lane,factor] of short?[[model.normal,0.65],[model.short,1]]:[[model.normal,1]]) {
    for(const row of Object.values(lane)) {
      const score=row.score*decay(row)*factor;
      for(const term of row.terms||[])scores.set(term,(scores.get(term)||0)+score);
    }
  }
  return scores;
}
export function learnedTerms(short=false,limit=5) {
  return [...topicScores(short)].filter(([term,score])=>score>0.3&&!stop.has(term.replace(/^#/,''))).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([term])=>term);
}
export function rankCandidates(videos,{short=false,seed='local',seen=[]}={}) {
  const scores=topicScores(short);
  const model=readLocalModel(); const channels=new Map();
  for(const [lane,factor] of short?[[model.normal,0.65],[model.short,1]]:[[model.normal,1]]) for(const row of Object.values(lane)) { if(row.channel) channels.set(row.channel,(channels.get(row.channel)||0)+row.score*decay(row)*factor); }
  const seenSet=new Set(seen);const unique=[...new Map(videos.filter(v=>v?.videoId).map(v=>[v.videoId,v])).values()];
  const noise=id=>{let n=2166136261;for(const c of `${seed}:${id}`)n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0)/4294967296;};
  const score=v=>features(v).reduce((sum,t)=>sum+Math.tanh((scores.get(t)||0)/4),0)/Math.sqrt(Math.max(1,features(v).length))+Math.tanh((channels.get(String(v.authorId||v.author||''))||0)/6)*0.3+noise(v.videoId)*0.35;
  const pool=unique.map(v=>({v,s:score(v)})).sort((a,b)=>Number(seenSet.has(a.v.videoId))-Number(seenSet.has(b.v.videoId))||b.s-a.s);
  const result=[];let last='';
  while(pool.length){
    const unshown=pool.some(x=>!seenSet.has(x.v.videoId));
    const eligible=pool.filter(x=>!unshown||!seenSet.has(x.v.videoId));
    const diverse=eligible.filter(x=>!last||String(x.v.authorId||x.v.author||x.v.videoId)!==last);
    const options=diverse.length?diverse:eligible;
    const pick=result.length%5===4?[...options].sort((a,b)=>noise(b.v.videoId)-noise(a.v.videoId))[0]:options[0];
    result.push(pick.v);last=String(pick.v.authorId||pick.v.author||pick.v.videoId);pool.splice(pool.indexOf(pick),1);
  }
  return result;
}
export function createPlaybackTracker(video,commit=learnInteraction) {
 const owner = storeKey();
 let last=null,seconds=0,loops=0,duration=0,reported=false;
 return {
  update(time,total,playing,visible=true,now=Date.now()) {
   if(!Number.isFinite(time)||time<0)return;
   if(Number.isFinite(total)&&total>0)duration=total;
   if(last&&playing&&last.playing&&visible&&last.visible) {
    const wall=(now-last.now)/1000,delta=time-last.time;
    if(wall>0&&wall<=5&&delta>0&&delta<=wall*3+0.5)seconds+=Math.min(delta,wall*2);
    if(duration&&last.time>duration*0.8&&time<duration*0.2&&seconds>duration*0.75)loops=Math.min(loops+1,2);
   }
   last={time,playing,visible,now};
  },
  finish() {
   if(reported||seconds<0.5||storeKey()!==owner)return;reported=true;
   const ratio=duration?Math.min(1,seconds/duration):0;
   const positive=ratio>=0.85?1.4:ratio>=0.5?0.7:seconds>=30?0.5:0;
   const skipped=seconds<2&&ratio<0.2?-0.6:0;
   commit(video,'watch',Math.min(2,positive+loops*0.2+skipped));
  },
  stats:()=>({seconds,loops,duration})
 };
}
