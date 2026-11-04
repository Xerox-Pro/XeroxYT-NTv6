import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {JSDOM} from 'jsdom';

test('a failed Shorts feed has a reachable retry button and recovers without reload',async()=>{
 const folder=await mkdtemp(path.resolve('node_modules/.shorts-retry-'));
 const output=path.join(folder,'viewer.mjs');
 await build({entryPoints:['src/components/ShortsViewer.tsx'],outfile:output,bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',plugins:[{name:'network-boundary',setup(builder){builder.onLoad({filter:/\/src\/utils\.ts$/},()=>({contents:'export const fetchJSON=async(url,options)=>{const response=await fetch(url,options);if(!response.ok){const error=new Error("upstream failed");error.status=response.status;throw error;}return response.json()};export const formatNumberJP=n=>String(n);',loader:'js'}));}}]});
 const {default:ShortsViewer}=await import(pathToFileURL(output));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/shorts'});
 const properties=['window','document','HTMLElement','HTMLIFrameElement','Event','MouseEvent','localStorage','sessionStorage','IntersectionObserver'];
 const old=new Map(properties.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of properties.slice(0,-1))Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
 globalThis.IntersectionObserver=class{observe(){}disconnect(){}};
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let requests=0;
 const previousFetch=globalThis.fetch;
 const video={videoId:'abcdefghijk',title:'retry video',author:'channel',viewCount:0,isShort:true,lengthSeconds:15,publishedText:'',videoThumbnails:[]};
 globalThis.fetch=async url=>{
  const value=String(url);
  if(value.startsWith('/api/shorts?')){
   requests++;
   return requests<=2 ? Response.json({error:'offline'},{status:503}) : Response.json({videos:[video],hasMore:false});
  }
  if(value.startsWith('/api/shorts/'))return Response.json(video);
  if(value.startsWith('https://raw.githubusercontent.com/'))return Response.json({params:'?key=abc'});
  throw new Error('Unexpected request '+value);
 };
 const root=createRoot(dom.window.document.getElementById('root'));
 const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 try{
  await act(async()=>root.render(React.createElement(MemoryRouter,{initialEntries:['/shorts?source=search&q=test']},React.createElement(ShortsViewer,{context:{source:'search',q:'test'},onRecord:()=>{},onSelectChannel:()=>{}}))));
  await settle();await settle();await act(async()=>{await new Promise(resolve=>setTimeout(resolve,480));});await settle();
  assert.equal(requests,2,'transient errors get one automatic retry');
  const button=document.querySelector('[role="alert"] button');
  assert.ok(button,'manual retry remains available');
  assert.equal(document.querySelector('.shorts-scroll').contains(button),false,'retry is outside scroll-snap area');
  await act(async()=>button.click());
  await settle();await settle();
  assert.equal(requests,3);
  assert.equal(document.querySelector('[role="alert"]'),null);
  assert.equal(document.querySelectorAll('article[data-short-id]').length,1);
 }finally{
  await act(async()=>root.unmount());globalThis.fetch=previousFetch;dom.window.close();
  for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  await rm(folder,{recursive:true,force:true});
 }
});
