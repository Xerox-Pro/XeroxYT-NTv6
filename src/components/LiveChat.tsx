import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Avatar from './Avatar';

type Message = { id: string; author: string; avatar?: string; text: string; timestamp: string; amount?: string; offset?: number };
type ChatResponse = { available: boolean; replay?: boolean; messages?: Message[]; continuation?: string | null; error?: string };

function formatOffset(seconds: number) {
  const total = Math.floor(Math.max(0, seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export default function LiveChat({ videoId, getCurrentTime, onSeek }: {
  videoId: string; getCurrentTime: () => number; onSeek: (seconds: number) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [replay, setReplay] = useState(false);
  const [position, setPosition] = useState(0);
  const [status, setStatus] = useState('チャットを読み込み中…');
  const [attempt, setAttempt] = useState(0);
  const getTimeRef = useRef(getCurrentTime);
  const listRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const reducedMotion = useReducedMotion();
  getTimeRef.current = getCurrentTime;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let continuation = '';
    let isReplay = false;
    let lastOffset = 0;
    let ended = false;
    const abort = new AbortController();
    setMessages([]);
    followingRef.current = true;
    setFollowing(true);
    setStatus('チャットを読み込み中…');
    setReplay(false);

    const poll = async () => {
      if (cancelled || ended) return;
      if (isReplay && lastOffset > getTimeRef.current() + 20) {
        timer = setTimeout(poll, 2000);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (continuation) {
          params.set('continuation', continuation);
          params.set('replay', isReplay ? '1' : '0');
        }
        const response = await fetch(`/api/video/${encodeURIComponent(videoId)}/live-chat?${params}`, { signal: abort.signal });
        const data: ChatResponse = await response.json();
        if (!response.ok) throw new Error(data.error || 'チャットを取得できませんでした。');
        if (cancelled) return;
        if (!data.available) {
          setStatus('この動画ではチャットを利用できません。');
          return;
        }
        isReplay = !!data.replay;
        setReplay(isReplay);
        const incoming = data.messages || [];
        for (const message of incoming) if (message.offset !== undefined) lastOffset = Math.max(lastOffset, message.offset);
        setMessages(previous => {
          const seen = new Set(previous.map(m => m.id));
          return [...previous, ...incoming.filter(m => m.id && !seen.has(m.id) && (seen.add(m.id), true))].slice(-3000);
        });
        setStatus('');
        continuation = data.continuation || '';
        if (!continuation) {
          ended = true;
          return;
        }
        timer = setTimeout(poll, isReplay ? 1000 : 4000);
      } catch (error: any) {
        if (!cancelled && error.name !== 'AbortError') setStatus(error.message || 'チャットを取得できませんでした。');
      }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); abort.abort(); };
  }, [videoId, attempt]);

  useEffect(() => {
    if (!replay) return;
    const timer = setInterval(() => setPosition(getTimeRef.current()), 250);
    return () => clearInterval(timer);
  }, [replay]);

  const visible = replay ? messages.filter(m => m.offset !== undefined && m.offset <= position) : messages;
  const latestId = visible.at(-1)?.id;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && followingRef.current) list.scrollTop = list.scrollHeight;
  }, [latestId]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    followingRef.current = atBottom;
    setFollowing(atBottom);
  };

  const followLatest = () => {
    followingRef.current = true;
    setFollowing(true);
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  return (
    <section aria-label="ライブチャット" className="flex flex-col h-[580px] bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-900">{replay ? 'チャットのリプレイ' : 'ライブチャット'}</div>
      {replay && <p className="px-3 py-2 text-xs text-gray-500">時刻を押すと動画をその位置から再生します。再生位置との同期は目安です。</p>}
      <div ref={listRef} onScroll={handleScroll} className="flex-1 px-2 py-2 overflow-y-auto text-xs" aria-live="polite" aria-relevant="additions">
        {status && <div className="text-gray-500">{status}</div>}
        {visible.slice(-200).map(message => (
          <motion.div key={message.id} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg ${message.amount ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
            <Avatar src={message.avatar} name={message.author} className="w-6 h-6 text-[10px] shrink-0" />
            <div className="min-w-0">
              {message.offset !== undefined ? (
                <button type="button" className="text-blue-600 hover:underline mr-2" onClick={() => onSeek(message.offset!)}>{formatOffset(message.offset)}</button>
              ) : <span className="text-gray-400 mr-2">{message.timestamp}</span>}
              <span className="font-bold text-gray-600">{message.author}</span>
              {message.amount && <span className="ml-2 font-bold text-amber-700">{message.amount}</span>}
              <p className="inline ml-1 break-words text-gray-900">{message.text}</p>
            </div>
          </motion.div>
        ))}
      </div>
      {!following && <button type="button" onClick={followLatest} className="mx-auto mb-2 rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-200">最新のチャットへ ↓</button>}
      {status.includes('取得できません') && <button type="button" className="p-2 text-xs text-blue-600" onClick={() => setAttempt(n => n + 1)}>再試行</button>}
      <div className="p-2 border-t text-xs text-gray-500">閲覧のみ対応しています。</div>
    </section>
  );
}
