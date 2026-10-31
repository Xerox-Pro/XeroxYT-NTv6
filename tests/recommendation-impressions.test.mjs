import test from 'node:test';
import assert from 'node:assert/strict';
import {recordImpression,prioritizeUnshown} from '../src/lib/recommendationImpressions.mjs';
import {unseenRankingFirst} from '../src/lib/shortsFeed.mjs';
test('normal impression priority isolates accounts and retains displayed videos only as fallback',()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 recordImpression('a');assert.deepEqual(prioritizeUnshown([{videoId:'a'},{videoId:'b'}]).map(v=>v.videoId),['b','a']);
 localStorage.setItem('xerox_last_account_id','other');assert.deepEqual(prioritizeUnshown([{videoId:'a'},{videoId:'b'}]).map(v=>v.videoId),['a','b']);
});
test('ranking randomization is stable within a session, varies across sessions and puts unseen clips first',()=>{
 const videos=Array.from({length:30},(_,i)=>({videoId:`id${i}`}));
 const first=unseenRankingFirst(videos,['id1','id2'],'','session1');
 assert.deepEqual(first,unseenRankingFirst(videos,['id1','id2'],'','session1'));
 assert.notDeepEqual(first,unseenRankingFirst(videos,['id1','id2'],'','session2'));
 assert.ok(first.slice(-2).every(v=>['id1','id2'].includes(v.videoId)));
});
