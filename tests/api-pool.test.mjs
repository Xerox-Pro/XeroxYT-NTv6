import test from 'node:test';
import assert from 'node:assert/strict';
import {apiPool,canRetry} from '../server/lib/apiPool.mjs';
test('numbered API origins support gaps and arbitrarily large suffixes, sort and deduplicate',()=>{
 assert.deepEqual(apiPool({API_BASE_URL_100000:'https://render.example',API_BASE_URL_2:'https://vercel.example',API_BASE_URL_1:'https://worker.example',API_BASE_URL:'https://worker.example',NOT_API:'https://bad.example'}),['https://worker.example','https://vercel.example','https://render.example']);
 assert.throws(()=>apiPool({API_BASE_URL_1:'https://user:password@host.example'}));
 assert.throws(()=>apiPool({API_BASE_URL_1:'http://host.example'}));
});
test('failover retries only read-only data failures, never account writes or authentication',()=>{
 assert.equal(canRetry('GET','/api/search',503),true);
 assert.equal(canRetry('POST','/api/account/register',503),false);
 assert.equal(canRetry('GET','/api/auth/signin',503),false);
 assert.equal(canRetry('GET','/api/search',401),false);
 assert.equal(canRetry('GET','/api/video/abcdefghijk',404),true,'temporary failures on the old Worker must reach backup API');
 assert.equal(canRetry('GET','/api/video/abcdefghijk/comments',404),false);
 assert.equal(canRetry('GET','/api/search',404),false);
});
test('automatic transport falls back after direct authentication failure and remembers proxy mode',async()=>{
 const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage,originalWindow=globalThis.window;
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};globalThis.window=new EventTarget();const calls=[];
 globalThis.fetch=async(url)=>{calls.push(url);if(url==='/api/transport-config')return Response.json({origins:['https://worker.example']});if(String(url).startsWith('https://worker.example'))return Response.json({error:'login'},{status:401});return Response.json({videos:[{videoId:'abc'}]});};
 try{const transport=await import('../src/lib/apiTransport.mjs?test');const first=await transport.apiFetch('/api/search?q=x');assert.equal(first.status,200);assert.equal(transport.readTransportState().automatic,true);await transport.apiFetch('/api/video/abcdefghijk');assert.deepEqual(calls,['/api/transport-config','https://worker.example/api/search?q=x','/api/search?q=x','/api/video/abcdefghijk']);transport.setTransportMode('direct');await assert.rejects(transport.apiFetch('/api/search?q=x'),/直接接続できません/);}
 finally{globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage;globalThis.window=originalWindow;}
});
test('protected APIs go through the Vercel gateway without browser-side 403 probes',async()=>{
 const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage,originalWindow=globalThis.window;
 const values=new Map(),calls=[];
 globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 globalThis.window=new EventTarget();
 globalThis.fetch=async url=>{calls.push(String(url));if(url==='/api/transport-config')return Response.json({origins:['https://protected.example'],preferProxy:true});if(url==='/api/video/abcdefghijk')return Response.json({videoId:'abcdefghijk'});throw Error('Unexpected direct request');};
 try{const transport=await import('../src/lib/apiTransport.mjs?protected');const response=await transport.apiFetch('/api/video/abcdefghijk');assert.equal(response.status,200);assert.deepEqual(calls,['/api/transport-config','/api/video/abcdefghijk']);}
 finally{globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage;globalThis.window=originalWindow;}
});
