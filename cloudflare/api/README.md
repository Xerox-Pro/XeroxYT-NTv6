# XeroxYT v6 Workers API migration

Deployed candidate: https://xeroxyt-v6-api.2026-97th.workers.dev

Status: candidate only; production traffic has NOT been switched. The current Workers Free account intermittently terminates heavier requests with HTTP 503 / Cloudflare 1102. An attempted CPU limit update was rejected with API error 100328: CPU limits are not supported for the Free plan. Do not treat successful individual responses as a reliability guarantee.

## Implementation

`npm run build:cloudflare-api` adapts the existing `server.ts` into a request-scoped Express application and bundles it with its Shorts and download modules. All existing route handlers are retained, including legacy sync's deliberate 410 response. Build adaptation removes Vite/static file serving, background timers, startup warmup and embedded RapidAPI key fallbacks. Guard checks reject unadapted startup code.

The Worker uses the documented Cloudflare Node HTTP adapter. youtubei.js uses its cf-worker platform entry point with preserved class names and request-local clients. Account and media calls use service bindings to the existing `xeroxyt-account` and `xeroxyt-stream-proxy` Workers. No existing user database was replaced. OAuth device-flow state is stored in D1 instead of process memory.

Video downloading has been removed at the user’s request: the player download button, browser FFmpeg code/dependencies, download API handlers and media tests are deleted. The candidate explicitly returns HTTP 410 / DOWNLOAD_REMOVED for former download endpoints. Streaming playback remains available.

## Build and deployment

```sh
npm ci
npm run build:cloudflare-api
npx wrangler d1 execute xeroxyt-accounts --remote --file cloudflare/api/schema.sql --config cloudflare/api/wrangler.jsonc
npx wrangler deploy --config cloudflare/api/wrangler.jsonc --dry-run
npm run deploy:cloudflare-api
```

Configure optional `GEMINI_API_KEY` with Wrangler or the dashboard for AI Studio. No key was available in the linked Vercel environment; the endpoint returns 503 / GEMINI_NOT_CONFIGURED until configured. RapidAPI is no longer used.

After resolving reliability and completing acceptance testing, `vercel-routing.json` is a proposed replacement for root `vercel.json`: the frontend remains on Vercel while API/stream requests proxy to Workers on the same browser origin. Do not change frontend fetch URLs directly to workers.dev: host-scoped session cookies would not follow.

## Verification (2026-11-02, JST)

- Automated suite: 45/45 tests (download-specific tests removed) passed after the ranking compatibility change. `npm run lint` passed.
- Wrangler build and dry-run upload succeeded.
- Created an isolated test account through the existing registration endpoint; authenticated calls used its session.
- Successful live responses: health, limits, account history, search, channel search, suggestions, trending, recommendations, category recommendations, full video metadata, comments, related videos, channel metadata, channel search, channel videos page 2, channel Shorts, Shorts discovery/details, education key, stream URL, separate video/audio formats, OAuth device-code initiation.
- Non-live video's chat correctly returned `{available:false}`; an active/replay chat was not verified.
- YouTube account subscription endpoint correctly returned 401 without Google credentials. Google user approval, token completion, liked videos, subscriptions, history, playlists and notifications remain unverified end-to-end.
- A deliberately unavailable playlist failed; an uploads playlist returned 200 with no items. A populated playlist and page continuations still require verification.
- Shorts ranking returned 200 with real entries after the compatibility fix. It required `redirect:manual` because Workers rejects `redirect:error`. Non-OK redirects remain rejected without following them.
- Repeated tests reproduced 1102 across several heavier routes on Workers Free. Some successful channel requests used over 100 ms CPU. No paid subscription was activated.

Video and audio each returned HTTP 206 for a real 0–1023 byte media request. Full-file download and browser-side FFmpeg merging were not tested.

Production cutover is blocked on CPU reliability, missing Gemini configuration if AI Studio is required, and signed-in Google feature acceptance tests. Keep the existing production API until those are resolved.

Limits: https://developers.cloudflare.com/workers/platform/limits/
Express adapter: https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/

## Test URLs

Public health: `/health`. All `/api/` data endpoints require a site session cookie on the candidate hostname. Production Vercel cookies do not apply to workers.dev. Use `POST /api/account/login` with JSON username/password and an allowed Origin to obtain a candidate-host session before testing. Do not disable authentication for smoke tests.
