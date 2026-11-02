import {useEffect,useRef,useState,type ReactNode,type PointerEvent,type KeyboardEvent} from 'react';
import {Pause,Play,X,Maximize2} from 'lucide-react';
type Box={x:number;y:number;width:number;height:number};
type Point={x:number;y:number};
const key='xerox_mini_player_layout_v2';
export function fitMiniPlayer(box:Box,viewportWidth:number,viewportHeight:number):Box{
 const maxW=Math.max(80,viewportWidth-16),maxH=Math.max(60,viewportHeight-96);
 const width=Math.min(maxW,Math.max(Math.min(144,maxW),box.width));
 const height=Math.min(maxH,Math.max(Math.min(81,maxH),box.height));
 return {width,height,x:Math.max(8,Math.min(viewportWidth-width-8,box.x)),y:Math.max(8,Math.min(viewportHeight-height-80,box.y))};
}
const initialBox=():Box=>{const w=window.innerWidth,h=window.innerHeight;let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}const valid=saved&&['x','y','width','height'].every(k=>Number.isFinite(saved[k]));const width=Math.min(w*.45,280);return fitMiniPlayer(valid?saved:{x:w-width-12,y:h-width*9/16-92,width,height:width*9/16},w,h);};
export default function FloatingPlayerFrame({mini,children,onRestore,onClose}:{mini:boolean;children:ReactNode;onRestore:()=>void;onClose:()=>void}){
 const [box,setBox]=useState(initialBox);const boxRef=useRef(box);boxRef.current=box;
 const [playing,setPlaying]=useState(true);
 const points=useRef(new Map<number,Point>());
 const gesture=useRef<{mode:'move'|'resize'|'pinch';box:Box;point:Point;distance:number}|null>(null);
 const lastTap=useRef(0);const moved=useRef(false);
 const update=(next:Box,persist=false)=>{const fitted=fitMiniPlayer(next,window.innerWidth,window.innerHeight);boxRef.current=fitted;setBox(fitted);if(persist)try{localStorage.setItem(key,JSON.stringify(fitted));}catch{}};
 useEffect(()=>{const resize=()=>update(boxRef.current);const state=(e:Event)=>setPlaying(Boolean((e as CustomEvent).detail));window.addEventListener('resize',resize);window.addEventListener('xerox-mini-play-state',state);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('xerox-mini-play-state',state);};},[]);
 useEffect(()=>{if(!mini){points.current.clear();gesture.current=null;}},[mini]);
 const rebase=(mode:'move'|'resize'|'pinch')=>{const p=[...points.current.values()];if(!p.length){gesture.current=null;return;}gesture.current={mode,box:boxRef.current,point:p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p[0],distance:p.length>1?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0};};
 const start=(e:PointerEvent<HTMLElement>,mode:'move'|'resize')=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.current.size===1)moved.current=false;if(points.current.size>1){moved.current=true;rebase('pinch');}else rebase(mode);};
 const move=(e:PointerEvent<HTMLElement>)=>{if(!points.current.has(e.pointerId))return;points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gesture.current;if(!g)return;const p=[...points.current.values()];if(g.mode==='pinch'&&p.length>1){const midpoint={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};const scale=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/Math.max(1,g.distance);const width=Math.max(144,Math.min(window.innerWidth-16,g.box.width*scale));const height=width*g.box.height/g.box.width;update({...g.box,width,height,x:g.box.x+(g.box.width-width)/2+midpoint.x-g.point.x,y:g.box.y+(g.box.height-height)/2+midpoint.y-g.point.y});return;}const dx=p[0].x-g.point.x,dy=p[0].y-g.point.y;if(Math.hypot(dx,dy)>4)moved.current=true;update(g.mode==='resize'?{...g.box,width:g.box.width+dx,height:g.box.height+dy}:{...g.box,x:g.box.x+dx,y:g.box.y+dy});};
 const end=(e:PointerEvent<HTMLElement>)=>{if(!points.current.delete(e.pointerId))return;if(points.current.size){rebase('move');return;}const isTap=!moved.current&&gesture.current?.mode==='move'&&e.type==='pointerup';gesture.current=null;update(boxRef.current,true);if(isTap){const now=Date.now();if(now-lastTap.current<320){lastTap.current=0;onRestore();}else lastTap.current=now;}};
 const keyboard=(event:KeyboardEvent,resize=false)=>{const d=event.shiftKey?20:5;const delta={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[event.key];if(!delta)return;event.preventDefault();const b=boxRef.current;update(resize?{...b,width:b.width+delta[0],height:b.height+delta[1]}:{...b,x:b.x+delta[0],y:b.y+delta[1]},true);};
 return <section aria-label={mini?'ミニプレイヤー':'動画プレイヤー'} className={mini?'persistent-mini-player floating-mini-player':'w-full'} style={mini?{left:box.x,top:box.y,width:box.width,height:box.height,right:'auto',bottom:'auto'}:undefined}>
  <div className={mini?'mini-player-body':undefined}>{children}</div>
  {mini&&<>
   <div className="mini-player-gesture" role="button" tabIndex={0} aria-label="ドラッグで移動、2本指で拡大縮小、ダブルタップで動画に戻る" onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>{if(e.key==='Enter'){onRestore();return;}keyboard(e);}}/>
   <div className="mini-player-overlay-controls">
    <button type="button" className="mini-player-pause" aria-label={playing?'一時停止':'再生'} onClick={()=>window.dispatchEvent(new CustomEvent('xerox-mini-toggle-play'))}>{playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button>
    <button type="button" className="mini-player-restore" aria-label="動画ページに戻る" onClick={onRestore}><Maximize2 size={17}/></button>
    <button type="button" aria-label="ミニプレイヤーを閉じて再生を終了" onClick={onClose}><X size={22}/></button>
   </div>
   <button type="button" className="mini-player-resize" aria-label="角をドラッグしてサイズと縦横比を変更" title="ドラッグして縦横比を変更" onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>keyboard(e,true)}><span/></button>
  </>}
 </section>;
}
