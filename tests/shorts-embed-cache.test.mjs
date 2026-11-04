import test from 'node:test';
import assert from 'node:assert/strict';
import { getShortEmbedUrl } from '../src/lib/shortsEmbedCache.mjs';

test('embed requests share work, survive one cancellation, and reuse a successful response', async () => {
  const previous = globalThis.fetch;
  let calls = 0, release;
  globalThis.fetch = (_url, { signal, credentials }) => {
    calls++; assert.equal(credentials, 'omit');
    return new Promise((resolve, reject) => {
      release = () => resolve(new Response(JSON.stringify({params:'?key=sample&amp;rel=0'})));
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  };
  try {
    const abort = new AbortController();
    const a = getShortEmbedUrl('abcdefghijk', abort.signal);
    const b = getShortEmbedUrl('abcdefghijk');
    abort.abort(); await assert.rejects(a, { name: 'AbortError' });
    release(); const result = new URL(await b); assert.equal(result.hostname, 'www.youtubeeducation.com'); assert.equal(result.searchParams.get('key'), 'sample');
    await getShortEmbedUrl('abcdefghijk'); assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});

test('a different Short reuses the cached device configuration without another network request', async () => {
 const previous=globalThis.fetch;const calls=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response('',{status:503});};
 try{const url=new URL(await getShortEmbedUrl('lmnopqrstuv'));assert.equal(url.hostname,'www.youtubeeducation.com');assert.equal(url.searchParams.get('key'),'sample');assert.equal(calls.length,0);}finally{globalThis.fetch=previous;}
});
