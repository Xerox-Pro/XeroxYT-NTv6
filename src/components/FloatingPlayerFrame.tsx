import {useEffect,useRef,useState,type ReactNode,type PointerEvent} from 'react';
import {GripHorizontal,Maximize2,RotateCcw,X} from 'lucide-react';
type Box={x:number;y:number;width:number;height:number};
const key='xerox_mini_player_layout_v1';
export function fitMiniPlayer(box:Box,viewportWidth:number,viewportHeight:number):Box{
 const maxW=Math.max(120,viewportWidth-16),maxH=Math.max(120,viewportHeight-96);
 const width=Math.min(maxW,Math.max(Math.min(220,maxW),box.width));
 const height=Math.min(maxH,Math.max(Math.min(190,maxH),box.height));
 return {width,height,x:Math.max(8,Math.min(viewportWidth-width-8,box.x)),y:Math.max(8,Math.min(viewportHeight-height-80,box.y))};
}
const initialBox=():Box=>{const w=window.innerWidth,h=window.innerHeight;let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}const valid=saved&&['x','y','width','height'].every(k=>Number.isFinite(saved[k]));return fitMiniPlayer(valid?saved:{x:w-376,y:h-340,width:360,height:278},w,h);};
export default function FloatingPlayerFrame({mini,children,onRestore,onClose}:{mini:boolean;children:ReactNode;onRestore:()=>void;onClose:()=>void}){
 const [box,setBox]=useState(initialBox);const boxRef=useRef(box);boxRef.current=box;
 const gesture=useRef<{mode:'move'|'resize';id:number;x:number;y:number;box:Box}|null>(null);
 const update=(next:Box,persist=false)=>{const fitted=fitMiniPlayer(next,window.innerWidth,window.innerHeight);boxRef.current=fitted;setBox(fitted);if(persist)try{localStorage.setItem(key,JSON.stringify(fitted));}catch{}};
 useEffect(()=>{const resize=()=>update(boxRef.current);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const start=(event:PointerEvent<HTMLElement>,mode:'move'|'resize')=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);gesture.current={mode,id:event.pointerId,x:event.clientX,y:event.clientY,box:boxRef.current};};
 const move=(event:PointerEvent<HTMLElement>)=>{const g=gesture.current;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;update(g.mode==='move'?{...g.box,x:g.box.x+dx,y:g.box.y+dy}:{...g.box,width:g.box.width+dx,height:g.box.height+dy});};
 const end=()=>{if(gesture.current){gesture.current=null;update(boxRef.current,true);}};
 const preset=(ratio:string)=>{if(!ratio)return;const [w,h]=ratio.split(':').map(Number);update({...boxRef.current,height:boxRef.current.width*h/w+76},true);};
 const keyboard=(event:React.KeyboardEvent,resize=false)=>{const d=event.shiftKey?20:5;const delta={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[event.key];if(!delta)return;event.preventDefault();const b=boxRef.current;update(resize?{...b,width:b.width+delta[0],height:b.height+delta[1]}:{...b,x:b.x+delta[0],y:b.y+delta[1]},true);};
 return <section aria-label={mini?'ミニプレイヤー':'動画プレイヤー'} className={mini?'persistent-mini-player floating-mini-player':'w-full'} style={mini?{left:box.x,top:box.y,width:box.width,height:box.height,right:'auto',bottom:'auto'}:undefined}>
  <div className="mini-player-toolbar" hidden={!mini}>
   <button type="button" className="mini-player-drag" aria-label="ミニプレイヤーを移動（矢印キーでも移動）" title="ドラッグして移動" onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>keyboard(e)}><GripHorizontal size={20}/></button>
   <button type="button" aria-label="動画ページに戻る" title="動画ページに戻る" onClick={onRestore}><Maximize2 size={17}/></button>
   <button type="button" aria-label="ミニプレイヤーを閉じて再生を終了" onClick={onClose}><X size={19}/></button>
  </div>
  <div className={mini?'mini-player-body':undefined}>{children}</div>
  <div className="mini-player-footer" hidden={!mini}>
   <label>比率<select aria-label="ミニプレイヤーの比率" value="" onChange={e=>preset(e.target.value)}><option value="">自由</option><option>16:9</option><option>4:3</option><option>1:1</option><option>9:16</option></select></label>
   <button type="button" aria-label="ミニプレイヤーの位置と大きさをリセット" title="位置と大きさをリセット" onClick={()=>{const w=window.innerWidth,h=window.innerHeight;update({x:w-376,y:h-358,width:360,height:278},true);}}><RotateCcw size={16}/></button>
   <button type="button" className="mini-player-resize" aria-label="ドラッグまたは矢印キーでサイズと縦横比を変更" title="ドラッグしてサイズ・縦横比を変更" onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>keyboard(e,true)}>◢</button>
  </div>
 </section>;
}
