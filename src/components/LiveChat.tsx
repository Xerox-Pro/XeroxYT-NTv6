import { useEffect, useRef, useState } from 'react';
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
    const timer = setInterval(() => setPosition(getTimeRef.current()), 1000);
    return () => clearInterval(timer);
  }, [replay]);

  const visible = replay ? messages.filter(m => m.offset === undefined || m.offset <= position) : messages;
  return (
    <section aria-label="ライブチャット" className="flex flex-col h-[580px] bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-3 bg-gray-50 border-b text-xs font-bold">{replay ? 'チャットのリプレイ' : 'ライブチャット'}</div>
      {replay && <p className="px-3 py-2 text-xs text-gray-500">時刻を押すと動画をその位置から再生します。再生位置との同期は目安です。</p>}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs" aria-live="polite">
        {status && <div className="text-gray-500">{status}</div>}
        {visible.slice(-200).map(message => (
          <div key={message.id} className="flex items-start gap-2">
            <Avatar src={message.avatar} name={message.author} className="w-6 h-6 text-[10px] shrink-0" />
            <div className="min-w-0">
              {message.offset !== undefined ? (
                <button type="button" className="text-blue-600 hover:underline mr-2" onClick={() => onSeek(message.offset!)}>{formatOffset(message.offset)}</button>
              ) : <span className="text-gray-400 mr-2">{message.timestamp}</span>}
              <span className="font-bold text-gray-600">{message.author}</span>
              {message.amount && <span className="ml-2 font-bold text-amber-700">{message.amount}</span>}
              <p className="break-words text-gray-900">{message.text}</p>
            </div>
          </div>
        ))}
      </div>
      {status.includes('取得できません') && <button type="button" className="p-2 text-xs text-blue-600" onClick={() => setAttempt(n => n + 1)}>再試行</button>}
      <div className="p-2 border-t text-xs text-gray-500">閲覧のみ対応しています。</div>
    </section>
  );
}
