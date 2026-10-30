import test from 'node:test';
import assert from 'node:assert/strict';
import {splitWatchHistory,loadWatchHistories} from '../src/lib/watchHistory.mjs';
test('short and normal histories remain independent even with the same video ID',()=>{
 const input=[{videoId:'same',type:'video',timestamp:1},{videoId:'same',type:'short',timestamp:2},{videoId:'other',type:'short',timestamp:3}];
 const split=splitWatchHistory(input);assert.deepEqual(split.videos.map(v=>v.videoId),['same']);assert.equal(split.shorts.length,2);
 assert.equal(split.videos.some(v=>v.type==='short'),false);
});
test('migrates mixed legacy history without losing separately saved shorts',()=>{
 const data={xerox_watch_history:JSON.stringify([{videoId:'a',type:'video'},{videoId:'b',type:'short'}]),xerox_short_history:JSON.stringify([{videoId:'c',type:'short'}])};
 globalThis.localStorage={getItem:key=>data[key]||null};const split=loadWatchHistories();assert.equal(split.videos.length,1);assert.equal(split.shorts.length,2);
});
