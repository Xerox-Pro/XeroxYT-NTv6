import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSubscriptionPage} from '../src/lib/subscriptionFeed.mjs';
const channels = Array.from({length:4},(_,i)=>({id:`UC${i}`,title:`名前,${i}`}));
test('subscriptions use channel IDs, include shorts and deduplicate uploads',async()=>{
 const urls=[];const result=await fetchSubscriptionPage(channels,'UC1',1,async url=>{urls.push(url);return {videos:[{videoId:'a'}],shortVideos:[{videoId:'b'},{videoId:'a'}]};});
 assert.deepEqual(urls,['/api/channel/UC1?v=2']);assert.equal(result.videos.length,2);assert.equal(result.videos.find(v=>v.videoId==='b').isShort,true);
});
test('subscriptions cover every channel before sorting and limit concurrency',async()=>{
 const urls=[];let active=0,maxActive=0;const fetch=async url=>{urls.push(url);maxActive=Math.max(maxActive,++active);await new Promise(resolve=>setTimeout(resolve,1));active--;return {videos:[{videoId:url,publishedText:url.includes('UC3')?'1時間前':'3日前'}],shortVideos:[]};};
 const first=await fetchSubscriptionPage(channels,'all',1,fetch);assert.equal(urls.length,4);assert.ok(first.videos[0].videoId.includes('UC3'));assert.ok(maxActive<=3);
 urls.length=0;await fetchSubscriptionPage(channels,'all',2,fetch);assert.equal(urls.length,8);assert.ok(urls.every(u=>u.includes('page=2')));
});
test('one failed channel does not hide others; total failure is an error',async()=>{
 const partial=await fetchSubscriptionPage(channels,'all',1,async url=>{if(url.includes('UC0'))return {videos:[{videoId:'a'}]};throw Error('offline');});assert.equal(partial.videos.length,1);
 await assert.rejects(fetchSubscriptionPage(channels,'all',1,async()=>{throw Error('offline');}),/再試行/);
 await assert.rejects(fetchSubscriptionPage(channels,'all',1,async()=>({error:'unavailable'})),/再試行/);
});
