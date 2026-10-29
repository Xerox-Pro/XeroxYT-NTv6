import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/stream-proxy/worker.mjs';

const token = 'a'.repeat(64);
const env = { DB: { prepare() { return { bind() { return { async first() { return {ok: 1}; } }; } }; } } };
const post = (body, cookie = `__Host-xy_session=${token}`) => new Request('https://proxy.test/fetch', {method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)});

test('requires an authenticated session and restricts target hosts, paths and ranges', async () => {
  assert.equal((await worker.fetch(post({url:'https://www.youtube.com/iframe_api'}, ''),env)).status,401);
  assert.equal((await worker.fetch(post({url:'https://example.com/private'}),env)).status,400);
  assert.equal((await worker.fetch(post({url:'https://www.youtube.com/account'}),env)).status,400);
  assert.equal((await worker.fetch(post({url:'https://x.googlevideo.com/videoplayback',headers:{range:'bytes=0-4194304'}}),env)).status,400);
  assert.equal((await worker.fetch(post({url:'http://x.googlevideo.com/videoplayback',headers:{range:'bytes=0-1023'}}),env)).status,400);
});

test('forwards allowed ranges and rejects redirects to untrusted hosts', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null,{status:302,headers:{location:'https://evil.example/private'}});
    const bad = await worker.fetch(post({url:'https://x.googlevideo.com/videoplayback',headers:{range:'bytes=0-1023'}}),env);
    assert.equal(bad.status,502);
    globalThis.fetch = async (url, init) => { assert.equal(init.headers.get('range'),'bytes=0-1023'); return new Response(new Uint8Array(1024),{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 0-1023/2000'}}); };
    const ok = await worker.fetch(post({url:'https://x.googlevideo.com/videoplayback',headers:{range:'bytes=0-1023',authorization:'secret'}}),env);
    assert.equal(ok.status,206); assert.equal(ok.headers.get('content-range'),'bytes 0-1023/2000'); assert.equal((await ok.arrayBuffer()).byteLength,1024);
  } finally {globalThis.fetch=original;}
});

test('preserves upstream access denial and reports timeouts separately', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('forbidden', {status:403});
    assert.equal((await worker.fetch(post({url:'https://x.googlevideo.com/videoplayback',headers:{range:'bytes=0-3'}}),env)).status,403);
    globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
    assert.equal((await worker.fetch(post({url:'https://x.googlevideo.com/videoplayback',headers:{range:'bytes=0-3'}}),env)).status,504);
  } finally { globalThis.fetch = original; }
});
