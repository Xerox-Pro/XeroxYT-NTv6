import {ChevronUp,ChevronDown,X,Shuffle,Repeat,Repeat1,SkipBack,SkipForward,Play} from 'lucide-react';
import type {Video} from '../types';
import VideoThumbnail from './VideoThumbnail';
import {formatDuration} from '../utils';
type Props={videos:Video[];index:number;title:string;open:boolean;shuffle:boolean;repeat:'off'|'all'|'one';onToggle:()=>void;onSelect:(index:number)=>void;onShuffle:()=>void;onRepeat:()=>void};
export default function PlaylistQueuePanel({videos,index,title,open,shuffle,repeat,onToggle,onSelect,onShuffle,onRepeat}:Props){
 if(!videos.length||index<0)return null;
 const next=videos[index+1]||(repeat==='all'?videos[0]:null);
 return <section className={`playlist-queue-panel ${open?'queue-open':'queue-collapsed'}`} aria-label="再生リストの連続再生">
  <div className="queue-drag-handle"/>
  <header><button type="button" className="queue-heading" onClick={onToggle} aria-expanded={open}><strong>{title||'再生リスト'}</strong><span>{open?`${index+1} / ${videos.length}`:`${next?'次の動画: '+next.title:'再生中: '+videos[index].title}`}</span></button><button type="button" className="queue-toggle" onClick={onToggle} aria-label={open?'再生リストを閉じる':'再生リストを開く'}>{open?<X size={21}/>:<ChevronUp size={21}/>}</button></header>
  {open&&<><div className="queue-controls"><button type="button" onClick={onRepeat} aria-label={`リピート: ${repeat==='off'?'オフ':repeat==='one'?'1曲':'すべて'}`} aria-pressed={repeat!=='off'}>{repeat==='one'?<Repeat1 size={21}/>:<Repeat size={21}/>}</button><button type="button" onClick={onShuffle} aria-label="シャッフル" aria-pressed={shuffle}><Shuffle size={20}/></button><span/>
  <button type="button" aria-label="前の動画" disabled={index===0&&repeat!=='all'} onClick={()=>onSelect(index===0?videos.length-1:index-1)}><SkipBack size={20}/></button><button type="button" aria-label="次の動画" disabled={index===videos.length-1&&repeat!=='all'} onClick={()=>onSelect(index===videos.length-1?0:index+1)}><SkipForward size={20}/></button></div>
  <div className="queue-video-list">{videos.map((video,i)=><button type="button" key={`${video.videoId}-${i}`} aria-current={i===index?'true':undefined} onClick={()=>onSelect(i)} className="queue-video"><span className="queue-number">{i===index?<Play size={13} fill="currentColor"/>:i+1}</span><div className="queue-thumbnail"><VideoThumbnail videoId={video.videoId} fallback={video.videoThumbnails?.[0]?.url} sizes="120px"/><small>{formatDuration(video.lengthSeconds)}</small></div><div className="queue-video-text"><strong>{video.title}</strong><span>{video.author}</span></div></button>)}</div></>}
 </section>;
}
