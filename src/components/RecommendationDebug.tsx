import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { recommendationDebug } from '../lib/localRecommendations.mjs';
export default function RecommendationDebug({onClose}:{onClose:()=>void}) {
 const [short,setShort]=useState(false);
 const [revision,setRevision]=useState(0);
 const data=recommendationDebug(short);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 return createPortal(<div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}><section role="dialog" aria-modal="true" aria-label="おすすめ予測デバッグ" className="bg-white text-gray-900 rounded-2xl w-full max-w-4xl max-h-[85dvh] overflow-auto p-5" onClick={e=>e.stopPropagation()}>
 <header className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">おすすめ予測デバッグ</h2><button autoFocus type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-100">閉じる</button></header>
 <div className="flex gap-2 mb-4"><button type="button" aria-pressed={!short} onClick={()=>setShort(false)} className={`px-3 py-2 rounded ${!short?'bg-gray-900 text-white':'bg-gray-100'}`}>ホームのおすすめ</button><button type="button" aria-pressed={short} onClick={()=>setShort(true)} className={`px-3 py-2 rounded ${short?'bg-gray-900 text-white':'bg-gray-100'}`}>ショート</button><button type="button" onClick={()=>setRevision(revision+1)} className="px-3 py-2 rounded bg-gray-100">更新</button></div>
 <p className="text-sm text-gray-600 mb-4">この端末の学習結果です。関心度は正なら好み、負なら低い関心の推定です。点数は予測確率ではありません。ショートは通常動画の興味も加味します。</p>
 <h3 className="font-bold mb-2">予測した興味・関心</h3><div className="flex flex-wrap gap-2 mb-5">{data.topics.length?data.topics.map(([term,score]:[string,number])=><span key={term} className="text-sm bg-gray-100 rounded px-2 py-1">{term}：{score.toFixed(2)}</span>):<p className="text-sm text-gray-500">まだ学習データがありません。</p>}</div>
 <h3 className="font-bold mb-2">直近で評価した候補</h3><p className="text-xs text-gray-500 mb-2">{data.snapshot?new Date(data.snapshot.at).toLocaleString('ja-JP'):'おすすめを読み込むと表示されます。'}　探索枠・チャンネルの分散・表示済み判定も並び順に影響します。現在の画面全体の順番とは異なる場合があります。</p>
 <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">順</th><th className="p-2">動画・チャンネル</th><th className="p-2">評価点</th><th className="p-2">一致した特徴</th><th className="p-2">表示済み</th></tr></thead><tbody>{data.snapshot?.videos.map((v:any)=><tr key={`${v.rank}:${v.title}`} className="border-t"><td className="p-2">{v.rank}</td><td className="p-2 min-w-48">{v.title}<div className="text-xs text-gray-500">{v.author}</div></td><td className="p-2">{v.score}</td><td className="p-2">{v.terms.join('、')||'探索候補'}</td><td className="p-2">{v.seen?'はい':'いいえ'}</td></tr>)}</tbody></table></div>
 </section></div>,document.body);
}
