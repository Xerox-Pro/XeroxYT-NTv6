import {Fragment} from 'react';
export default function RichText({text,onSelectChannel,onSelectVideo,onTimestamp}:{text:string;onSelectChannel:(id:string)=>void;onSelectVideo?:(id:string)=>void;onTimestamp?:(seconds:number)=>void}){
 const pattern=/(https?:\/\/[^\s<>]+|www\.[^\s<>]+|(?<![\p{L}\p{N}_])@[\p{L}\p{N}_.-]+|\b\d{1,2}:\d{2}(?::\d{2})?\b)/gu;
 return <>{String(text||'').split(pattern).map((part,i)=>{
  const cls='text-blue-600 hover:underline break-all';
  if(part.startsWith('@'))return <button type="button" key={i} className={cls} onClick={()=>onSelectChannel(part)}>{part}</button>;
  if(/^\d{1,2}:\d{2}(?::\d{2})?$/.test(part)&&onTimestamp){const seconds=part.split(':').reduce((n,v)=>n*60+Number(v),0);return <button type="button" key={i} className={cls} onClick={()=>onTimestamp(seconds)}>{part}</button>;}
  if(/^(https?:\/\/|www\.)/.test(part)){
   const clean=part.replace(/[.,。、!！）)\]]+$/u,'');const suffix=part.slice(clean.length);let url:URL;try{url=new URL(clean.startsWith('www.')?'https://'+clean:clean);}catch{return <Fragment key={i}>{part}</Fragment>;}
   const youtube=/(^|\.)youtube\.com$/.test(url.hostname)||url.hostname==='youtu.be';
   const channel=youtube?(url.pathname.match(/^\/(channel\/[^/]+|@[^/]+|user\/[^/]+|c\/[^/]+)/)?.[1]):null;
   if(channel){let id=channel.replace(/^(channel|user|c)\//,'');try{id=decodeURIComponent(id);}catch{}return <Fragment key={i}><a className={cls} href={'/channel/'+encodeURIComponent(id)} onClick={e=>{e.preventDefault();onSelectChannel(id);}}>{clean}</a>{suffix}</Fragment>;}
   const id=youtube?(url.hostname==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v')||url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/)?.[1]):null;
   if(id&&/^[\w-]{11}$/.test(id))return <Fragment key={i}><a className={cls} href={'/watch?v='+id} onClick={e=>{if(onSelectVideo){e.preventDefault();onSelectVideo(id);}}}>{clean}</a>{suffix}</Fragment>;
   return <Fragment key={i}><a className={cls} href={url.href} target="_blank" rel="noopener noreferrer">{clean}</a>{suffix}</Fragment>;
  }
  return <Fragment key={i}>{part}</Fragment>;
 })}</>;
}
