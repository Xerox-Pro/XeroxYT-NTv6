import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeDailyRanking} from '../src/lib/rankingClient.mjs';
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
