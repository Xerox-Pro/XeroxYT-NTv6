import test from 'node:test';import assert from 'node:assert/strict';import {createApiSelector} from '../server/lib/apiAvailability.mjs';
test('skips failed peers, shares health probes, and retries recovered peers after cooldown',async()=>{
 let time=0,recovered=false;const calls=[];const headers=new Headers({Origin:'https://site.example',Authorization:'Bearer test',Cookie:'private'});
 const selector=createApiSelector(async(url,options)=>{calls.push(url);assert.equal(options.headers.has('cookie'),false);assert.ok(url.endsWith('/api/health')||url.endsWith('/health'));return url.includes('first')&&!recovered?Response.json({error:'down'},{status:503}):Response.json({status:'ok'});},()=>time);
 const pool=['https://first.example','https://second.example'];const both=await Promise.all([selector.plan(pool,headers),selector.plan(pool,headers)]);assert.deepEqual(both[0],['https://second.example']);assert.equal(calls.length,3);assert.deepEqual(await selector.plan(pool,headers),['https://second.example']);selector.report(pool[1],headers,false);assert.deepEqual(await selector.plan(pool,headers),pool);time=10001;recovered=true;assert.deepEqual(await selector.plan(pool,headers),pool);assert.equal(calls.length,5);
});
test('falls back to legacy health and still tries peers when both health endpoints are unavailable',async()=>{
 const calls=[];
 const selector=createApiSelector(async url=>{calls.push(url);return url.endsWith('/health')?Response.json({status:'ok'}):Response.json({error:'not found'},{status:404});});
 const pool=['https://first.example','https://second.example'];
 assert.deepEqual(await selector.plan(pool,new Headers()),pool);
 assert.equal(calls.filter(url=>url.endsWith('/api/health')).length,2);
 const failed=createApiSelector(async()=>Response.json({error:'blocked'},{status:403}));
 assert.deepEqual(await failed.plan(pool,new Headers()),pool,'gateway should still attempt the real API request');
});
