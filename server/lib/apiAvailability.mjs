// Best-effort per-isolate hints; a cold instance safely probes again.
export function createApiSelector(fetcher=fetch,now=Date.now){
 const health=new Map(),pending=new Map();
 const key=(origin,headers)=>origin+'|'+(headers.get('origin')||'');
 const remember=(origin,headers,ok)=>{if(health.size>512)health.clear();health.set(key(origin,headers),{ok,until:now()+(ok?30000:10000)});};
 const probe=(origin,headers)=>{
  const k=key(origin,headers),cached=health.get(k);if(cached&&cached.until>now())return Promise.resolve(cached.ok);
  if(pending.has(k))return pending.get(k);
  const task=(async()=>{let ok=false;try{const safe=new Headers();for(const n of ['origin','authorization'])if(headers.has(n))safe.set(n,headers.get(n));const response=await fetcher(origin+'/health',{headers:safe,redirect:'manual',signal:AbortSignal.timeout(1500)});if(response.ok){const body=await response.json();ok=body?.status==='ok'||body?.ok===true;}else await response.body?.cancel();}catch{}remember(origin,headers,ok);return ok;})().finally(()=>pending.delete(k));pending.set(k,task);return task;
 };
 return {report:remember,async plan(pool,headers){
  if(pool.length<2)return pool;
  const good=pool.filter(origin=>{const v=health.get(key(origin,headers));return v?.ok&&v.until>now();});
  const unknown=pool.filter(origin=>{const v=health.get(key(origin,headers));return !v||v.until<=now();});
  if(good.length)return [...good,...unknown];
  // Probe at most four peers concurrently, stopping when a usable peer is found.
  const deadline=now()+6000;
  for(let i=0;i<unknown.length&&now()<deadline;i+=4){const batch=unknown.slice(i,i+4);const results=await Promise.all(batch.map(origin=>probe(origin,headers)));const live=batch.filter((_,j)=>results[j]);if(live.length)return [...live,...unknown.slice(i+4)];}
  return [];
 }};
}
export const apiSelector=createApiSelector();
