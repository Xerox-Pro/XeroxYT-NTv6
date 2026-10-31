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
 for(const key of ['window','document','HTMLElement','HTMLIFrameElement','Event','MouseEvent','localStorage','sessionStorage']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const observers=[];
 globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;this.nodes=[];observers.push(this)} observe(node){this.nodes.push(node)} disconnect(){this.nodes=[]}};
 const video=(id,source)=>({videoId:id,title:`clip ${id}`,author:'channel',authorAvatar:'https://yt3.ggpht.com/avatar.jpg',isShort:true,shortSource:source,viewCount:20,lengthSeconds:20,publishedText:'',videoThumbnails:[{url:'https://i.ytimg.com/frame.jpg'}]});
 const regular=[video('abcdefghijk','youtube'),video('lmnopqrstuv','youtube')];
 const ranking=[video('12345678901','ranking'),video('23456789012','ranking')];
 globalThis.fetch=async url=>{
  const address=String(url);
  if(address.startsWith('https://shorts-ranking.com/latest.json?'))return new Response(JSON.stringify({items:ranking.map(v=>({video_id:v.videoId,title:v.title,channel_title:v.author,views:v.viewCount})),updated_at:'today'}));
  if(address.startsWith('/api/channel/'))return new Response(JSON.stringify({videos:[ranking[0],...regular],hasMore:false}));
  if(address.startsWith('/api/shorts?'))return new Response(JSON.stringify({videos:regular,hasMore:false}));
  if(address.startsWith('/api/edu/'))return new Response(`https://www.youtubeeducation.com/embed/${address.split('/').pop()}?controls=0`);
  if(address.includes('/comments'))return new Response(JSON.stringify({comments:[],hasMore:false}));
  if(address.startsWith('/api/shorts/')){const id=address.split('/').pop().split('?')[0];return new Response(JSON.stringify({...video(id,'youtube'),aspectVerified:true,likeCount:10,description:'概要テスト'}));}
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
   for(const embed of document.querySelectorAll('.shorts-iframe')) {
     const url = new URL(embed.src);
     assert.equal(url.searchParams.get('loop'), '1');
     assert.equal(url.searchParams.get('playlist'), url.pathname.split('/').pop());
   }
   assert.equal(document.querySelector('.shorts-tap-area'),null);
   assert.equal(document.querySelector('.shorts-actions'),null);
   const frames=[...document.querySelectorAll('iframe')];assert.equal(frames.length,3,'active and next two embeds are prepared');
   for(const next of frames.slice(1))assert.equal(new URL(next.src).searchParams.get('autoplay'),'0','preloaded videos do not autoplay');
   assert.ok(document.querySelector('[aria-label="コメントを表示"]'));assert.ok(document.querySelector('[aria-label="概要欄を表示"]'));
   assert.ok(document.querySelector('[aria-label="高評価（この端末に保存）"]'));
   assert.ok(document.querySelector('.shorts-frame .shorts-overlay-title'), 'title is layered inside video frame');
   assert.ok(document.querySelector('.shorts-frame .shorts-channel img'), 'channel avatar is layered inside video frame');
   await act(async()=>document.querySelector('[aria-label="概要欄を表示"]').click());
   assert.ok(document.querySelector('.shorts-description').textContent.includes('概要テスト'));
   await act(async()=>document.querySelector('[aria-label="パネルを閉じる"]').click());
   await act(async()=>document.querySelector(`[data-target="${target}"]`).click());
   // Simulate an IntersectionObserver notification queued before the exit animation.
   await act(async()=>{for(const observer of observers){const node=observer.nodes.at(-1);if(node)observer.callback([{target:node,isIntersecting:true,intersectionRatio:1}]);}});
   await settle();
   assert.equal(document.querySelector('[data-path]').textContent,target==='back'?'/':target,`navigation remains at ${target}`);
   await act(async()=>root.unmount());observers.length=0;
  }
  sessionStorage.setItem('xerox_channel_shorts_test',JSON.stringify({videos:[ranking[0],...regular],page:1,hasMore:false}));
  const channelRoot=createRoot(document.getElementById('root'));
  await act(async()=>channelRoot.render(React.createElement(MemoryRouter,{initialEntries:['/shorts/abcdefghijk?source=channel&channelId=test']},React.createElement(Viewer,{initialId:'abcdefghijk',initialVideo:regular[0],context:{source:'channel',channelId:'test'},onRecord:()=>{},onSelectChannel:()=>{}}))));
  await settle();await settle();
  assert.deepEqual([...document.querySelectorAll('article[data-short-id]')].map(n=>n.dataset.shortId),['12345678901','abcdefghijk','lmnopqrstuv'],'channel feed runs newest to oldest in posting order');
  assert.equal(document.querySelector('.shorts-feed-source a'),null,'channel mode does not mix ranking');
  assert.equal(document.querySelector('.shorts-feed-end'),null,'no scrollable tail after newest channel clip');
  let boundaryMoves=0;
  dom.window.HTMLElement.prototype.scrollIntoView=function(){boundaryMoves++;};
  await act(async()=>{for(const observer of observers){const newest=observer.nodes.find(n=>n.dataset.shortId==='12345678901');if(newest)observer.callback([{target:newest,isIntersecting:true,intersectionRatio:1}]);}});
  await act(async()=>window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})));
  assert.equal(boundaryMoves,0,'moving beyond newest clip neither wraps nor scrolls');
  let targetId='';
  dom.window.HTMLElement.prototype.scrollIntoView=function(){targetId=this.dataset.shortId;};
  await act(async()=>window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
  assert.equal(targetId,'abcdefghijk','down from newest selects the next older upload');


  await act(async()=>channelRoot.unmount());
 }finally{dom.window.close();await rm(temporary,{recursive:true,force:true});}
});
