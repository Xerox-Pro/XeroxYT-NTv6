import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
test('device profile stays account-local and description opens without removing the player',async()=>{
 const folder=await mkdtemp(path.resolve('node_modules/.profile-ui-'));const outfile=path.join(folder,'ui.mjs');
 await build({stdin:{contents:"export {default as MyPage} from './src/components/MyPage'; export {default as Description} from './src/components/VideoDescriptionSheet'; export {AccountContext} from './src/components/AccountGate'; export {useDeviceProfile} from './src/lib/deviceProfile';",resolveDir:process.cwd(),loader:'ts'},outfile,bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic'});
 const ui=await import(pathToFileURL(outfile));const dom=new JSDOM('<div id="root"></div>',{url:'https://preview.example'});const originals=new Map();for(const key of ['window','document','HTMLElement','HTMLDialogElement','Event','MouseEvent','localStorage','sessionStorage']){originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});}
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let profile;function Probe(){profile=ui.useDeviceProfile();return null;}
 const root=createRoot(document.getElementById('root'));const props={playlists:[],history:[],onCreatePlaylist:()=>'',onDeletePlaylist:()=>{},onRemoveVideoFromPlaylist:()=>{},onReorderPlaylistVideo:()=>{},onStartPlaylistPlay:()=>{},onVideoSelect:()=>{},onNavigateToHistory:()=>{}};
 async function render(username){await act(async()=>root.render(React.createElement(MemoryRouter,null,React.createElement(ui.AccountContext.Provider,{value:{username,logout:async()=>{}}},React.createElement(React.Fragment,null,React.createElement(Probe),React.createElement(ui.MyPage,props,React.createElement('p',null,'playlist editor')))))));}
 try{await render('account_a');await act(async()=>profile.save({name:'この端末の名前',avatar:''}));assert.equal(document.querySelector('.my-profile h1').textContent,'この端末の名前');assert.ok(document.querySelector('.my-section').textContent.includes('履歴'));await render('account_b');assert.equal(document.querySelector('.my-profile h1').textContent,'account_b');await render('account_a');assert.equal(profile.name,'この端末の名前');
 let closed=false;const video={videoId:'abcdefghijk',title:'動画タイトル',author:'channel',authorAvatar:'https://example.com/avatar.png',viewCount:100,likeCount:5,publishedText:'2026/11/02',description:'説明 https://example.com/details',videoThumbnails:[],lengthSeconds:10};
 await act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement('iframe',{title:'動画プレイヤー',src:'about:blank'}),React.createElement(ui.Description,{video,onClose:()=>{closed=true;},onSelectChannel:()=>{}}))));assert.ok(document.querySelector('dialog[open]'));assert.ok(document.querySelector('iframe[title="動画プレイヤー"]'));assert.equal(document.querySelector('.description-full-text a').getAttribute('href'),'https://example.com/details');await act(async()=>document.querySelector('[aria-label="概要欄を閉じる"]').click());assert.equal(closed,true);
 }finally{await act(async()=>root.unmount());for(const [key,value]of originals){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}delete globalThis.IS_REACT_ACT_ENVIRONMENT;dom.window.close();await rm(folder,{recursive:true,force:true});}
});
