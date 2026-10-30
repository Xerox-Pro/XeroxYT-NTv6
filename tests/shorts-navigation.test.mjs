import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

test('shorts can leave for home, search, history, channel and browser back during exit; only native embed remains',async()=>{
 const temporary=await mkdtemp(path.resolve('node_modules/.shorts-navigation-'));
 const outfile=path.join(temporary,'viewer.mjs');
 await build({entryPoints:['src/components/ShortsViewer.tsx'],outfile,bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',plugins:[{name:'network-boundary',setup(builder){builder.onLoad({filter:/\/src\/utils\.ts$/},()=>({contents:'export const fetchJSON=async(url)=>{const r=await fetch(url);if(!r.ok)throw new Error("failed");return r.json()};export const formatNumberJP=n=>String(n);',loader:'js'}));}}]});
 const {default:Viewer}=await import(pathToFileURL(outfile));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/'});
 for(const key of ['window','document','HTMLElement','HTMLIFrameElement','Event','MouseEvent','localStorage']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const observers=[];
 globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;this.nodes=[];observers.push(this)} observe(node){this.nodes.push(node)} disconnect(){this.nodes=[]}};
 const video=(id,source)=>({videoId:id,title:`clip ${id}`,author:'channel',isShort:true,shortSource:source,viewCount:20,lengthSeconds:20,publishedText:'',videoThumbnails:[{url:'https://i.ytimg.com/frame.jpg'}]});
 const regular=[video('abcdefghijk','youtube'),video('lmnopqrstuv','youtube')];
 const ranking=[video('12345678901','ranking'),video('23456789012','ranking')];
 globalThis.fetch=async url=>{
  const address=String(url);
  if(address.startsWith('/api/shorts-ranking'))return new Response(JSON.stringify({videos:ranking,count:2,updatedAt:'today'}));
  if(address.startsWith('/api/shorts?'))return new Response(JSON.stringify({videos:regular,hasMore:false}));
  if(address.startsWith('/api/edu/'))return new Response(`https://www.youtubeeducation.com/embed/${address.split('/').pop()}?controls=0`);
  if(address.startsWith('/api/shorts/')){const id=address.split('/').pop().split('?')[0];return new Response(JSON.stringify({...video(id,'youtube'),aspectVerified:true,likeCount:10}));}
  throw new Error(`unexpected fetch ${address}`);
 };
 const settle=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});};
 function Harness(){
  const location=useLocation(),navigate=useNavigate();const [show,setShow]=useState(true);
  useEffect(()=>{if(!location.pathname.startsWith('/shorts')){const timer=setTimeout(()=>setShow(false),40);return()=>clearTimeout(timer)}},[location.pathname]);
  return React.createElement(React.Fragment,null,
   React.createElement('output',{'data-path':true},location.pathname),
   ...['/','/results','/feed/history','/channel/test','back'].map(target=>React.createElement('button',{key:target,'data-target':target,onClick:()=>navigate(target==='back'?-1:target)},target)),
   show&&React.createElement(Viewer,{initialId:'abcdefghijk',initialVideo:regular[0],context:{source:'home'},onRecord:()=>{},onSelectChannel:id=>navigate(`/channel/${id}`)}));
 }
 try{
  for(const target of ['/','/results','/feed/history','/channel/test','back']){
   const root=createRoot(document.getElementById('root'));
   await act(async()=>root.render(React.createElement(MemoryRouter,{initialEntries:['/','/shorts/abcdefghijk?source=home'],initialIndex:1},React.createElement(Harness))));
   await settle();await settle();
   const frame=document.querySelector('iframe');assert.ok(frame,'native iframe appears');
   assert.equal(new URL(frame.src).searchParams.get('controls'),'1');
   assert.equal(document.querySelector('.shorts-tap-area'),null);
   assert.equal(document.querySelector('.shorts-actions'),null);
   await act(async()=>document.querySelector(`[data-target="${target}"]`).click());
   // Simulate an IntersectionObserver notification queued before the exit animation.
   await act(async()=>{for(const observer of observers){const node=observer.nodes.at(-1);if(node)observer.callback([{target:node,isIntersecting:true,intersectionRatio:1}]);}});
   await settle();
   assert.equal(document.querySelector('[data-path]').textContent,target==='back'?'/':target,`navigation remains at ${target}`);
   await act(async()=>root.unmount());observers.length=0;
  }
 }finally{dom.window.close();await rm(temporary,{recursive:true,force:true});}
});
