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

test('failed embeds are not cached and can be retried', async () => {
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = async url => { calls++; if (String(url).includes('raw.githubusercontent.com')) return new Response('', {status: 503}); return calls === 2 ? new Response('', {status: 503}) : new Response('https://www.youtube.com/embed/lmnopqrstuv'); };
  try {
    await assert.rejects(getShortEmbedUrl('lmnopqrstuv'));
    assert.match(await getShortEmbedUrl('lmnopqrstuv'), /youtube/);
    assert.equal(calls, 4);
  } finally { globalThis.fetch = previous; }
});
