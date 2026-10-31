// Only public embed URLs are stored here; never store credentials or viewing history.
const entries = new Map();
const pending = new Map();
const TTL = 15 * 60 * 1000;
const MAX_ENTRIES = 100;
const MAX_BYTES = 128 * 1024;
let bytes = 0;

function drop(key) {
  const entry = entries.get(key);
  if (entry) { bytes -= entry.bytes; entries.delete(key); }
}

export function getShortEmbedUrl(id, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const entry = entries.get(id);
  if (entry && entry.expires > Date.now()) {
    entries.delete(id); entries.set(id, entry);
    return Promise.resolve(entry.value);
  }
  drop(id);
  let request = pending.get(id);
  if (!request || request.controller.signal.aborted) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    request = { controller, users: 0, promise: null };
    const current = request;
    request.promise = (async () => {
      try {
        const response = await fetch(`https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json?t=${Date.now()}`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let clean = (await response.text()).replace(/&amp;/g, '&').trim();
        if (clean.startsWith('{')) { try { const config = JSON.parse(clean); if (typeof config?.params === 'string') clean = config.params.replace(/&amp;/g, '&').trim(); } catch {} }
        const index = clean.indexOf('?');
        if (index !== -1) clean = clean.substring(index);
        else if (clean && !clean.startsWith('&')) clean = '?' + clean;
        return new Response(`https://www.youtubeeducation.com/embed/${encodeURIComponent(id)}${clean || '?rel=0&autoplay=1&mute=1'}`);
      } catch (error) {
        if (controller.signal.aborted) throw error;
        return fetch(`/api/edu/${encodeURIComponent(id)}`, { signal: controller.signal, credentials: 'omit' });
      }
    })().then(async response => {
        if (!response.ok) throw new Error('埋め込み動画を読み込めませんでした。');
        const value = await response.text();
        const url = new URL(value);
        if (url.protocol !== 'https:' || !['www.youtubeeducation.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) throw new Error('埋め込みURLが正しくありません。');
        const size = new TextEncoder().encode(value).byteLength;
        if (size <= MAX_BYTES) {
          drop(id);
          while (entries.size >= MAX_ENTRIES || bytes + size > MAX_BYTES) drop(entries.keys().next().value);
          entries.set(id, { value, bytes: size, expires: Date.now() + TTL }); bytes += size;
        }
        return value;
      }).finally(() => { clearTimeout(timer); if (pending.get(id) === current) pending.delete(id); });
    pending.set(id, request);
  }
  request.users++;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return false;
      done = true; signal?.removeEventListener('abort', cancel);
      if (--request.users === 0 && pending.get(id) === request) request.controller.abort();
      return true;
    };
    const cancel = () => { if (finish()) reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
    request.promise.then(value => { if (finish()) resolve(value); }, error => { if (finish()) reject(error); });
  });
}
