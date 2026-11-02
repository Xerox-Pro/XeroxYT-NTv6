import {useSyncExternalStore} from 'react';
const key='xerox_player_muted_v1',event='xerox-audio-preference';
let fallback=true;
export function readMuted(){try{const v=localStorage.getItem(key);return v===null?fallback:v!=='false';}catch{return fallback;}}
export function saveMuted(muted:boolean){fallback=muted;try{localStorage.setItem(key,String(muted));}catch{}window.dispatchEvent(new Event(event));}
function subscribe(callback:()=>void){window.addEventListener(event,callback);window.addEventListener('storage',callback);return()=>{window.removeEventListener(event,callback);window.removeEventListener('storage',callback);};}
export function useAudioPreference(){return [useSyncExternalStore(subscribe,readMuted,()=>true),saveMuted] as const;}
