type BatchRequestItem={key:string;channelId?:string;videoId?:string;author?:string};
export type BatchResponseItem={author?:string;authorAvatar?:string;authorId?:string};
class BatchAvatarFetcher{
 private queue=new Map<string,BatchRequestItem>();private callbacks=new Map<string,Set<(data:BatchResponseItem)=>void>>();private inFlight=new Set<string>();private attempts=new Map<string,number>();private cache=new Map<string,{value:BatchResponseItem;until:number}>();private timer:ReturnType<typeof setTimeout>|null=null;
 public invalidate(key:string){this.cache.delete(key);}
 public register(item:BatchRequestItem,callback:(data:BatchResponseItem)=>void){
  if(!item.key)return()=>{};const cached=this.cache.get(item.key);if(cached&&cached.until>Date.now()){callback(cached.value);return()=>{};}
  if(!this.callbacks.has(item.key))this.callbacks.set(item.key,new Set());this.callbacks.get(item.key)!.add(callback);
  if(!this.inFlight.has(item.key))this.queue.set(item.key,item);this.schedule();
  return()=>{const set=this.callbacks.get(item.key);set?.delete(callback);if(!set?.size){this.callbacks.delete(item.key);this.queue.delete(item.key);}};
 }
 private schedule(){if(!this.timer&&this.queue.size)this.timer=setTimeout(()=>void this.flush(),120);}
 private deliver(key:string,info:BatchResponseItem){const set=this.callbacks.get(key);this.callbacks.delete(key);set?.forEach(cb=>cb(info));}
 private async flush(){
  this.timer=null;const items=[...this.queue.values()].slice(0,20);if(!items.length)return;for(const item of items){this.queue.delete(item.key);this.inFlight.add(item.key);}
  let retry=false;
  try{const response=await fetch('/api/channels/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),signal:AbortSignal.timeout(12000)});if(!response.ok){retry=[408,429,500,502,503,504].includes(response.status);throw new Error('avatar request failed');}const data=await response.json();
   for(const item of items){const raw=data.results?.[item.key];const info:BatchResponseItem=raw&&typeof raw==='object'?{...raw}:{};if(typeof info.authorAvatar==='string'&&info.authorAvatar.startsWith('//'))info.authorAvatar='https:'+info.authorAvatar;
    if(info.authorAvatar&&!info.authorAvatar.includes('ui-avatars.com')){if(this.cache.size>500)this.cache.clear();this.cache.set(item.key,{value:info,until:Date.now()+600000});}this.attempts.delete(item.key);this.deliver(item.key,info);}
  }catch(error){if(!(error instanceof Error)||!error.message.includes('avatar request failed'))retry=true;for(const item of items){const n=this.attempts.get(item.key)||0;if(retry&&n<1&&this.callbacks.has(item.key)){this.attempts.set(item.key,n+1);this.queue.set(item.key,item);}else{this.attempts.delete(item.key);this.deliver(item.key,{});}}}
  finally{items.forEach(item=>this.inFlight.delete(item.key));this.schedule();}
 }
}
export const batchAvatarFetcher=new BatchAvatarFetcher();
