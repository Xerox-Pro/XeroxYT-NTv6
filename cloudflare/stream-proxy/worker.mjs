const MAX_BODY = 256 * 1024;
const MAX_RANGE = 4 * 1024 * 1024;
const allowedHeaderNames = new Set(['accept','accept-language','content-type','user-agent','x-youtube-client-name','x-youtube-client-version','x-goog-visitor-id','x-youtube-bootstrap-logged-in','x-youtube-page-cl','x-youtube-page-label','x-youtube-utc-offset','x-youtube-time-zone','origin','referer','range']);
const errorResponse = (message, status) => Response.json({ error: message }, {status, headers: {'Cache-Control':'no-store'}});
function allowUrl(value, method) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    if (/(^|\.)googlevideo\.com$/i.test(u.hostname)) return method === 'GET';
    if (u.hostname !== 'www.youtube.com') return false;
    return (method === 'GET' && (u.pathname === '/sw.js_data' || u.pathname === '/iframe_api' || /^\/s\/player\/[a-zA-Z0-9_.\/-]+\/base\.js$/.test(u.pathname))) ||
      (method === 'POST' && /^\/youtubei\/v1\/(player|config)$/.test(u.pathname));
  } catch { return false; }
}
async function authorized(request, db) {
  const token = /(?:^|;\s*)__Host-xy_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') || '')?.[1];
  if (!token) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,'0')).join('');
  return !!(await db.prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(hash, Date.now()).first());
}
async function readJson(request) {
  if (!request.body) throw new Error('body');
  const reader = request.body.getReader(); const chunks=[]; let size=0;
  for (;;) { const {value,done}=await reader.read(); if(done)break; size+=value.byteLength; if(size>MAX_BODY){await reader.cancel();throw new Error('large');} chunks.push(value); }
  const data = new Uint8Array(size); let offset=0; for(const c of chunks){data.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(data));
}
export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/fetch') return errorResponse('Not found',404);
    try {
      if (!await authorized(request,env.DB)) return errorResponse('Unauthorized',401);
      const body = await readJson(request);
      let url = typeof body.url === 'string' ? body.url : '';
      const method = body.method === 'POST' ? 'POST' : 'GET';
      if (url.length > 8192 || !allowUrl(url,method)) return errorResponse('Invalid target',400);
      const headers = new Headers();
      for (const [name,value] of Object.entries(body.headers || {})) {
        if (allowedHeaderNames.has(name.toLowerCase()) && typeof value === 'string' && value.length < 4096) headers.set(name,value);
      }
      const range = headers.get('range');
      if (new URL(url).hostname.endsWith('googlevideo.com')) {
        const match = /^bytes=(\d+)-(\d+)$/.exec(range || '');
        if (!match || !Number.isSafeInteger(Number(match[1])) || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) < Number(match[1]) || Number(match[2]) - Number(match[1]) >= MAX_RANGE) return errorResponse('Invalid range',400);
      }
      if (method === 'POST' && (typeof body.body !== 'string' || body.body.length > 128 * 1024)) return errorResponse('Invalid payload',400);
      for (let i=0;i<5;i++) {
        if (!allowUrl(url,method)) return errorResponse('Invalid redirect',502);
        const upstream = await fetch(url, { method, headers, ...(method === 'POST' ? {body: body.body} : {}), redirect:'manual', signal:AbortSignal.timeout(30000) });
        if ([301,302,303,307,308].includes(upstream.status)) {
          const location = upstream.headers.get('location'); await upstream.body?.cancel();
          if (!location || method !== 'GET') return errorResponse('Invalid redirect',502);
          url = new URL(location,url).href; continue;
        }
        const forwarded = new Headers({'Cache-Control':'no-store'});
        for (const name of ['content-type','content-range','accept-ranges']) { const v=upstream.headers.get(name); if(v) forwarded.set(name,v); }
        return new Response(upstream.body,{status:upstream.status,headers:forwarded});
      }
      return errorResponse('Too many redirects',502);
    } catch (err) { console.error('stream proxy failure', err instanceof Error ? err.name : 'unknown'); return errorResponse('Upstream unavailable',502); }
  }
};
