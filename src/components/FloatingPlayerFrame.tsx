import {useEffect,useRef,useState,type ReactNode,type PointerEvent,type KeyboardEvent} from 'react';
import {Pause,Play,X,Maximize2,PictureInPicture2} from 'lucide-react';
type Box={x:number;y:number;width:number;height:number};
type Point={x:number;y:number};
const key='xerox_mini_player_layout_v2';
const ASPECT=16/9;
export function fitMiniPlayer(box:Box,viewportWidth:number,viewportHeight:number):Box{
 const maxW=Math.max(80,viewportWidth-16),maxH=Math.max(60,viewportHeight-96);
 // Keep the viewport-sized wrapper at the same ratio as normal YouTube videos.
 // The iframe itself cannot reveal the intrinsic ratio of cross-origin content.
 const limit=Math.min(maxW,maxH*ASPECT);
 const width=Math.min(limit,Math.max(Math.min(144,limit),box.width));
 const height=width/ASPECT;
 return {width,height,x:Math.max(8,Math.min(viewportWidth-width-8,box.x)),y:Math.max(8,Math.min(viewportHeight-height-80,box.y))};
}
const initialBox=():Box=>{const w=window.innerWidth,h=window.innerHeight;let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}const valid=saved&&['x','y','width','height'].every(k=>Number.isFinite(saved[k]));const width=Math.min(w*.45,280);return fitMiniPlayer(valid?saved:{x:w-width-12,y:h-width*9/16-92,width,height:width*9/16},w,h);};
export default function FloatingPlayerFrame({mini,children,onRestore,onClose}:{mini:boolean;children:ReactNode;onRestore:()=>void;onClose:()=>void}){
 const [box,setBox]=useState(initialBox);const boxRef=useRef(box);boxRef.current=box;
 const [playing,setPlaying]=useState(true);
 const [pipError,setPipError]=useState('');
 const pipWindow=useRef<Window|null>(null);
 const pipSource=useRef<HTMLIFrameElement|null>(null);
 const sectionRef=useRef<HTMLElement>(null);
 const points=useRef(new Map<number,Point>());
 const gesture=useRef<{mode:'move'|'resize'|'pinch';box:Box;point:Point;distance:number}|null>(null);
 const lastTap=useRef(0);const moved=useRef(false);
 const update=(next:Box,persist=false)=>{const fitted=fitMiniPlayer(next,window.innerWidth,window.innerHeight);boxRef.current=fitted;setBox(fitted);if(persist)try{localStorage.setItem(key,JSON.stringify(fitted));}catch{}};
 useEffect(()=>{const resize=()=>update(boxRef.current);const state=(e:Event)=>setPlaying(Boolean((e as CustomEvent).detail));window.addEventListener('resize',resize);window.addEventListener('xerox-mini-play-state',state);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('xerox-mini-play-state',state);};},[]);
 useEffect(()=>{if(!mini){points.current.clear();gesture.current=null;pipWindow.current?.close();}},[mini]);
 useEffect(()=>()=>{pipWindow.current?.close();},[]);
 const openPip=async()=>{
  setPipError('');
  const api=(window as Window & {documentPictureInPicture?:{requestWindow(options:{width:number;height:number}):Promise<Window>}}).documentPictureInPicture;
  if(!api){setPipError('このブラウザは別ウィンドウPiPに対応していません。');return;}
  const source=sectionRef.current?.querySelector<HTMLIFrameElement>('.mini-player-body iframe');
  if(!source?.src){setPipError('再生中の動画が見つかりません。');return;}
  try{
   // Document PiP permits a cross-origin iframe, unlike the video-only PiP API.
   const pip=await api.requestWindow({width:Math.round(boxRef.current.width),height:Math.round(boxRef.current.height)});
   pipWindow.current=pip;pipSource.current=source;
   pip.document.body.style.cssText='margin:0;background:#000;overflow:hidden';
   const frame=pip.document.createElement('iframe');
   frame.title='XeroxYT PiP';frame.src=source.src;frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';
   frame.style.cssText='display:block;border:0;width:100vw;height:100vh';
   pip.document.body.append(frame);
   source.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}),new URL(source.src).origin);
   pip.addEventListener('pagehide',()=>{
    pipWindow.current=null;
    if(pipSource.current===source&&source.isConnected){source.contentWindow?.postMessage(JSON.stringify({event:'command',func:'playVideo',args:[]}),new URL(source.src).origin);}
    pipSource.current=null;
   },{once:true});
  }catch{setPipError('PiPを開けませんでした。ブラウザの許可や対応状況を確認してください。');}
 };
 const rebase=(mode:'move'|'resize'|'pinch')=>{const p=[...points.current.values()];if(!p.length){gesture.current=null;return;}gesture.current={mode,box:boxRef.current,point:p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p[0],distance:p.length>1?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0};};
 const start=(e:PointerEvent<HTMLElement>,mode:'move'|'resize')=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.current.size===1)moved.current=false;if(points.current.size>1){moved.current=true;rebase('pinch');}else rebase(mode);};
 const move=(e:PointerEvent<HTMLElement>)=>{if(!points.current.has(e.pointerId))return;points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gesture.current;if(!g)return;const p=[...points.current.values()];if(g.mode==='pinch'&&p.length>1){const midpoint={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};const scale=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/Math.max(1,g.distance);const width=g.box.width*scale;const height=width/ASPECT;update({...g.box,width,height,x:g.box.x+(g.box.width-width)/2+midpoint.x-g.point.x,y:g.box.y+(g.box.height-height)/2+midpoint.y-g.point.y});return;}const dx=p[0].x-g.point.x,dy=p[0].y-g.point.y;if(Math.hypot(dx,dy)>4)moved.current=true;update(g.mode==='resize'?{...g.box,width:g.box.width+Math.max(dx,dy*ASPECT),height:(g.box.width+Math.max(dx,dy*ASPECT))/ASPECT}:{...g.box,x:g.box.x+dx,y:g.box.y+dy});};
 const end=(e:PointerEvent<HTMLElement>)=>{if(!points.current.delete(e.pointerId))return;if(points.current.size){rebase('move');return;}const isTap=!moved.current&&gesture.current?.mode==='move'&&e.type==='pointerup';gesture.current=null;update(boxRef.current,true);if(isTap){const now=Date.now();if(now-lastTap.current<320){lastTap.current=0;onRestore();}else lastTap.current=now;}};
 const keyboard=(event:KeyboardEvent,resize=false)=>{const d=event.shiftKey?20:5;const delta={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[event.key];if(!delta)return;event.preventDefault();const b=boxRef.current;update(resize?{...b,width:b.width+delta[0]+delta[1]*ASPECT}:{...b,x:b.x+delta[0],y:b.y+delta[1]},true);};
 return <section ref={sectionRef} aria-label={mini?'ミニプレイヤー':'動画プレイヤー'} className={mini?'persistent-mini-player floating-mini-player':'w-full'} style={mini?{left:box.x,top:box.y,width:box.width,height:box.height,right:'auto',bottom:'auto'}:undefined}>
  <div className={mini?'mini-player-body':undefined}>{children}</div>
  {mini&&<>
   <div className="mini-player-gesture" role="button" tabIndex={0} aria-label="ドラッグで移動、2本指で拡大縮小、ダブルタップで動画に戻る" onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>{if(e.key==='Enter'){onRestore();return;}keyboard(e);}}/>
   <div className="mini-player-overlay-controls">
    <button type="button" className="mini-player-pause" aria-label={playing?'一時停止':'再生'} onClick={()=>window.dispatchEvent(new CustomEvent('xerox-mini-toggle-play'))}>{playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button>
    <button type="button" aria-label="別ウィンドウPiPを開く" title="対応ブラウザでは画面外でも動画を表示" onClick={openPip}><PictureInPicture2 size={19}/></button>
    <button type="button" className="mini-player-restore" aria-label="動画ページに戻る" onClick={onRestore}><Maximize2 size={17}/></button>
    <button type="button" aria-label="ミニプレイヤーを閉じて再生を終了" onClick={onClose}><X size={22}/></button>
   </div>
   <button type="button" className="mini-player-resize" aria-label="角をドラッグして16対9のままサイズ変更" title="16対9のままサイズ変更" onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>keyboard(e,true)}><span/></button>
   {pipError&&<p role="status" className="absolute z-[5] left-1.5 right-1.5 bottom-1.5 m-0 rounded-md bg-neutral-900/95 p-2 text-[11px] leading-snug text-white pointer-events-none">{pipError}</p>}
  </>}
 </section>;
}
