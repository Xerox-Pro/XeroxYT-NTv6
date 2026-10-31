const CONFIG_URL = 'https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json';
const MAX_BYTES = 16384;

export function parseEmbedParams(text) {
  let clean = text.replace(/&amp;/g, '&').trim();
  if (clean.startsWith('{')) clean = String(JSON.parse(clean).params || '').replace(/&amp;/g, '&');
  if (clean.includes('?')) clean = clean.slice(clean.indexOf('?') + 1);
  clean = clean.replace(/^[?&]+/, '');
  if (!clean || clean.length > MAX_BYTES) throw new Error('Invalid embed configuration');
  // Only query parameters are accepted; upstream cannot choose the host or path.
  return new URLSearchParams(clean).toString();
}

export async function handleEmbed(request, id, { cache = globalThis.caches?.default, fetchUpstream = fetch } = {}) {
  if (!/^[\w-]{11}$/.test(id)) return Response.json({ error: '動画IDが正しくありません。' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const key = new Request(new URL('/__internal/embed-config-v1', request.url));
  let params = 'rel=0&autoplay=1';
  try {
    const hit = await cache?.match(key);
    if (hit) params = await hit.text();
    else {
      const response = await fetchUpstream(CONFIG_URL, { signal: AbortSignal.timeout(5000), redirect: 'error', headers: { accept: 'application/json, text/plain' } });
      if (!response.ok || !response.body) throw new Error('Configuration unavailable');
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength; if (size > MAX_BYTES) throw new Error('Configuration too large');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      params = parseEmbedParams(new TextDecoder().decode(bytes));
      // Store public configuration only; no session or response to a user is cached.
      await cache?.put(key, new Response(params, { headers: { 'Cache-Control': 'public, max-age=900' } }));
    }
  } catch { console.warn('embed configuration unavailable; using compatible default'); }
  return new Response(`https://www.youtubeeducation.com/embed/${id}?${params}`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store' }
  });
}
