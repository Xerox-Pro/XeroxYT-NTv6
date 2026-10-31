import test from 'node:test';
import assert from 'node:assert/strict';
import {learnInteraction,learnSearch,learnedTerms,rankCandidates,createPlaybackTracker,features} from '../src/lib/localRecommendations.mjs';
function storage(){const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};return map;}
const guitar={videoId:'guitar00001',title:'ギター 演奏 #ロック',author:'guitarist',isShort:true};
const cats={videoId:'cats0000001',title:'猫 かわいい 動物',author:'cats',isShort:true};
test('local topics combine normal searches with Shorts feedback without leaking Shorts into normal recommendations',()=>{
 storage();learnSearch('ギター');learnInteraction(guitar,'like');
 assert.ok(learnedTerms(true).includes('ギター'));assert.ok(!learnedTerms(false).includes('#ロック'));
 learnInteraction({...guitar,isShort:false},'save');assert.ok(learnedTerms(false).includes('#ロック'));
 localStorage.setItem('xerox_last_account_id','different');assert.deepEqual(learnedTerms(true),[]);
});
test('ranking uses interest, explicit negative feedback, unshown priority and deduplication',()=>{
 storage();learnInteraction(guitar,'save');
 assert.equal(rankCandidates([cats,guitar,guitar],{short:true})[0].videoId,guitar.videoId);
 assert.equal(rankCandidates([cats,guitar],{short:true,seen:[guitar.videoId]})[0].videoId,cats.videoId);
 learnInteraction(guitar,'notInterested');
 assert.equal(rankCandidates([cats,guitar],{short:true})[0].videoId,cats.videoId);
});
test('metadata hashtags and bounded repeat events train locally',()=>{
 storage();assert.ok(features({...guitar,description:'#制作'}).includes('#制作'));
 for(let i=0;i<100;i++)learnInteraction(guitar,'like');
 const scores=learnedTerms(true);assert.ok(scores.includes('ギター'));
 assert.equal(rankCandidates([guitar,cats,guitar],{short:true}).length,2);
});
test('tracker counts playing progress but ignores pause, background, buffering and seeks',()=>{
 storage();const events=[];const tracker=createPlaybackTracker(guitar,(...args)=>events.push(args));
 tracker.update(0,10,true,true,0);tracker.update(1,10,true,true,1000);
 tracker.update(1,10,true,true,2000);tracker.update(9,10,true,true,3000);
 tracker.update(9,10,false,true,4000);tracker.update(9,10,true,false,5000);
 tracker.update(10,10,true,true,6000);
 assert.equal(tracker.stats().seconds,1);tracker.finish();tracker.finish();
 assert.equal(events.length,1);assert.ok(events[0][2]<0);
});
test('completion and replay give bounded positive signals, missing playback data gives none',()=>{
 storage();const events=[];const tracker=createPlaybackTracker(guitar,(...args)=>events.push(args));
 for(let i=0;i<=10;i++)tracker.update(i,10,true,true,i*1000);
 tracker.update(0,10,true,true,11000);tracker.finish();
 assert.equal(tracker.stats().loops,1);assert.ok(events[0][2]>1);
 createPlaybackTracker(cats,(...args)=>events.push(args)).finish();assert.equal(events.length,1);
});
test('an account change does not attribute an old playback session to the new account',()=>{
 storage();let count=0;const tracker=createPlaybackTracker(guitar,()=>count++);
 tracker.update(0,10,true,true,0);tracker.update(1,10,true,true,1000);
 localStorage.setItem('xerox_last_account_id','other');tracker.finish();assert.equal(count,0);
});
