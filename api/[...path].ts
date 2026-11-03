import {fetchApiResponse} from "../server/lib/apiRequest.mjs";
import {apiSelector} from "../server/lib/apiAvailability.mjs";
import { apiPool, canRetry } from "../server/lib/apiPool.mjs";
export const config = { runtime: "edge" };
const forwarded = [
  "accept",
  "accept-language",
  "content-type",
  "origin",
  "referer",
  "cookie",
  "authorization",
  "range",
  "x-youtube-credentials",
  "x-client-id",
  "x-usage-token",
  "x-client-usage",
];
export default async function handler(request: Request) {
  const startedAt = Date.now();
  // Keep the entire Edge invocation below its 25s first-response limit,
  // including health checks, request-body parsing and upstream retries.
  const deadline = startedAt + 18000;
  const url = new URL(request.url);
  const routeName = '/' + url.pathname.split('/').filter(Boolean).slice(0, 3).map((part, index) => index === 2 && part !== 'batch' ? ':id' : part).join('/');
  let attempts = 0;
  let upstreamIndex = 0;
  const respond = (response: Response, reason?: string) => {
    const fields = {event: 'api_request', operation: routeName, method: request.method, status: response.status, durationMs: Date.now() - startedAt, attempts, upstreamIndex, ...(reason ? {reason} : {})};
    if (response.status >= 500) console.warn(JSON.stringify(fields));
    else console.info(JSON.stringify(fields));
    return response;
  };
  let pool: string[];
  try {
    pool = apiPool(process.env);
  } catch {
    return respond(Response.json(
      { error: "API URLの環境変数を確認してください。" },
      { status: 503 },
    ), 'invalid_api_config');
  }
  if (url.pathname === "/api/transport-config")
    return respond(Response.json(
      { origins: pool },
      { headers: { "Cache-Control": "no-store" } },
    ));
  if (!pool.length)
    return respond(Response.json(
      {
        error: "API_BASE_URL_1 を設定して再デプロイしてください。",
        code: "API_NOT_CONFIGURED",
      },
      { status: 503 },
    ), 'api_not_configured');
  const legacy =
    url.pathname === "/api/playback-gateway"
      ? url.searchParams.get("route")
      : null;
  const path = legacy || url.pathname;
  if (
    legacy &&
    !/^\/(stream|360|edu|scratch-edu)\/[A-Za-z0-9_-]+$/.test(legacy)
  )
    return respond(Response.json({ error: "Invalid playback route" }, { status: 400 }));
  const query = legacy ? "" : url.search;
  const headers = new Headers();
  for (const name of forwarded) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('Origin')) headers.set('Origin', url.origin);
  if (process.env.API_SHARED_SECRET) headers.set('Authorization','Bearer '+process.env.API_SHARED_SECRET);
  const configuredPool = pool;
  pool = await apiSelector.plan(pool, headers);
  if (!pool.length) return respond(Response.json({error:'利用できるAPIがありません。しばらくしてから再試行してください。',code:'API_UNAVAILABLE'}, {status:503,headers:{'Cache-Control':'no-store'}}), 'health_check_failed');
  const readonly = ["GET", "HEAD"].includes(request.method);
  const body = readonly ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > 1024 * 1024)
    return respond(Response.json({ error: "Request too large" }, { status: 413 }));
  let lastFailure = 'upstream_unavailable';
  for (let i = 0; i < pool.length; i++) {
    if (Date.now() >= deadline) break;
    attempts++;
    upstreamIndex = configuredPool.indexOf(pool[i]) + 1;
    try {
      const response = await fetchApiResponse(pool[i] + path + query, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        signal: request.signal,
      }, Math.max(1, Math.min(8000, deadline - Date.now())));
      if ([408,429,500,502,503,504].includes(response.status)) apiSelector.report(pool[i],headers,false);
      else if (response.ok) apiSelector.report(pool[i],headers,true);
      if (
        canRetry(request.method, path, response.status) &&
        i < pool.length - 1
      ) {
        await response.body?.cancel();
        continue;
      }
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        return respond(Response.json(
          { error: "API returned an unexpected redirect" },
          { status: 502 },
        ), 'upstream_redirect');
      }
      const outgoing = new Headers(response.headers);
      outgoing.delete("content-encoding");
      outgoing.delete("content-length");
      outgoing.set("Cache-Control", "private, no-store");
      outgoing.set("X-XeroxYT-Transport", "proxy");
      outgoing.set("X-XeroxYT-API-Index", String(configuredPool.indexOf(pool[i]) + 1));
      return respond(new Response(response.body, {
        status: response.status,
        headers: outgoing,
      }));
    } catch (error) {
      lastFailure = error instanceof Error ? error.name : 'upstream_error';
      console.warn(JSON.stringify({event:'api_upstream_failure',operation:routeName,method:request.method,upstreamIndex,durationMs:Date.now()-startedAt,reason:lastFailure}));
      apiSelector.report(pool[i],headers,false);
      if (request.signal.aborted) throw error;
      if (!readonly || /^\/api\/(account|auth)(\/|$)/.test(path)) break;
    }
  }
  return respond(Response.json(
    {
      error: "登録されているAPIに接続できませんでした。",
      code: Date.now() >= deadline ? "API_TIMEOUT" : "API_UNAVAILABLE",
    },
    { status: Date.now() >= deadline ? 504 : 502, headers: {'Cache-Control':'no-store'} },
  ), lastFailure);
}
