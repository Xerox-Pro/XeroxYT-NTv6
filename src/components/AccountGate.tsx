import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode, type FormEvent } from 'react';

type Item = { videoId: string; timestamp?: number; [key: string]: unknown };
type User = { id: string; username: string };
type Cache = { history: Item[]; version: number; dirty: boolean };
export const AccountContext = createContext<{ username: string; logout: () => Promise<void> } | null>(null);
export const useSiteAccount = () => useContext(AccountContext);
const LEGACY_KEY = 'xerox_watch_history';
const SESSION_HINT_KEY = 'xerox_site_session_hint';
const accountKey = (id: string) => `xerox_account_history_${id}`;
// These values are device-local; keep them separate when accounts share a browser.
const deviceKeys = ['xerox_short_history', 'xerox_youtube_credentials', 'xerox_user_info', 'xerox_subscriptions', 'xerox_user_playlists', 'xerox_ai_interests', 'xerox_video_cache'];
function switchDeviceAccount(id: string) {
  const previous = localStorage.getItem('xerox_last_account_id');
  if (previous === id) return;
  for (const key of deviceKeys) {
    const old = localStorage.getItem(key);
    if (old !== null) localStorage.setItem(`xerox_device_${previous || 'legacy'}_${key}`, old);
    const next = localStorage.getItem(`xerox_device_${id}_${key}`);
    if (next === null) localStorage.removeItem(key); else localStorage.setItem(key, next);
  }
}

