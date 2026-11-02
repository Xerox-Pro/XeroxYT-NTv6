import {useEffect,useRef,useState} from 'react';
const variants=[['mqdefault',320],['hqdefault',480],['sddefault',640],['maxresdefault',1280]] as const;
export default function VideoThumbnail({videoId,fallback,alt='',className='',preferMaxResolution=false,sizes='(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw'}:{videoId?:string;fallback?:string;alt?:string;className?:string;sizes?:string;preferMaxResolution?:boolean}){
 const ref=useRef<HTMLImageElement>(null),[limit,setLimit]=useState(3),[measured,setMeasured]=useState(''),[useFallback,setUseFallback]=useState(false);
 const valid=typeof videoId==='string'&&/^[\w-]{11}$/.test(videoId);
 useEffect(()=>{setLimit(3);setUseFallback(false);},[videoId,fallback,preferMaxResolution]);
 useEffect(()=>{const parent=ref.current?.parentElement;if(!parent||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width>0)setMeasured(Math.ceil(width)+'px');});observer.observe(parent);return()=>observer.disconnect();},[]);
 const base=valid?`https://i.ytimg.com/vi/${videoId}/`:'';
 const downgrade=()=>{if(limit>0)setLimit(n=>n-1);else if(fallback&&!useFallback)setUseFallback(true);};
 return <img ref={ref} src={valid&&!useFallback?base+variants[preferMaxResolution?limit:Math.min(limit,1)][0]+'.jpg':fallback} srcSet={valid&&!useFallback&&!preferMaxResolution?variants.slice(0,limit+1).map(([name,width])=>`${base}${name}.jpg ${width}w`).join(', '):undefined} sizes={measured||sizes} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`absolute inset-0 w-full h-full object-cover ${className}`} onError={downgrade} onLoad={e=>{if(valid&&!useFallback&&e.currentTarget.naturalWidth<=120&&limit>0)downgrade();}}/>;
}
