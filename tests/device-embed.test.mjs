import test from 'node:test';import assert from 'node:assert/strict';
test('device builds the public embed, falls back without an API, and honors cancellation',async()=>{const original=globalThis.fetch;let good=false;const urls=[];globalThis.fetch=async(url,options)=>{urls.push(url);assert.equal(options.credentials,'omit');return good?Response.json({params:'?key=example&amp;rel=0'}):new Response('',{status:503});};try{const {getDeviceEmbedUrl}=await import('../src/lib/deviceEmbed.mjs?isolated');let url=new URL(await getDeviceEmbedUrl('abcdefghijk'));assert.equal(url.hostname,'www.youtube-nocookie.com');good=true;url=new URL(await getDeviceEmbedUrl('abcdefghijk'));assert.equal(url.searchParams.get('key'),'example');good=false;url=new URL(await getDeviceEmbedUrl('abcdefghijk'));assert.equal(url.hostname,'www.youtubeeducation.com');assert.equal(url.searchParams.get('key'),'example');assert.ok(urls.every(u=>u.startsWith('https://raw.githubusercontent.com/')));const controller=new AbortController();controller.abort();await assert.rejects(getDeviceEmbedUrl('abcdefghijk',controller.signal),{name:'AbortError'});}finally{globalThis.fetch=original;}});
test('parallel Shorts share config fetching, and cancelling one clip does not cancel others',async()=>{
 const original=globalThis.fetch;let calls=0;let finish;
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 try{
  const {getDeviceEmbedUrl}=await import('../src/lib/deviceEmbed.mjs?parallel');
  const controller=new AbortController();
  const cancelled=getDeviceEmbedUrl('abcdefghijk',controller.signal);
  const remaining=getDeviceEmbedUrl('lmnopqrstuv');
  controller.abort();
  await assert.rejects(cancelled,{name:'AbortError'});
  finish(Response.json({params:'?key=shared'}));
  assert.equal(new URL(await remaining).searchParams.get('key'),'shared');
  assert.equal(new URL(await getDeviceEmbedUrl('12345678901')).searchParams.get('key'),'shared');
  assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
