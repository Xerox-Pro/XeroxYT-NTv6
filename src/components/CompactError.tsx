import {AlertCircle} from 'lucide-react';
export default function CompactError({error,onRetry,message='読み込めませんでした。しばらくしてから再試行してください。',retryLabel='再試行'}:{error:string;onRetry:()=>void;message?:string;retryLabel?:string}){
 const detail=String(error).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1200);
 return <div className="compact-error" role="status"><div className="compact-error-line"><AlertCircle size={17} aria-hidden="true"/><p>{message}</p><button type="button" onClick={onRetry}>{retryLabel}</button></div>{detail&&<details><summary>詳細</summary><p>{detail}</p></details>}</div>;
}
