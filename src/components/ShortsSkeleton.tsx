export default function ShortsSkeleton({grid=false,count=6}:{grid?:boolean;count?:number}){
 return <div className={grid?'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4':'shorts-shelf-scroll'} role="status" aria-label="ショートを読み込み中"><span className="sr-only">ショートを読み込み中</span>{Array.from({length:count},(_,i)=><div key={i} className={grid?'min-w-0':'shorts-cover'} aria-hidden="true"><div className="aspect-[9/16] rounded-xl animate-shimmer"/><div className="mt-2 h-3 w-4/5 rounded animate-shimmer"/><div className="mt-2 h-3 w-1/2 rounded animate-shimmer"/></div>)}</div>;
}
