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
  const readonly = ["GET", "HEAD"].includes(request.method);
  const body = readonly ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > 1024 * 1024)
    return Response.json({ error: "Request too large" }, { status: 413 });
  const deadline = Date.now() + 24000;
  for (let i = 0; i < pool.length; i++) {
    if (Date.now() >= deadline) break;
    try {
      const response = await fetch(pool[i] + path + query, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(Math.min(12000, deadline - Date.now())),
        ]),
      });
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
      outgoing.set("X-XeroxYT-API-Index", String(i + 1));
      return new Response(response.body, {
        status: response.status,
        headers: outgoing,
      });
    } catch (error) {
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
