import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchApiResponse} from '../server/lib/apiRequest.mjs';
test('waits for JSON body and catches a timeout before returning response headers',async()=>{
 let supplied;
 const fetcher=async(_url,{signal})=>{supplied=signal;return new Response(new ReadableStream({start(controller){signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true});}}),{headers:{'Content-Type':'application/json'}});};
 await assert.rejects(fetchApiResponse('https://api.example',{},15,fetcher),{name:'TimeoutError'});assert.equal(supplied.aborted,true);
});
test('JSON fully loads and media streams survive the connection deadline',async()=>{
 const response=await fetchApiResponse('https://api.example',{},15,async()=>Response.json({ok:true}));assert.deepEqual(await response.json(),{ok:true});
 let signal,streamController;
 const media=await fetchApiResponse('https://api.example',{},5,async(_url,options)=>{signal=options.signal;return new Response(new ReadableStream({start(c){streamController=c;}}),{headers:{'Content-Type':'video/mp4'}});});
 await new Promise(resolve=>setTimeout(resolve,15));assert.equal(signal.aborted,false);streamController.enqueue(new Uint8Array([1,2]));streamController.close();assert.equal((await media.arrayBuffer()).byteLength,2);
});
test('caller cancellation is retained while reading JSON',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(fetchApiResponse('https://api.example',{signal:controller.signal},100,async(_url,{signal})=>{signal.throwIfAborted();}),{name:'AbortError'});
});

test('bodyless responses preserve their status',async()=>{
 const response=await fetchApiResponse('https://api.example',{},15,async()=>new Response(null,{status:204,headers:{'content-type':'application/json'}}));assert.equal(response.status,204);assert.equal(response.body,null);
});
