import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryQueries, diversifyShorts, shuffleSeeded } from '../shorts-discovery.mjs';
import { registerShortsRoutes } from '../shorts.mjs';
import { createShortsSession, readSeenShorts, recordSeenShort, discoveryRequest, unseenRankingFirst } from '../src/lib/shortsFeed.mjs';
const node = id => ({type:'ShortsLockupView',on_tap_endpoint:{payload:{videoId:id}},thumbnail:[{width:1080,height:1920,url:'x'}],overlay_metadata:{primary_text:{text:id}}});
test('sessions rotate topic itineraries and later pages move to other topics, with relevant context retained',()=>{
 const first=discoveryQueries('session-one',1,'piano');
 assert.equal(first.length,3);assert.equal(first[0],'piano #shorts');
 assert.notDeepEqual(first,discoveryQueries('session-two',1,'piano'));
 assert.notDeepEqual(first.slice(1),discoveryQueries('session-one',2,'piano').slice(1));
 const inputs=Array.from({length:20},(_,i)=>i);
 assert.deepEqual(shuffleSeeded(inputs,'a'),shuffleSeeded(inputs,'a'));
 assert.notDeepEqual(shuffleSeeded(inputs,'a'),shuffleSeeded(inputs,'b'));
});
test('diversity removes seen clips and duplicates, and limits domination by known channels',()=>{
 const clips=Array.from({length:30},(_,i)=>({videoId:String(i).padStart(11,'0'),authorId:i<15?'same':`channel${i}`}));
 const result=diversifyShorts([...clips,clips[20]],'session',['00000000020']);
 assert.ok(!result.some(v=>v.videoId==='00000000020'));
 assert.equal(new Set(result.map(v=>v.videoId)).size,result.length);
 assert.ok(result.filter(v=>v.authorId==='same').length<=2);
 assert.ok(result.length>10);
});
test('discovery API queries multiple sources and excludes already watched IDs on a fresh session',async()=>{
 const routes={};const queries=[];
 const yt={search:async q=>{queries.push(q);return{videos:[node('abcdefghijk'),node('lmnopqrstuv')],refinement_filters:[]}}};
 registerShortsRoutes({get:(path,handler)=>routes[path]=handler},async()=>yt);
 const res={code:200,setHeader(key,value){this[key]=value},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await routes['/api/shorts']({query:{source:'search',q:'piano',session:'fresh-session',exclude:'abcdefghijk'},params:{}},res);
 assert.equal(queries.length,3);assert.equal(res.code,200);assert.equal(res['Cache-Control'],'private, no-store');
 assert.deepEqual(res.body.videos.map(v=>v.videoId),['lmnopqrstuv']);
 assert.equal(res.body.hasMore,true);
});
test('discovery survives one failed query and still returns other topic clips',async()=>{
 const routes={};let count=0;
 registerShortsRoutes({get:(path,handler)=>routes[path]=handler},async()=>({search:async()=>{if(++count===1)throw Error('topic failed');return{videos:[node('abcdefghijk')],refinement_filters:[]}}}));
 const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await routes['/api/shorts']({query:{source:'search',q:'piano',session:'fresh'},params:{}},res);
 assert.equal(res.body.videos.length,1);
});
test('client tracks seen clips per account, carries old short history, and sends bounded exclusions',()=>{
 const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 localStorage.setItem('xerox_watch_history',JSON.stringify([{videoId:'abcdefghijk',type:'short'}]));
 recordSeenShort('lmnopqrstuv');assert.deepEqual(readSeenShorts(),['lmnopqrstuv','abcdefghijk']);
 localStorage.setItem('xerox_last_account_id','second');localStorage.setItem('xerox_watch_history','[]');assert.deepEqual(readSeenShorts(),[]);
 const ids=Array.from({length:500},(_,i)=>String(i).padStart(11,'0'));
 const url=new URL(discoveryRequest('source=home',2,'new-session',ids),'https://example.com');
 assert.equal(url.searchParams.get('exclude').split(',').length,300);assert.equal(url.searchParams.get('session'),'new-session');
 assert.notEqual(createShortsSession(),createShortsSession());
 assert.deepEqual(unseenRankingFirst([{videoId:'a'},{videoId:'b'}],['a']).map(v=>v.videoId),['b','a']);
});
