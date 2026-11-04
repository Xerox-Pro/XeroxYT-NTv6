import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
test('gateway fails over body errors before responding, and never replays writes',async()=>{
 const folder=await mkdtemp(path.resolve('node_modules/.gateway-test-')),out=path.join(folder,'api.mjs');const oldFetch=globalThis.fetch,keys=Object.keys(process.env).filter(k=>/^API_BASE_URL(?:_\d+)?$/.test(k)),saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];process.env.API_BASE_URL_1='https://first.example';process.env.API_BASE_URL_2='https://second.example';let mutation=false;const calls=[];
 globalThis.fetch=async(url,options)=>{if(url.endsWith('/health'))return Response.json({status:'ok'});calls.push({url,method:options.method});if(mutation||url.startsWith('https://first.example'))return new Response(new ReadableStream({start(c){c.error(new DOMException('timed out while reading','TimeoutError'));}}),{headers:{'content-type':'application/json'}});return Response.json({videos:[{videoId:'test'}]});};
 try{await build({entryPoints:['api/[...path].ts'],outfile:out,bundle:true,platform:'node',format:'esm'});const handler=(await import(pathToFileURL(out))).default;let response=await handler(new Request('https://site.example/api/search?q=test'));assert.equal(response.status,200);assert.equal(response.headers.get('X-XeroxYT-API-Index'),'2');assert.equal((await response.json()).videos.length,1);assert.equal(calls.length,2);
 mutation=true;calls.length=0;response=await handler(new Request('https://site.example/api/channels/batch',{method:'POST',body:'{}'}));assert.equal(response.status,502);assert.equal(calls.length,1);
 }finally{globalThis.fetch=oldFetch;for(const k of Object.keys(process.env).filter(k=>/^API_BASE_URL(?:_\d+)?$/.test(k)))delete process.env[k];Object.assign(process.env,saved);await rm(folder,{recursive:true,force:true});}
});
test('gateway retries an old Worker video 404 on the Vercel backup',async()=>{
 const folder=await mkdtemp(path.resolve('node_modules/.gateway-test-'));
 const outfile=path.join(folder,'api.mjs'), originalFetch=globalThis.fetch;
 const saved=Object.fromEntries(Object.keys(process.env).filter(k=>/^API_BASE_URL(?:_\d+)?$/.test(k)).map(k=>[k,process.env[k]]));
 for(const key of Object.keys(saved))delete process.env[key];
 process.env.API_BASE_URL_1='https://worker.example';process.env.API_BASE_URL_2='https://vercel.example';
 const seen=[];
 globalThis.fetch=async url=>{
  if(String(url).endsWith('/health'))return Response.json({ok:true});
  seen.push(String(url));
  if(String(url).startsWith('https://worker.example'))return Response.json({error:'Video not found'},{status:404});
  return Response.json({videoId:'abcdefghijk',title:'Recovered video'});
 };
 try{
  await build({entryPoints:['api/[...path].ts'],outfile,bundle:true,platform:'node',format:'esm'});
  const handler=(await import(pathToFileURL(outfile))).default;
  const response=await handler(new Request('https://site.example/api/video/abcdefghijk'));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-XeroxYT-API-Index'),'2');
  assert.equal((await response.json()).title,'Recovered video');
  assert.equal(seen.length,2);
 }finally{
  globalThis.fetch=originalFetch;
  for(const key of Object.keys(process.env).filter(k=>/^API_BASE_URL(?:_\d+)?$/.test(k)))delete process.env[key];
  Object.assign(process.env,saved);
  await rm(folder,{recursive:true,force:true});
 }
});
