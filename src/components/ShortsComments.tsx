import { useEffect, useRef, useState } from 'react';
import { Loader2, ThumbsUp, X } from 'lucide-react';
import { Comment } from '../types';
import { fetchJSON } from '../utils';
import Avatar from './Avatar';

export default function ShortsComments({ videoId, onClose, onSelectChannel, inline = false }: {
  videoId: string; onClose?: () => void; inline?: boolean; onSelectChannel: (id: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [sort, setSort] = useState('top');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (inline) return;
    const previous = document.activeElement as HTMLElement;
    close.current?.focus();
    return () => previous?.focus();
  }, [inline]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    if (page === 1) setComments([]);
    fetchJSON(`/api/video/${videoId}/comments?sort=${sort}&page=${page}`).then(data => {
      if (cancelled) return;
      const items: Comment[] = Array.isArray(data) ? data : data.comments || [];
      if (data.isPlayerOnly) setError('本日の動画情報の取得上限に達したため、コメントを取得できません。');
      setComments(old => page === 1 ? items : [...new Map([...old, ...items].map(c => [c.id, c])).values()]);
      setHasMore(Boolean(data.hasMore) && items.length > 0);
    }).catch(err => { if (!cancelled) setError(err.message || 'コメントを取得できませんでした'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [videoId, sort, page, attempt]);
  return <aside ref={panel} className={inline ? "shorts-comments shorts-comments-inline" : "shorts-comments"} role={inline ? "region" : "dialog"} aria-modal={inline ? undefined : true} aria-labelledby="shorts-comments-title" onKeyDown={event => {
    if (inline) return;
    event.stopPropagation();
    if (event.key === 'Escape') onClose?.();
    if (event.key === 'Tab') {
      const controls = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select, a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <header className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
      <h2 id="shorts-comments-title" className="font-bold text-lg">コメント</h2>
      {!inline && <button ref={close} onClick={onClose} aria-label="コメントを閉じる" className="p-2 rounded-full hover:bg-gray-100"><X size={22} /></button>}
    </header>
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <label htmlFor="shorts-comment-sort">並べ替え</label>
      <select id="shorts-comment-sort" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="bg-gray-100 rounded-lg p-2"><option value="top">評価順</option><option value="newest">新しい順</option></select>
    </div>
    <div className="overflow-y-auto overscroll-contain p-4 space-y-5 flex-1">
      {comments.map(comment => <article key={comment.id} className="flex items-start gap-3">
        <button onClick={() => { onClose?.(); onSelectChannel(comment.authorId || comment.author); }} aria-label={`${comment.author}のチャンネル`}>
          <Avatar src={comment.authorAvatar} name={comment.author} className="w-8 h-8 text-xs" />
        </button>
        <div className="min-w-0 flex-1"><p className="text-xs"><strong>{comment.author}</strong><span className="text-gray-500 ml-2">{comment.publishedTime}</span></p>
          <p className="text-sm whitespace-pre-wrap break-words mt-1">{comment.text}</p>
          <p className="flex items-center gap-2 mt-2 text-xs text-gray-500"><ThumbsUp size={13} />{comment.likeCount}</p>
        </div>
      </article>)}
      {!loading && !error && !comments.length && <p className="text-sm text-gray-500">表示できるコメントがありません。コメントが無効の場合もあります。</p>}
      {error && <div role="status" className="text-sm text-red-600">{error}<button className="block mt-2 underline" onClick={() => setAttempt(a => a + 1)}>再試行</button></div>}
      {loading ? <p role="status" className="flex justify-center gap-2 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" />読み込み中…</p>
        : hasMore && <button onClick={() => setPage(p => p + 1)} className="w-full py-3 rounded-full bg-gray-100 text-sm font-semibold">次のコメントを表示</button>}
    </div>
  </aside>;
}
