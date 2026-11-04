const MODE_KEY='xerox_api_transport_v1',AUTO_KEY='xerox_api_auto_proxy_until_v1';
let configured;
export function readTransportState(){let mode='auto',automatic=false;try{const saved=localStorage.getItem(MODE_KEY);if(['auto','direct','proxy'].includes(saved))mode=saved;automatic=Number(localStorage.getItem(AUTO_KEY)||0)>Date.now();}catch{}return {mode,automatic};}
export function setTransportMode(mode){if(!['auto','direct','proxy'].includes(mode))return;localStorage.setItem(MODE_KEY,mode);localStorage.removeItem(AUTO_KEY);window.dispatchEvent(new Event('xerox-transport-changed'));}
async function transportConfig(){if(!configured)configured=fetch('/api/transport-config',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(4000)}).then(r=>r.ok?r.json():{}).then(d=>({preferProxy:d.preferProxy===true,origins:Array.isArray(d.origins)?d.origins.filter(value=>{try{return new URL(value).protocol==='https:';}catch{return false;}}):[]})).catch(()=>({preferProxy:false,origins:[]}));return configured;}
export async function apiFetch(path,options={}){
 if(!path.startsWith('/api/')||/^\/api\/(account|auth)(\/|$)/.test(path)||(options.method&&options.method!=='GET'))return fetch(path,options);
 const state=readTransportState();if(state.mode==='proxy'||(state.mode==='auto'&&state.automatic))return fetch(path,{...options,credentials:'same-origin'});
 const config=await transportConfig();
 if(state.mode==='auto'&&config.preferProxy)return fetch(path,{...options,credentials:'same-origin'});
 const list=config.origins;
 for(const origin of list){try{const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000);const response=await fetch(origin+path,{...options,credentials:'include',mode:'cors',signal});if(response.ok)return response;await response.body?.cancel();}catch(error){if(options.signal?.aborted)throw error;}}
 if(state.mode==='direct')throw new Error('APIへ直接接続できません。マイページの接続設定を「自動」か「サーバー経由」に変更してください。');
 try{localStorage.setItem(AUTO_KEY,String(Date.now()+10*60*1000));window.dispatchEvent(new Event('xerox-transport-changed'));}catch{}
 return fetch(path,{...options,credentials:'same-origin'});
}
