import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeDailyRanking,loadShortsRanking} from '../src/lib/rankingClient.mjs';
import {excludeSeenShorts} from '../src/lib/shortsFeed.mjs';
const video=id=>({videoId:id,title:id});
test('ranking updates retain earlier unshown clips of the same JST day and replace metadata without duplicates',()=>{
 const now=Date.UTC(2026,9,31,1);
 const first=mergeDailyRanking(null,{videos:[video('abcdefghijk'),video('lmnopqrstuv')]},now);
 const next=mergeDailyRanking(first,{videos:[{...video('lmnopqrstuv'),title:'updated'},video('12345678901')]},now+3600000);
 assert.equal(next.videos.length,3);assert.equal(next.videos[1].title,'updated');
 assert.deepEqual(excludeSeenShorts(next.videos,['lmnopqrstuv']).map(v=>v.videoId),['abcdefghijk','12345678901']);
 const tomorrow=mergeDailyRanking(next,{videos:[video('12345678901')]},Date.UTC(2026,9,31,15));
 assert.equal(tomorrow.videos.length,1);
});
test('seen clips are excluded, including all-seen pools, except a clip explicitly opened by the user',()=>{
 const videos=[video('abcdefghijk'),video('lmnopqrstuv')];
 assert.deepEqual(excludeSeenShorts(videos,videos.map(v=>v.videoId)),[]);
 assert.deepEqual(excludeSeenShorts(videos,videos.map(v=>v.videoId),'abcdefghijk'),[videos[0]]);
});
test('device ranking uses a short local cache and retains the day on a failed refresh',async()=>{
 const oldStorage=globalThis.localStorage, oldFetch=globalThis.fetch;
 const data=new Map();
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({items:[{video_id:'abcdefghijk',views:15}],updated_at:'today'});};
 try {
  const first=await loadShortsRanking();
  assert.equal(first.videos.length,1);
  assert.equal((await loadShortsRanking()).videos.length,1);
  assert.equal(calls,1);
  const key='xerox_ranking_day_v1_local';
  data.set(key,JSON.stringify({...first,fetchedAt:0}));
  globalThis.fetch=async()=>{calls++;throw new TypeError('Network blocked');};
  const saved=await loadShortsRanking();
  assert.deepEqual(saved.videos,first.videos);
  assert.equal(calls,4);
 } finally {
  if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
  globalThis.fetch=oldFetch;
 }
});
