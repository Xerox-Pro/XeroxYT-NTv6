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
  const url = new URL(request.url);
  let pool: string[];
  try {
    pool = apiPool(process.env);
  } catch {
    return Response.json(
      { error: "API URLの環境変数を確認してください。" },
      { status: 503 },
    );
  }
  if (url.pathname === "/api/transport-config")
    return Response.json(
      { origins: pool },
      { headers: { "Cache-Control": "no-store" } },
    );
  if (!pool.length)
    return Response.json(
      {
        error: "API_BASE_URL_1 を設定して再デプロイしてください。",
        code: "API_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  const legacy =
    url.pathname === "/api/playback-gateway"
      ? url.searchParams.get("route")
      : null;
  const path = legacy || url.pathname;
  if (
    legacy &&
    !/^\/(stream|360|edu|scratch-edu)\/[A-Za-z0-9_-]+$/.test(legacy)
  )
    return Response.json({ error: "Invalid playback route" }, { status: 400 });
  const query = legacy ? "" : url.search;
  const headers = new Headers();
  for (const name of forwarded) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('Origin')) headers.set('Origin', url.origin);
  if (process.env.API_SHARED_SECRET) headers.set('Authorization','Bearer '+process.env.API_SHARED_SECRET);
  const deadline = Date.now() + 24000;
  const configuredPool = pool;
  pool = await apiSelector.plan(pool, headers);
  if (!pool.length) return Response.json({error:'利用できるAPIがありません。しばらくしてから再試行してください。',code:'API_UNAVAILABLE'}, {status:503,headers:{'Cache-Control':'no-store'}});
  const readonly = ["GET", "HEAD"].includes(request.method);
  const body = readonly ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > 1024 * 1024)
    return Response.json({ error: "Request too large" }, { status: 413 });
  for (let i = 0; i < pool.length; i++) {
    if (Date.now() >= deadline) break;
    try {
      const response = await fetchApiResponse(pool[i] + path + query, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        signal: request.signal,
      }, Math.min(i === pool.length - 1 ? 22000 : 12000, deadline - Date.now()));
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
        return Response.json(
          { error: "API returned an unexpected redirect" },
          { status: 502 },
        );
      }
      const outgoing = new Headers(response.headers);
      outgoing.delete("content-encoding");
      outgoing.delete("content-length");
      outgoing.set("Cache-Control", "private, no-store");
      outgoing.set("X-XeroxYT-Transport", "proxy");
      outgoing.set("X-XeroxYT-API-Index", String(configuredPool.indexOf(pool[i]) + 1));
      return new Response(response.body, {
        status: response.status,
        headers: outgoing,
      });
    } catch (error) {
      apiSelector.report(pool[i],headers,false);
      if (request.signal.aborted) throw error;
      if (!readonly || /^\/api\/(account|auth)(\/|$)/.test(path)) break;
    }
  }
  return Response.json(
    {
      error: "登録されているAPIに接続できませんでした。",
      code: "API_UNAVAILABLE",
    },
    { status: 502 },
  );
}