const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; } };
const merge = (...lists: Item[][]): Item[] => {
  const seen = new Map<string, Item>();
  lists.flat().forEach(item => {
    if (!item || typeof item.videoId !== 'string') return;
    const previous = seen.get(`${item.type || 'video'}:${item.videoId}`);
    if (!previous || Number(item.timestamp || 0) > Number(previous.timestamp || 0)) seen.set(`${item.type || 'video'}:${item.videoId}`, item);
  });
  const sorted = [...seen.values()].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  return [...sorted.filter(item => item.type !== 'short').slice(0, 50), ...sorted.filter(item => item.type === 'short').slice(0, 50)];
};
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/account${path}`, { method, credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || '通信に失敗しました。'), { status: response.status });
  return data;
}

export default function AccountGate({ children }: { children: ReactNode }) {
  const [cachedUser] = useState<User | null>(() => { const hint = read<User | null>(SESSION_HINT_KEY, null); return hint && typeof hint.id === 'string' && typeof hint.username === 'string' && localStorage.getItem('xerox_last_account_id') === hint.id ? hint : null; });
  const [user, setUser] = useState<User | null>(cachedUser);
  const [phase, setPhase] = useState<'checking' | 'login' | 'loading' | 'ready' | 'error'>(cachedUser ? 'ready' : 'login');
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [migrate, setMigrate] = useState(false);
  const [message, setMessage] = useState('');
  const cache = useRef<Cache>(cachedUser ? read<Cache>(accountKey(cachedUser.id), { history: [], version: 0, dirty: false }) : { history: [], version: 0, dirty: false });
  const active = useRef<User | null>(cachedUser);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sending = useRef(false);
  const authEpoch = useRef(0);
  const sync = useRef<() => Promise<void>>(async () => {});

  const persist = (u: User) => localStorage.setItem(accountKey(u.id), JSON.stringify(cache.current));
  const initialize = useCallback(async (u: User, importLegacy = false, background = false) => {
    if (!background) setPhase('loading'); setMessage('');
    const epoch = authEpoch.current;
    try {
      const remote = await api('/history');
      if (epoch !== authEpoch.current) return;
      const saved = active.current?.id === u.id ? cache.current : read<Cache | null>(accountKey(u.id), null);
      let history: Item[] = Array.isArray(remote.history) ? remote.history : [];
      let dirty = false;
      if (saved?.dirty) { history = saved.version === remote.version ? saved.history : merge(saved.history, history); dirty = true; }
      const legacy = read<Item[]>(LEGACY_KEY, []);
      if (!localStorage.getItem('xerox_last_account_id') && !localStorage.getItem('xerox_legacy_history_backup')) {
        localStorage.setItem('xerox_legacy_history_backup', JSON.stringify(legacy));
      }
      if (importLegacy) {
        history = merge(history, Array.isArray(legacy) ? legacy : []); dirty = true;
      }
      switchDeviceAccount(u.id);
      cache.current = { history, version: remote.version, dirty };
      localStorage.setItem(LEGACY_KEY, JSON.stringify(history.filter(item => item.type !== 'short')));
      localStorage.setItem('xerox_short_history', JSON.stringify(history.filter(item => item.type === 'short')));
      localStorage.setItem('xerox_last_account_id', u.id);
      localStorage.setItem(SESSION_HINT_KEY, JSON.stringify(u));
      active.current = u; persist(u); setUser(u); setPhase('ready');
      if (background) window.dispatchEvent(new CustomEvent('xerox-history-remote', { detail: history }));
      if (dirty) setTimeout(() => void sync.current(), 0);
    } catch (err: any) {
      if (err.status === 401) { active.current = null; localStorage.removeItem(SESSION_HINT_KEY); setUser(null); setPhase('login'); setMessage('ログインの有効期限が切れました。'); }
      else if (background) { setMessage('クラウドの履歴を確認できません。端末内の履歴を表示しています。'); }
      else { setUser(u); setMessage(err instanceof Error ? err.message : '履歴を読み込めませんでした。'); setPhase('error'); }
    }
  }, []);

  sync.current = async () => {
    const u = active.current;
    if (!u || sending.current || !cache.current.dirty) return;
    sending.current = true;
    const snapshot = cache.current;
    try {
      const result = await api('/history', 'PUT', { history: snapshot.history, version: snapshot.version });
      cache.current = { ...cache.current, version: result.version, dirty: cache.current.history !== snapshot.history };
      persist(u); setMessage('');
    } catch (err: any) {
      if (err.status === 409) {
        try {
          const remote = await api('/history');
          cache.current = { history: merge(cache.current.history, remote.history), version: remote.version, dirty: true };
          localStorage.setItem(LEGACY_KEY, JSON.stringify(cache.current.history)); persist(u);
          window.dispatchEvent(new CustomEvent('xerox-history-remote', { detail: cache.current.history }));
          setMessage('他の端末の履歴と統合しました。更新すると表示に反映されます。');
        } catch { setMessage('履歴は端末に保存されています。同期を再試行します。'); }
      } else setMessage('履歴は端末に保存されています。同期を再試行します。');
    } finally {
      sending.current = false;
      if (cache.current.dirty && active.current) timer.current = setTimeout(() => void sync.current(), 5000);
    }
  };

  useEffect(() => {
    if (cachedUser) active.current = cachedUser;
    const epoch = authEpoch.current;
    api('/session').then(({ user: existing }) => { if (authEpoch.current === epoch) return initialize(existing, false, cachedUser?.id === existing.id); }).catch((err) => {
      if (authEpoch.current !== epoch) return;
      if (err.status === 401) { active.current = null; localStorage.removeItem(SESSION_HINT_KEY); setUser(null); setPhase('login'); }
      else if (cachedUser) setMessage('接続を確認できません。端末内の履歴を表示しています。');
      else { setMessage('ログイン状態を確認できません。通信環境を確認してください。'); setPhase('error'); }
    });
    return () => { active.current = null; if (timer.current) clearTimeout(timer.current); };
  }, [initialize, cachedUser]);

  useEffect(() => {
    const changed = (event: Event) => {
      const u = active.current;
      if (!u) return;
      const history = (event as CustomEvent<Item[]>).detail;
      if (!Array.isArray(history)) return;
      if (JSON.stringify(history) === JSON.stringify(cache.current.history)) return;
      cache.current = { ...cache.current, history, dirty: true }; persist(u);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void sync.current(), 800);
    };
    window.addEventListener('xerox-history-change', changed);
    return () => window.removeEventListener('xerox-history-change', changed);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage('');
    if (register && password !== confirm) { setMessage('パスワードが一致しません。'); return; }
    try {
      setPhase('loading');
      const result = await api(register ? '/register' : '/login', 'POST', { username, password });
      setPassword(''); setConfirm(''); await initialize(result.user, migrate);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'ログインに失敗しました。'); setPhase('login'); }
  }
  async function logout() {
    if (cache.current.dirty) { await sync.current(); if (cache.current.dirty) { setMessage('履歴の同期が完了していません。端末内には保存されています。'); return; } }
    try { authEpoch.current++; await api('/logout', 'POST', {}); active.current = null; localStorage.removeItem(SESSION_HINT_KEY); setUser(null); setPhase('login'); setMessage(''); }
    catch { setMessage('ログアウトできませんでした。'); }
  }
  if (phase === 'ready' && user) return <AccountContext.Provider value={{ username: user.username, logout }}>{children}{message && <div role="status" className="fixed top-16 right-4 z-[200] bg-gray-900 text-white text-xs p-3 rounded-xl max-w-xs shadow-lg">{message}</div>}</AccountContext.Provider>;

  return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-5"><section className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-gray-100 p-7 sm:p-9"><h1 className="text-2xl font-bold text-gray-900">XeroxYT</h1><p className="text-sm text-gray-500 mt-2">アカウントにログインして、視聴履歴を端末とクラウドに保存します。</p>{phase === 'error' ? <><p className="mt-6 text-red-700" role="alert">{message}</p><button className="mt-4 rounded-xl bg-gray-900 text-white px-4 py-2" onClick={() => user ? void initialize(user) : window.location.reload()}>再試行</button></> : <form onSubmit={submit} className="mt-7 space-y-4"><h2 className="text-lg font-semibold">{register ? '新規アカウント作成' : 'ログイン'}</h2><label className="block text-sm">ユーザー名<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5" placeholder="英数字と _" /></label><label className="block text-sm">パスワード<input type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={12} maxLength={128} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5" placeholder="12文字以上" /></label>{register && <label className="block text-sm">パスワード（確認）<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5" /></label>}{!localStorage.getItem('xerox_last_account_id') && <label className="flex items-start gap-2 text-sm text-gray-600"><input type="checkbox" checked={migrate} onChange={e => setMigrate(e.target.checked)} className="mt-1" />この端末にある以前の視聴履歴を取り込む</label>}{message && <p className="text-sm text-red-700" role="alert">{message}</p>}<button disabled={phase === 'loading'} className="w-full bg-gray-900 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">{phase === 'loading' ? '処理中…' : register ? 'アカウントを作成' : 'ログイン'}</button><button type="button" onClick={() => { setRegister(!register); setMessage(''); }} className="w-full text-sm text-blue-700 py-2">{register ? 'すでにアカウントを持っている' : '新規アカウントを作成'}</button>{register && <p className="text-xs text-gray-500">パスワード再設定機能はまだありません。忘れないよう安全に保管してください。</p>}</form>}</section></main>;
}
