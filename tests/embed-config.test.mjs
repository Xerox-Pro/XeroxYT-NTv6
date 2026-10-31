import test from 'node:test';
import assert from 'node:assert/strict';
import { handleEmbed, parseEmbedParams } from '../cloudflare/auth/embed.mjs';
import worker from '../cloudflare/auth/worker.mjs';

test('embed configuration reuses edge cache without storing credentials or user responses',async()=>{
  const data=new Map();let calls=0;
  const cache={match:async key=>data.get(key.url)?.clone(),put:async(key,response)=>{assert.equal(key.headers.get('cookie'),null);data.set(key.url,response.clone());}};
  const fetchUpstream=async()=>{calls++;return new Response(JSON.stringify({params:'?rel=0&amp;autoplay=1'}));};
  for(const id of ['abcdefghijk','lmnopqrstuv']) {
    const response=await handleEmbed(new Request('https://worker.test/api/account/embed/'+id,{headers:{cookie:'secret'}}),id,{cache,fetchUpstream});
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.equal(response.headers.get('CDN-Cache-Control'),'no-store');
    assert.equal(await response.text(),`https://www.youtubeeducation.com/embed/${id}?rel=0&autoplay=1`);
  }
  assert.equal(calls,1);
});
test('embed rejects invalid IDs and keeps playback fallback on bounded upstream failure',async()=>{
  assert.equal((await handleEmbed(new Request('https://worker.test/'),'bad')).status,400);
  const response=await handleEmbed(new Request('https://worker.test/'),'abcdefghijk',{fetchUpstream:async()=>new Response('x'.repeat(20000))});
  assert.equal(await response.text(),'https://www.youtubeeducation.com/embed/abcdefghijk?rel=0&autoplay=1');
  assert.equal(new URL('https://www.youtubeeducation.com/embed/abcdefghijk?'+parseEmbedParams('https://evil.example/?x=1')).hostname,'www.youtubeeducation.com');
});
test('embed route always checks revocable D1 session, including a warm config cache',async()=>{
  let valid=true,queries=0;
  const DB={prepare:()=>({bind:()=>({first:async()=>{queries++;return valid?{id:'user',username:'test'}:null;}})})};
  const priorFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('?rel=0');
  try {
    const request=()=>new Request('https://worker.test/api/account/embed/abcdefghijk',{headers:{cookie:'__Host-xy_session='+'a'.repeat(64)}});
    assert.equal((await worker.fetch(request(),{DB})).status,200);
    valid=false;assert.equal((await worker.fetch(request(),{DB})).status,401);assert.equal(queries,2);
    assert.equal((await worker.fetch(new Request('https://worker.test/api/account/embed/abcdefghijk'),{DB})).status,401);
  } finally {globalThis.fetch=priorFetch;}
});
