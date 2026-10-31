import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsyncCache } from '../async-cache.mjs';
import { createRecommendationLoader } from '../recommendation-pools.mjs';
import { mergeShortsQueue } from '../src/lib/shortsFeed.mjs';
import { learnInteraction, rankCandidates, features } from '../src/lib/localRecommendations.mjs';

test('concurrent public work coalesces; expiry, eviction and failure permit fresh loads', async () => {
  let now = 0, calls = 0;
  const cache = createAsyncCache({ ttlMs: 10, maxEntries: 2, now: () => now });
  const load = async () => { calls++; return calls; };
  assert.deepEqual(await Promise.all([cache('a',load),cache('a',load)]),[1,1]);
  assert.equal(await cache('a',load),1);
  now=11; assert.equal(await cache('a',load),2);
  await cache('b',load); await cache('c',load); assert.equal(await cache('a',load),5);
  await assert.rejects(cache('bad',async()=>{throw Error('offline')}));
  assert.equal(await cache('bad',load),6);
});
test('recommendation misses need at most four history and three search calls; repeats reuse public pools', async () => {
  let info=0, searches=[];
  const load=createRecommendationLoader(async()=>({
    getInfo:async id=>{info++;return {watch_next_feed:[{videoId:id,title:id}]};},
    search:async q=>{searches.push(q);return {videos:[{videoId:q,title:q}]};}
  }),x=>x);
  const options={historyIds:Array.from({length:20},(_,i)=>String(i).padStart(11,'0')),keywords:'ギター 猫 科学',page:1,seed:'day'};
  const [a,b]=await Promise.all([load(options),load(options)]);
  assert.equal(info,4);assert.equal(searches.length,3);assert.ok(searches.includes('ギター'));assert.deepEqual(a,b);
  await load(options);assert.equal(info,4);assert.equal(searches.length,3);
  await load({...options,page:2});assert.equal(info,8);assert.ok(searches.includes('猫'));
});
test('one failing candidate source does not hide healthy candidates; complete failure is retryable', async()=>{
  const load=createRecommendationLoader(async()=>({getInfo:async()=>{throw Error('offline')},search:async()=>({videos:[{videoId:'abcdefghijk'}]})}),x=>x);
  assert.equal((await load({historyIds:['lmnopqrstuv']}))[0].videoId,'abcdefghijk');
  const failed=createRecommendationLoader(async()=>({search:async()=>{throw Error('offline')}}),x=>x);
  await assert.rejects(failed());
});
test('combined queue retains every source, selected clip and prepared prefix across refills',()=>{
  const clips=Array.from({length:12},(_,i)=>({videoId:String(i)}));
  const initial=mergeShortsQueue([],clips,'','3');assert.equal(initial[0].videoId,'3');assert.equal(initial.length,12);
  const next=mergeShortsQueue(initial,[...clips].reverse(),initial[2].videoId);
  assert.deepEqual(next.slice(0,5),initial.slice(0,5));assert.equal(next.length,12);assert.equal(new Set(next.map(v=>v.videoId)).size,12);
});
test('topic saturation and repeated creators leave room for exploration; explicit rejection persists',()=>{
  const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  const cats=Array.from({length:12},(_,i)=>({videoId:`cat${i}`,title:'猫 かわいい 動物',author:`cat creator ${i}`,isShort:true}));
  const science=Array.from({length:8},(_,i)=>({videoId:`science${i}`,title:'科学 実験 宇宙',author:`science creator ${i}`,isShort:true}));
  learnInteraction(cats[0],'like');
  const result=rankCandidates([...cats,...science],{short:true,seed:'diverse'});
  assert.ok(result.slice(0,10).some(v=>v.videoId.startsWith('science')));
  learnInteraction(cats[1],'notInterested');assert.ok(!rankCandidates(cats,{short:true}).some(v=>v.videoId==='cat1'));
  assert.ok(!features({title:'#shorts #YouTube 猫'}).includes('#shorts'));
});
