import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRanking, createRankingLoader } from '../shorts-ranking.mjs';
import { mixShorts } from '../src/lib/shortsFeed.mjs';
const clip=(id,shortSource)=>({videoId:id,shortSource});
test('ranking returns up to 200 unique real entries sorted by views; never pads missing entries',()=>{
 const items=Array.from({length:220},(_,i)=>({video_id:String(i).padStart(11,'0'),title:`clip ${i}`,views:i,url:'https://evil.example/'}));
 items.push(items[0]); items.push({video_id:'invalid'});
 const result=parseRanking({items,updated_at:'today'});
 assert.equal(result.count,200); assert.equal(result.videos[0].videoId,'00000000219');
 assert.equal(result.videos[0].videoThumbnails[0].url.startsWith('https://i.ytimg.com/vi/'),true);
 assert.equal(parseRanking({items:items.slice(0,111)}).count,111);
});
test('mix alternates sources exactly, deduplicates overlapping videos, keeps selected start and appended order',()=>{
 const regular=[clip('a','youtube'),clip('b','youtube'),clip('x','youtube')];
 const ranking=[clip('r','ranking'),clip('x','ranking'),clip('t','ranking')];
 const result=mixShorts(regular,ranking);
 assert.deepEqual(result.map(v=>v.videoId),['a','r','b','x']);
 assert.deepEqual(result.map(v=>v.shortSource),['youtube','ranking','youtube','ranking']);
 const extended=mixShorts([...regular,clip('c','youtube')],ranking);
 assert.deepEqual(extended.slice(0,result.length),result);
 assert.deepEqual(mixShorts(regular,ranking,'x').map(v=>v.videoId),['x','a','t','b']);
});
test('ranking refreshes on each visit; only concurrent requests share in-flight fetch and no cache survives',async()=>{
 let calls=0;
 const load=createRankingLoader(async(url,options)=>{
  calls++; assert.equal(new URL(url).origin,'https://shorts-ranking.com');assert.equal(new URL(url).pathname,'/latest.json');
  assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
  await new Promise(resolve=>setTimeout(resolve,5));
  return new Response(JSON.stringify({items:[{video_id:'abcdefghijk',views:calls}]}));
 });
 const [a,b]=await Promise.all([load(),load()]);assert.equal(calls,1);assert.deepEqual(a,b);
 const c=await load();assert.equal(calls,2);assert.equal(c.videos[0].viewCount,2);
});
test('ranking rejects upstream errors, malformed data and oversized responses',async()=>{
 await assert.rejects(createRankingLoader(async()=>new Response('',{status:503}))());
 await assert.rejects(createRankingLoader(async()=>new Response('{}'))());
 await assert.rejects(createRankingLoader(async()=>new Response('{}',{headers:{'content-length':'9000000'}}))());
});
