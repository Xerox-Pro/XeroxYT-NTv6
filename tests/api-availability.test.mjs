import test from 'node:test';import assert from 'node:assert/strict';import {createApiSelector} from '../server/lib/apiAvailability.mjs';
test('skips failed peers, shares health probes, and retries recovered peers after cooldown',async()=>{
 let time=0,recovered=false;const calls=[];const headers=new Headers({Origin:'https://site.example',Authorization:'Bearer test',Cookie:'private'});
 const selector=createApiSelector(async(url,options)=>{calls.push(url);assert.equal(options.headers.has('cookie'),false);return url.includes('first')&&!recovered?Response.json({error:'down'},{status:503}):Response.json({status:'ok'});},()=>time);
 const pool=['https://first.example','https://second.example'];const both=await Promise.all([selector.plan(pool,headers),selector.plan(pool,headers)]);assert.deepEqual(both[0],['https://second.example']);assert.equal(calls.length,2);assert.deepEqual(await selector.plan(pool,headers),['https://second.example']);selector.report(pool[1],headers,false);assert.deepEqual(await selector.plan(pool,headers),[]);time=10001;recovered=true;assert.deepEqual(await selector.plan(pool,headers),pool);assert.equal(calls.length,4);
});
