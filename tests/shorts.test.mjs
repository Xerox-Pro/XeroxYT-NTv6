import test from 'node:test';
import assert from 'node:assert/strict';
import { isShortAspect, normalizeShort, collectShorts, shortDetails, registerShortsRoutes } from '../shorts.mjs';
const short = (id='abcdefghijk', dimensions={width:405,height:720}) => ({ type:'ShortsLockupView', on_tap_endpoint:{payload:{videoId:id}}, thumbnail:[{url:'https://i.ytimg.com/x',...dimensions}], overlay_metadata:{primary_text:{text:'A short'}, secondary_text:{text:'1万回視聴'}} });
test('accepts 9:16 and rejects landscape, square, missing and misleading title-only videos', () => {
 assert.equal(isShortAspect(1080,1920),true);
 for(const [w,h] of [[1920,1080],[720,720],[0,720],[NaN,720]]) assert.equal(isShortAspect(w,h),false);
 assert.equal(normalizeShort({type:'Video',id:'abcdefghijk',title:'#shorts',duration:{seconds:15},thumbnails:[{width:405,height:720}]}),null);
 assert.equal(normalizeShort(short('abcdefghijk',{width:720,height:720})),null);
 assert.equal(normalizeShort(short()).videoId,'abcdefghijk');
 const emptyThumbnail=short();emptyThumbnail.thumbnail=[];emptyThumbnail.on_tap_endpoint.payload.thumbnail={thumbnails:[{url:'x',width:1080,height:1920}],isOriginalAspectRatio:true};
 assert.equal(normalizeShort(emptyThumbnail).videoId,'abcdefghijk');
});
test('extracts nested shelves and continuation memos without duplicates or circular recursion', () => {
 const root={contents:[{type:'ReelShelf',items:[short(),short()]}]}; root.self=root;
 assert.equal(collectShorts(root).length,1);
 assert.equal(collectShorts({page:{on_response_received_commands_memo:new Map([['ShortsLockupView',[short()]]])}}).length,1);
});
test('playback checks actual stream dimensions, not cropped thumbnails', () => {
 const info={basic_info:{title:'x',duration:40,thumbnail:[{width:405,height:720}]},streaming_data:{adaptive_formats:[{width:1920,height:1080}]}};
 assert.equal(shortDetails(info,'abcdefghijk').status,422);
 info.streaming_data.adaptive_formats=[{width:1080,height:1920}];
 assert.equal(shortDetails(info,'abcdefghijk').video.aspectVerified,true);
 assert.equal(shortDetails({...info,streaming_data:{}},'abcdefghijk').status,422);
 assert.equal(shortDetails({...info,streaming_data:{}},'abcdefghijk',{width:1080,height:1920}).video.aspectVerified,true);
 assert.equal(shortDetails({...info,basic_info:{duration:900}},'abcdefghijk').status,422);
});
function harness(youtube) {
 const routes={}; registerShortsRoutes({get:(path,handler)=>routes[path]=handler},async()=>youtube);
 return async(path,query={},params={})=>{const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}}; await routes[path]({query,params},res); return res;};
}
test('search pagination follows actual continuation and short refinement, preserves query', async()=>{
 let searched=[];let refined=0;let continued=0;
 const next={videos:[short('lmnopqrstuv')],has_continuation:false};
 const first={videos:[short()],refinement_filters:['すべて','ショート'],has_continuation:true,async applyRefinement(){refined++;return this;},async getContinuation(){continued++;return next;}};
 const call=harness({search:async q=>{searched.push(q);return first;}});
 const one=await call('/api/shorts',{source:'search',q:'猫'});
 assert.equal(one.body.videos[0].videoId,'abcdefghijk'); assert.equal(one.body.hasMore,true);
 const two=await call('/api/shorts',{source:'search',q:'猫',page:'2'});
 assert.equal(two.body.videos[0].videoId,'lmnopqrstuv');assert.equal(two.body.hasMore,false);
 assert.deepEqual(searched,['猫']);assert.equal(refined,1);assert.equal(continued,1);
});
test('rejects unbounded/invalid inputs before calling YouTube; errors are retryable',async()=>{
 const call=harness({search:async()=>{throw new Error('upstream');}});
 for(const query of [{page:999},{source:'bad'},{source:'search'},{source:'related',videoId:'bad'}]) assert.equal((await call('/api/shorts',query)).code,400);
 assert.equal((await call('/api/shorts/:id',{}, {id:'bad'})).code,400);
 assert.equal((await call('/api/shorts',{source:'search',q:'猫'})).code,502);
});
test('cold serverless instance re-verifies original aspect from upstream, not client parameters',async()=>{
 const item=short();item.thumbnail=[];item.on_tap_endpoint.payload.thumbnail={isOriginalAspectRatio:true,thumbnails:[{url:'original',width:1080,height:1920}]};
 const call=harness({getInfo:async()=>({basic_info:{title:'A short',duration:30},primary_info:{}}),search:async()=>({videos:[item]})});
 const response=await call('/api/shorts/:id',{title:'A short',width:1080,height:1920},{id:'abcdefghijk'});
 assert.equal(response.code,200); assert.equal(response.body.aspectVerified,true);
 const mismatch=await call('/api/shorts/:id',{title:'A short',width:1080,height:1920},{id:'lmnopqrstuv'});
 assert.equal(mismatch.code,422);
});
