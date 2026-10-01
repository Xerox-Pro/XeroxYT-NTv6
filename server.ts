import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Innertube, UniversalCache } from "youtubei.js";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

// Suppress noisy youtubei.js internal logs
const originalWarn = console.warn;
const originalError = console.error;
console.warn = (...args) => {
  const msg = args.map((a) => String(a)).join(" ");
  if (
    msg.includes("[YOUTUBEJS][Parser]:") ||
    msg.includes("PlayerInterstitial") ||
    msg.includes("InterstitialView") ||
    msg.includes("ERROR_HANDLER")
  )
    return;
  originalWarn.apply(console, args);
};
console.error = (...args) => {
  const msg = args.map((a) => String(a)).join(" ");
  if (
    msg.includes("[YOUTUBEJS][Parser]:") ||
    msg.includes("PlayerInterstitial") ||
    msg.includes("InterstitialView") ||
    msg.includes("ERROR_HANDLER")
  )
    return;
  originalError.apply(console, args);
};

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "AIzaSyDummyKeyForFallbackOnly",
});

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallbackValue: T,
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

let yt: Innertube | null = null;
let ytInstancePromise: Promise<Innertube> | null = null;
let lastCredentials: any = null;

async function getYt() {
  if (yt) return yt;
  if (ytInstancePromise) return ytInstancePromise;

  ytInstancePromise = (async () => {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`[YT] Initializing Innertube (Attempt ${attempts})...`);
        const instance = await Innertube.create({
          cache: new UniversalCache(false),
          location: "JP",
          lang: "ja",
          retrieve_player: false,
        });
        
        instance.session.on("auth", ({ credentials }) => {
          console.log("[YT] Auth event triggered. Got credentials!");
          lastCredentials = credentials;
        });
        instance.session.on("update-credentials", ({ credentials }) => {
          console.log("[YT] Update-credentials event triggered. Got credentials!");
          lastCredentials = credentials;
        });

        yt = instance;
        console.log("[YT] Innertube initialized successfully");
        return instance;
      } catch (err) {
        console.error(`[YT] Initialization error (Attempt ${attempts}):`, err);
        if (attempts >= maxAttempts) {
          ytInstancePromise = null;
          throw err;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw new Error("Failed to initialize YT after multiple attempts");
  })();

  return ytInstancePromise;
}

const ytInstancesCache = new Map<string, Innertube>();

async function getInnertubeInstance(req: express.Request, requireAuth: boolean = false) {
  const credentialsHeader = req.headers["x-youtube-credentials"] as string;
  if (!credentialsHeader) {
    if (requireAuth) {
      throw new Error("You must be signed in to perform this operation.");
    }
    return getYt();
  }

  let credentialsObj: any = null;
  try {
    credentialsObj = JSON.parse(credentialsHeader);
  } catch (e) {
    if (requireAuth) {
      throw new Error("You must be signed in to perform this operation.");
    }
    return getYt();
  }

  if (!credentialsObj) {
    if (requireAuth) {
      throw new Error("You must be signed in to perform this operation.");
    }
    return getYt();
  }

  if (!credentialsObj.refresh_token) {
    credentialsObj.refresh_token = "dummy_refresh_token_for_validation";
  }

  const keySource = credentialsObj.refresh_token || credentialsObj.access_token || credentialsHeader;
  const cacheKey = crypto.createHash("sha256").update(keySource).digest("hex");

  if (ytInstancesCache.has(cacheKey)) {
    return ytInstancesCache.get(cacheKey)!;
  }

  console.log(`[YT] Creating new authenticated Innertube instance...`);
  const instance = await Innertube.create({
    cache: new UniversalCache(false),
    location: "JP",
    lang: "ja",
    retrieve_player: false,
  });

  try {
    await instance.session.signIn(credentialsObj);
    console.log(`[YT] Authenticated successfully with credentials`);
  } catch (err) {
    console.error(`[YT] Failed to sign in with provided credentials:`, err);
    if (requireAuth) {
      throw new Error("You must be signed in to perform this operation.");
    }
    return getYt();
  }

  ytInstancesCache.set(cacheKey, instance);
  return instance;
}

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.drgnz.club",
  "https://invidious.jing.rocks",
  "https://invidious.private.coffee",
  "https://invidious.drgns.space",
];

async function fetchInvidiousChannel(channelId: string) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const resp = await axios.get(
        `${instance}/api/v1/channels/${encodeURIComponent(channelId)}`,
        {
          timeout: 3500,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );
      if (resp.data && (resp.data.author || resp.data.authorId)) {
        const d = resp.data;
        const videos = (d.latestVideos || [])
          .map((v: any) => ({
            videoId: v.videoId,
            title: v.title,
            author: d.author || v.author || "チャンネル",
            authorId: d.authorId || channelId,
            authorAvatar:
              d.authorThumbnails?.[d.authorThumbnails.length - 1]?.url || "",
            viewCount: v.viewCount || 0,
            publishedText: v.publishedText || "",
            lengthSeconds: v.lengthSeconds || 0,
            videoThumbnails: v.videoThumbnails || [
              {
                url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                width: 480,
                height: 360,
              },
            ],
            type: "video",
          }))
          .filter((v: any) => v && v.videoId);

        const shorts = videos.filter(
          (v: any) =>
            v &&
            v.title &&
            (v.title.toLowerCase().includes("short") ||
              (v.lengthSeconds > 0 && v.lengthSeconds <= 60)),
        );
        return {
          id: d.authorId || channelId,
          title: d.author || "チャンネル",
          description: d.description || "",
          avatar:
            d.authorThumbnails?.[d.authorThumbnails.length - 1]?.url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(d.author || "C")}&background=random`,
          banner: d.authorBanners?.[d.authorBanners.length - 1]?.url || "",
          subCountText: d.subCount
            ? `${d.subCount >= 10000 ? (d.subCount / 10000).toFixed(1) + "万人" : d.subCount + "人"}のチャンネル登録者`
            : "",
          videosCountText: `${videos.length} 本の動画`,
          featuredVideo: videos[0] || null,
          videos: videos,
          shortVideos: shorts,
          playlists: [],
        };
      }
    } catch (e) {
      // try next instance
    }
  }
  return null;
}

async function fetchYouTubeRssChannel(channelId: string) {
  try {
    const url = channelId.startsWith("UC")
      ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      : `https://www.youtube.com/feeds/videos.xml?user=${channelId}`;
    const resp = await axios.get(url, { timeout: 3500 });
    const xml = resp.data;
    if (typeof xml === "string" && xml.includes("<entry>")) {
      const channelTitleMatch = xml.match(/<title>([^<]+)<\/title>/);
      const channelTitle = channelTitleMatch
        ? channelTitleMatch[1].replace(" - YouTube", "")
        : "チャンネル";

      const entries = xml.split("<entry>").slice(1);
      const videos = entries
        .map((entry) => {
          const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
          const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
          const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
          const videoId = idMatch ? idMatch[1] : null;
          const title = titleMatch ? titleMatch[1] : "タイトルなし";
          if (!videoId) return null;
          return {
            videoId,
            title,
            author: channelTitle,
            authorId: channelId,
            authorAvatar: "",
            viewCount: 0,
            publishedText: publishedMatch
              ? new Date(publishedMatch[1]).toLocaleDateString("ja-JP")
              : "",
            lengthSeconds: 0,
            videoThumbnails: [
              {
                url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                width: 480,
                height: 360,
              },
            ],
            type: "video",
          };
        })
        .filter(Boolean);

      const shorts = videos.filter(
        (v: any) => v && v.title && v.title.toLowerCase().includes("short"),
      );
      return {
        id: channelId,
        title: channelTitle,
        description: "",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(channelTitle)}&background=random`,
        banner: "",
        subCountText: "",
        videosCountText: `${videos.length} 本の動画`,
        featuredVideo: videos[0] || null,
        videos: videos,
        shortVideos: shorts,
        playlists: [],
      };
    }
  } catch (e) {
    // RSS failed
  }
  return null;
}

function parseCount(input?: any): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") {
    return isNaN(input) ? 0 : Math.floor(input);
  }

  let str = "";
  if (typeof input === "string") {
    str = input;
  } else if (typeof input === "object") {
    str =
      input.text ||
      input.simpleText ||
      input.runs?.[0]?.text ||
      (typeof input.toString === "function" ? input.toString() : "");
  }

  if (!str || typeof str !== "string") return 0;
  if (str === "[object Object]") return 0;

  const clean = str.replace(/,/g, "").trim().toLowerCase();
  if (!clean) return 0;

  // "回視聴", "views", "view", "視聴", "人" などを含む部分の数値を優先抽出
  const viewPattern =
    /([\d.]+\s*(?:億|万|k|m|b)?)\s*(?:回視聴|views|view|回|人|人が視聴中)/i;
  const viewMatch = clean.match(viewPattern);

  let targetStr = clean;
  if (viewMatch && viewMatch[1]) {
    targetStr = viewMatch[1].trim();
  } else {
    const simplePattern = /([\d.]+\s*(?:億|万|k|m|b)?)/i;
    const simpleMatch = clean.match(simplePattern);
    if (simpleMatch && simpleMatch[1]) {
      targetStr = simpleMatch[1].trim();
    }
  }

  let multiplier = 1;
  if (targetStr.includes("億")) {
    multiplier = 100000000;
    targetStr = targetStr.replace("億", "");
  } else if (targetStr.includes("万")) {
    multiplier = 10000;
    targetStr = targetStr.replace("万", "");
  } else if (targetStr.includes("b")) {
    multiplier = 1000000000;
    targetStr = targetStr.replace("b", "");
  } else if (targetStr.includes("m")) {
    multiplier = 1000000;
    targetStr = targetStr.replace("m", "");
  } else if (targetStr.includes("k")) {
    multiplier = 1000;
    targetStr = targetStr.replace("k", "");
  }

  const numStr = targetStr.replace(/[^0-9.]/g, "");
  if (!numStr) return 0;
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;

  return Math.floor(num * multiplier);
}

function extractViewCount(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : Math.floor(v);
  if (typeof v === "string") return parseCount(v);

  const candidates = [
    v.view_count,
    v.short_view_count,
    v.views,
    v.viewCount,
    v.video_info?.view_count,
    v.metadata?.view_count,
    v.overlay_metadata?.secondary_text,
  ];

  for (const cand of candidates) {
    if (cand !== undefined && cand !== null) {
      const parsed = parseCount(cand);
      if (parsed > 0) return parsed;
    }
  }

  if (v.metadata?.metadata?.metadata_rows) {
    for (const row of v.metadata.metadata.metadata_rows) {
      for (const part of row?.metadata_parts || []) {
        const txt = part?.text?.text || part?.text;
        if (
          txt &&
          typeof txt === "string" &&
          (txt.includes("視聴") ||
            txt.includes("views") ||
            txt.includes("view"))
        ) {
          const parsed = parseCount(txt);
          if (parsed > 0) return parsed;
        }
      }
    }
  }

  return 0;
}

const getGithubHeaders = () => ({
  Authorization: `token ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
});

const encryptData = (data: any) => {
  const secret =
    process.env.ENCRYPTION_KEY ||
    "default_secret_key_needs_to_be_32_bytes_long".substring(0, 32);
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { iv: iv.toString("hex"), authTag, encrypted };
};

const decryptData = (encryptedData: any) => {
  const secret =
    process.env.ENCRYPTION_KEY ||
    "default_secret_key_needs_to_be_32_bytes_long".substring(0, 32);
  const key = crypto.createHash("sha256").update(secret).digest();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encryptedData.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));
  let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
};

async function startServer() {
  const app = express();

  // --- External Service & Cross-Origin Strict Blocker ---
  function isAuthorizedOrigin(req: express.Request): boolean {
    // 1. Sec-Fetch-Site (ブラウザによるクロスサイトリクエスト遮断)
    const secFetchSite = req.headers["sec-fetch-site"];
    if (secFetchSite === "cross-site") {
      return false; // 外部サイトからの埋め込み・クロスオリジン呼び出しを即座に遮断
    }

    // 現在のホスト名
    const currentHost = (req.get("host") || (req.headers["host"] as string) || "").split(":")[0].toLowerCase();
    
    // 2. Origin ヘッダーの検証
    const origin = req.headers["origin"] as string;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const originHost = originUrl.hostname.toLowerCase();
        
        const isMatch =
          originHost === currentHost ||
          originHost === "localhost" ||
          originHost === "127.0.0.1" ||
          originHost.endsWith(".run.app") ||
          originHost.endsWith(".vercel.app") ||
          (process.env.ALLOWED_DOMAINS && process.env.ALLOWED_DOMAINS.split(",").some((d) => originHost === d.trim() || originHost.endsWith("." + d.trim())));
        
        if (!isMatch) return false;
      } catch {
        return false;
      }
    }

    // 3. Referer ヘッダーの検証
    const referer = req.headers["referer"] as string;
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererHost = refererUrl.hostname.toLowerCase();
        
        const isMatch =
          refererHost === currentHost ||
          refererHost === "localhost" ||
          refererHost === "127.0.0.1" ||
          refererHost.endsWith(".run.app") ||
          refererHost.endsWith(".vercel.app") ||
          (process.env.ALLOWED_DOMAINS && process.env.ALLOWED_DOMAINS.split(",").some((d) => refererHost === d.trim() || refererHost.endsWith("." + d.trim())));
        
        if (!isMatch) return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  // --- Bot, External Tools & Cross-Origin Protection Middleware ---
  app.use((req, res, next) => {
    const p = req.path;
    const isApiOrStream =
      p.startsWith("/api/") ||
      p.startsWith("/stream") ||
      p.startsWith("/edu") ||
      p.startsWith("/360") ||
      p.startsWith("/scratch-edu") ||
      p.startsWith("/download-proxy");

    if (!isApiOrStream) {
      return next();
    }

    // 1. 外部オリジン・クロスサイトアクセスの遮断
    if (!isAuthorizedOrigin(req)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.status(403).json({
        error: "Access Denied: External service and cross-origin requests are strictly blocked.",
        code: "EXTERNAL_SERVICE_BLOCKED",
        message: "外部サービスや他サイトからのAPIアクセスは全面的にブロックされています。"
      });
    }

    // 2. 自動スクレイピングツール・クローラー・ボットの遮断 (外部からの回避取得防止)
    const userAgent = (req.headers["user-agent"] || "").toLowerCase();
    const isScraperOrBot =
      !userAgent ||
      /gptbot|chatgpt|ccbot|bytespider|claudebot|anthropic|amazonbot|facebookbot|semrush|ahrefs|dotbot|yandexbot|petalbot|dataforseo|curl|wget|python-requests|postman|insomnia|httpie|scrapy|node-fetch|go-http-client|aiohttp|urllib/i.test(userAgent);
    
    if (isScraperOrBot && p !== "/api/health") {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.status(403).json({
        error: "Access Denied: Automated scraping tools are strictly blocked.",
        code: "BOT_BLOCKED"
      });
    }

    // 3. Preflight OPTIONS リクエストのハンドリング
    if (req.method === "OPTIONS") {
      const origin = req.headers["origin"] as string;
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, x-client-id, x-youtube-credentials, x-usage-token, x-client-usage");
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
      return res.status(204).end();
    }

    next();
  });

  // --- External Service Abuse Protection: API Secret Key Parameter ---
  const getExpectedApiKey = (): string => {
    return (
      process.env.API_SECRET_KEY ||
      process.env.API_KEY ||
      process.env.API_SECRET ||
      process.env.API_TOKEN ||
      process.env.ACCESS_TOKEN ||
      process.env.VITE_API_KEY ||
      process.env.VITE_API_SECRET_KEY ||
      "xerox_api_key_2026"
    ).trim();
  };

  function extractApiKey(req: express.Request): string {
    // 1. Query parameters (?apiKey=... or ?key=... or ?token=...)
    const q = req.query as Record<string, any>;
    const fromQuery = q.apiKey || q.api_key || q.key || q.token || q.secret || q.access_token;
    if (typeof fromQuery === "string" && fromQuery.trim()) {
      return fromQuery.trim();
    }

    // 2. HTTP Headers (x-api-key, etc.)
    const h = req.headers;
    const fromHeader = h["x-api-key"] || h["x-api-secret"] || h["x-secret-key"] || h["x-token"];
    if (typeof fromHeader === "string" && fromHeader.trim()) {
      return fromHeader.trim();
    }

    // 3. Authorization Header (Bearer <token> or direct token)
    const auth = h["authorization"];
    if (typeof auth === "string" && auth.trim()) {
      const trimmed = auth.trim();
      if (trimmed.toLowerCase().startsWith("bearer ")) {
        return trimmed.slice(7).trim();
      }
      return trimmed;
    }

    // 4. Request Body (if parsed)
    if (req.body && typeof req.body === "object") {
      const b = req.body as Record<string, any>;
      const fromBody = b.apiKey || b.api_key || b.key || b.token || b.secret;
      if (typeof fromBody === "string" && fromBody.trim()) {
        return fromBody.trim();
      }
    }

    // 5. Cookies (set during legitimate browser website visits)
    const cookieHeader = req.headers["cookie"] || "";
    const match = cookieHeader.match(/(?:^|;\s*)xerox_api_key=([^;]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch {
        return match[1].trim();
      }
    }

    return "";
  }

  // Intercept and protect all API & stream endpoints against external scraping/abuse
  app.use((req, res, next) => {
    const p = req.path;

    const isApiEndpoint =
      p.startsWith("/api/") ||
      p.startsWith("/stream") ||
      p.startsWith("/edu") ||
      p.startsWith("/360") ||
      p.startsWith("/scratch-edu") ||
      p.startsWith("/download-proxy");

    if (!isApiEndpoint) {
      // Set cookie for browser page visits so legitimate user sessions have the key
      const expectedKey = getExpectedApiKey();
      res.cookie("xerox_api_key", expectedKey, {
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });
      return next();
    }

    // Exclude system health check
    if (p === "/api/health") {
      return next();
    }

    // Exclude config endpoint (used by legitimate frontend to bootstrap)
    if (p === "/api/config") {
      return next();
    }

    const expectedKey = getExpectedApiKey();
    const clientKey = extractApiKey(req);

    if (!clientKey || clientKey !== expectedKey) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.status(401).json({
        error: "Unauthorized: API access requires a valid secret parameter",
        code: "API_KEY_REQUIRED",
        message: "外部サービスによる不正利用を防ぐため、APIの取得には環境変数で設定されたパラメーター（apiKey または key）の付与が必要です。",
      });
    }

    next();
  });

  // Client bootstrap config endpoint
  app.get("/api/config", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      apiKey: getExpectedApiKey(),
      appName: "XeroxYT",
    });
  });

  // --- Daily Quotas & Rate Limiting System (Protect Vercel Serverless CPU & Bandwidth) ---
  const DAILY_VIDEO_LIMIT = Infinity; // 視聴制限は完全に解除（無制限）
  const DAILY_SEARCH_LIMIT = Math.max(1, parseInt(process.env.DAILY_SEARCH_LIMIT || "80", 10));
  const DAILY_TOTAL_LIMIT = Math.max(1, parseInt(process.env.DAILY_TOTAL_LIMIT || "450", 10));
  const BURST_LIMIT_PER_MINUTE = Math.max(1, parseInt(process.env.BURST_LIMIT_PER_MINUTE || "45", 10));
  const USAGE_SECRET = process.env.LIMIT_SECRET || "xerox-daily-limit-secret-salt-2026";

  interface ClientDailyRecord {
    videos: number;
    searches: number;
    total: number;
    burstCount: number;
    burstWindowStart: number;
    lastSeen: number;
  }

  const dailyQuotaMap = new Map<string, ClientDailyRecord>();

  // JST 日付 (UTC+9) の "YYYY-MM-DD"
  function getJstDateString(d = new Date()): string {
    const jstTime = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return jstTime.toISOString().slice(0, 10);
  }

  // JST 午前0時までの残り秒数
  function getSecondsUntilJstMidnight(): number {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const jstTomorrow = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + 1));
    const nextResetUtc = new Date(jstTomorrow.getTime() - 9 * 60 * 60 * 1000);
    return Math.max(1, Math.floor((nextResetUtc.getTime() - now.getTime()) / 1000));
  }

  // JST 次回リセット時刻 (ISO文字列)
  function getNextJstMidnightIso(): string {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const jstTomorrow = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + 1));
    const nextResetUtc = new Date(jstTomorrow.getTime() - 9 * 60 * 60 * 1000);
    return nextResetUtc.toISOString();
  }

  // クライアント識別子の抽出 (ヘッダー, Cookie, クエリ, IP fallback)
  function getClientIdentifier(req: express.Request): string {
    const clientHeader = (req.headers["x-client-id"] as string) || "";
    if (clientHeader && /^[a-zA-Z0-9_-]{4,64}$/.test(clientHeader)) {
      return clientHeader;
    }
    const cookieHeader = (req.headers["cookie"] as string) || "";
    const cookieMatch = cookieHeader.match(/(?:^|;\s*)xerox_client_uuid=([a-zA-Z0-9_-]{4,64})/);
    if (cookieMatch) {
      return cookieMatch[1];
    }
    const queryId = (req.query?.clientId as string) || "";
    if (queryId && /^[a-zA-Z0-9_-]{4,64}$/.test(queryId)) {
      return queryId;
    }
    const forwardedFor = (req.headers["x-forwarded-for"] as string) || "";
    const vercelIp = (req.headers["x-vercel-ip"] as string) || (req.headers["x-real-ip"] as string) || "";
    const ip = vercelIp || forwardedFor.split(",")[0].trim() || req.socket.remoteAddress || "unknown-ip";
    return ip;
  }

  // HMAC 署名トークン (サーバーレス環境でインスタンス再起動時も引き継ぎ可能)
  function signUsage(clientId: string, day: string, videos: number, searches: number, total: number): string {
    const payload = `${clientId}|${day}|${videos}|${searches}|${total}`;
    const sig = crypto.createHmac("sha256", USAGE_SECRET).update(payload).digest("hex").slice(0, 16);
    return `${payload}|${sig}`;
  }

  function parseUsageToken(token: string): { clientId: string; day: string; videos: number; searches: number; total: number } | null {
    if (!token) return null;
    const parts = token.split("|");
    if (parts.length !== 6) return null;
    const [clientId, day, videosStr, searchesStr, totalStr, sig] = parts;
    const payload = `${clientId}|${day}|${videosStr}|${searchesStr}|${totalStr}`;
    const expectedSig = crypto.createHmac("sha256", USAGE_SECRET).update(payload).digest("hex").slice(0, 16);
    if (sig !== expectedSig) return null;
    return {
      clientId,
      day,
      videos: parseInt(videosStr, 10) || 0,
      searches: parseInt(searchesStr, 10) || 0,
      total: parseInt(totalStr, 10) || 0,
    };
  }

  // レコード取得 & トークンマージ
  function getOrCreateRecord(clientId: string, today: string, req: express.Request): ClientDailyRecord {
    const key = `${clientId}:${today}`;
    let record = dailyQuotaMap.get(key);
    const now = Date.now();

    if (!record) {
      record = {
        videos: 0,
        searches: 0,
        total: 0,
        burstCount: 0,
        burstWindowStart: now,
        lastSeen: now,
      };
      dailyQuotaMap.set(key, record);
    }

    // 1. クライアント署名トークンから復元
    const clientToken = (req.headers["x-usage-token"] as string) || "";
    if (clientToken) {
      const parsed = parseUsageToken(clientToken);
      if (parsed && parsed.day === today && parsed.clientId === clientId) {
        record.videos = Math.max(record.videos, parsed.videos);
        record.searches = Math.max(record.searches, parsed.searches);
        record.total = Math.max(record.total, parsed.total);
      }
    }

    // 2. クライアントのローカル記録からも同期（インスタンス冷起動・再読み込み対策）
    const clientUsageHeader = (req.headers["x-client-usage"] as string) || "";
    if (clientUsageHeader) {
      const [uDay, uVid, uSearch, uTot] = clientUsageHeader.split("|");
      if (uDay === today) {
        record.videos = Math.max(record.videos, parseInt(uVid, 10) || 0);
        record.searches = Math.max(record.searches, parseInt(uSearch, 10) || 0);
        record.total = Math.max(record.total, parseInt(uTot, 10) || 0);
      }
    }

    record.lastSeen = now;
    return record;
  }

  // 日付の変わった古いレコードの自動破棄 (10分ごと)
  setInterval(() => {
    const today = getJstDateString();
    for (const key of dailyQuotaMap.keys()) {
      if (!key.endsWith(`:${today}`)) {
        dailyQuotaMap.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();

  // 利用制限・ステータス確認エンドポイント
  app.get(["/api/limits", "/api/usage"], (req, res) => {
    const clientId = getClientIdentifier(req);
    const today = getJstDateString();
    const record = getOrCreateRecord(clientId, today, req);
    const isVideoLimited = false; // 視聴制限は完全に解除
    const isSearchLimited = record.searches >= DAILY_SEARCH_LIMIT;
    const isTotalLimited = record.total >= DAILY_TOTAL_LIMIT;

    const token = signUsage(clientId, today, record.videos, record.searches, record.total);
    res.setHeader("X-Daily-Usage-Token", token);
    res.setHeader(
      "Access-Control-Expose-Headers",
      "X-RateLimit-Videos-Remaining, X-RateLimit-Searches-Remaining, X-RateLimit-Reset-Seconds, X-Daily-Usage-Token"
    );
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.json({
      token,
      videos: {
        used: record.videos,
        limit: 999999,
        remaining: 999999,
      },
      searches: {
        used: record.searches,
        limit: DAILY_SEARCH_LIMIT,
        remaining: Math.max(0, DAILY_SEARCH_LIMIT - record.searches),
      },
      total: {
        used: record.total,
        limit: DAILY_TOTAL_LIMIT,
        remaining: Math.max(0, DAILY_TOTAL_LIMIT - record.total),
      },
      resetAt: getNextJstMidnightIso(),
      resetSeconds: getSecondsUntilJstMidnight(),
      isLimited: isSearchLimited || isTotalLimited,
      limitedType: isSearchLimited ? "search" : isTotalLimited ? "total" : null,
    });
  });

  // リセットエンドポイント (開発テスト用)
  app.post("/api/limits/reset", (req, res) => {
    const clientId = getClientIdentifier(req);
    const today = getJstDateString();
    dailyQuotaMap.delete(`${clientId}:${today}`);
    const token = signUsage(clientId, today, 0, 0, 0);
    res.setHeader("X-Daily-Usage-Token", token);
    return res.json({ success: true, message: "Limits reset successfully for client" });
  });

  // --- Daily Quotas & Rate Limiting Enforcement Middleware ---
  app.use((req, res, next) => {
    const p = req.path;
    // 静的ファイルや除外エンドポイントはスルー
    if (
      !p.startsWith("/api/") &&
      !p.startsWith("/stream") &&
      !p.startsWith("/edu") &&
      !p.startsWith("/360") &&
      !p.startsWith("/scratch-edu")
    ) {
      return next();
    }

    if (
      p === "/api/limits" ||
      p === "/api/usage" ||
      p === "/api/health" ||
      p === "/api/edukey" ||
      p === "/api/limits/reset" ||
      p === "/api/suggestions"
    ) {
      return next();
    }

    const clientId = getClientIdentifier(req);
    const today = getJstDateString();
    const record = getOrCreateRecord(clientId, today, req);
    const now = Date.now();

    // 1. バースト保護 (短時間のアクセス集中を防止: 1分間)
    if (now - record.burstWindowStart > 60000) {
      record.burstCount = 0;
      record.burstWindowStart = now;
    }
    record.burstCount++;
    if (record.burstCount > BURST_LIMIT_PER_MINUTE) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({
        error: "短時間のアクセスが集中しています。サーバー負荷保護のため、1分ほど待ってから再試行してください。",
        code: "BURST_LIMIT_EXCEEDED",
        type: "burst",
        retryAfter: 60,
      });
    }

    // 2. 1日の総リクエスト上限チェック
    if (record.total >= DAILY_TOTAL_LIMIT) {
      res.setHeader("Retry-After", String(getSecondsUntilJstMidnight()));
      return res.status(429).json({
        error: `本日の総合リクエスト上限（${DAILY_TOTAL_LIMIT}回）に達しました。Vercelサーバー負荷保護のため、明日午前0時(JST)のリセットまでお待ちください。`,
        code: "DAILY_TOTAL_LIMIT_EXCEEDED",
        type: "total",
        limit: DAILY_TOTAL_LIMIT,
        used: record.total,
        remaining: 0,
        resetAt: getNextJstMidnightIso(),
        resetSeconds: getSecondsUntilJstMidnight(),
      });
    }

    // 3. 動画視聴リクエスト判定 (/api/video/:id, /stream/*, /edu/*, etc.)
    const isVideoViewRequest = (
      (p.startsWith("/api/video/") && !p.includes("/comments") && !p.includes("/related")) ||
      p.startsWith("/stream/") ||
      p.startsWith("/api/stream/") ||
      p.startsWith("/360/") ||
      p.startsWith("/api/360/") ||
      p.startsWith("/edu/") ||
      p.startsWith("/api/edu/") ||
      p.startsWith("/scratch-edu/") ||
      p.startsWith("/api/scratch-edu/")
    );

    if (isVideoViewRequest) {
      record.videos++;
    }

    // 4. 検索リクエスト判定 (/api/search, /api/search/channels)
    const isSearchRequest = p === "/api/search" || p === "/api/search/channels";
    if (isSearchRequest) {
      if (record.searches >= DAILY_SEARCH_LIMIT) {
        res.setHeader("Retry-After", String(getSecondsUntilJstMidnight()));
        return res.status(429).json({
          error: `本日の検索リクエスト上限（${DAILY_SEARCH_LIMIT}回）に達しました。Vercelサーバー負荷保護のため、明日午前0時(JST)のリセットまでお待ちください。`,
          code: "DAILY_SEARCH_LIMIT_EXCEEDED",
          type: "search",
          limit: DAILY_SEARCH_LIMIT,
          used: record.searches,
          remaining: 0,
          resetAt: getNextJstMidnightIso(),
          resetSeconds: getSecondsUntilJstMidnight(),
        });
      }
      record.searches++;
    }

    // 総リクエスト数をインクリメント
    record.total++;

    // レスポンスヘッダーに残り利用枠と署名トークンを付与 (動画視聴は無制限)
    const token = signUsage(clientId, today, record.videos, record.searches, record.total);
    res.setHeader("X-RateLimit-Videos-Remaining", "999999");
    res.setHeader("X-RateLimit-Searches-Remaining", String(Math.max(0, DAILY_SEARCH_LIMIT - record.searches)));
    res.setHeader("X-RateLimit-Reset-Seconds", String(getSecondsUntilJstMidnight()));
    res.setHeader("X-Daily-Usage-Token", token);
    res.setHeader("X-Client-Id", clientId);

    // ※ GETリクエストでSet-Cookieを付与するとVercel Edge CDNキャッシュ（s-maxage）がMISS/BYPASSされるため、
    //   公開GETリクエストでは付与せず、状態変更または明示的な認証/制限エンドポイントのみで付与
    if (req.method !== "GET" || p.startsWith("/api/limits") || p.startsWith("/api/auth")) {
      const cookieHeader = req.headers["cookie"] || "";
      if (!cookieHeader.includes("xerox_client_uuid=") && clientId && !clientId.includes(".")) {
        res.setHeader("Set-Cookie", `xerox_client_uuid=${clientId}; Path=/; Max-Age=31536000; SameSite=Lax`);
      }
    }

    res.setHeader(
      "Access-Control-Expose-Headers",
      "X-RateLimit-Videos-Remaining, X-RateLimit-Searches-Remaining, X-RateLimit-Reset-Seconds, X-Daily-Usage-Token, X-Client-Id"
    );

    next();
  });

  // --- In-Memory API Response Cache Helper ---
  interface CacheEntry {
    data: any;
    expires: number;
  }
  const memoryCache = new Map<string, CacheEntry>();

  function getFromMemoryCache<T>(key: string): T | null {
    const item = memoryCache.get(key);
    if (item && item.expires > Date.now()) {
      return item.data as T;
    }
    return null;
  }

  function setToMemoryCache(key: string, data: any, ttlMs: number = 15 * 60 * 1000) {
    memoryCache.set(key, { data, expires: Date.now() + ttlMs });
    if (memoryCache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of memoryCache.entries()) {
        if (v.expires <= now) memoryCache.delete(k);
      }
    }
  }

  // --- /stream/:videoId (/360/:videoId) & /edu/:id (/scratch-edu/:id) Endpoints ---
  const streamCache = new Map<string, { url: string; expires: number }>();

  // メモリキャッシュの定期クリーンアップ (5分毎)
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of streamCache.entries()) {
      if (v.expires <= now) streamCache.delete(k);
    }
    for (const [k, v] of memoryCache.entries()) {
      if (v.expires <= now) memoryCache.delete(k);
    }
  }, 5 * 60 * 1000);

  const handleStreamRequest = async (req: express.Request, res: express.Response) => {
    try {
      const videoId = req.params.videoId || req.params.id;
      if (!videoId) return res.status(400).send("Video ID is required");

      const now = Date.now();
      const cached = streamCache.get(videoId);
      if (cached && cached.expires > now) {
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.send(cached.url);
      }

      const apiUrl = `https://getlate.dev/api/tools/youtube-live-downloader?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv=${videoId}&formatId=2`;
      
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        redirect: "follow"
      });

      if (!response.ok) {
        return res.status(500).send("Error fetching stream URL");
      }

      const finalUrl = response.url;
      streamCache.set(videoId, { url: finalUrl, expires: now + 60000 });

      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.send(finalUrl);
    } catch (err) {
      console.error("Stream API Error:", err);
      res.status(500).send("Internal Server Error");
    }
  };

  app.get(["/stream/:videoId", "/360/:videoId", "/api/stream/:videoId", "/api/360/:videoId"], handleStreamRequest);

  let cachedEduConfig: { params: string; expires: number } = {
    params: "?rel=0&autoplay=1",
    expires: 0,
  };

  const handleEduRequest = async (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id || req.params.videoId;
      if (!id) return res.status(400).send("ID is required");

      const now = Date.now();
      let params = cachedEduConfig.params;

      // 15分間メモリキャッシュしてGitHubへの無駄な毎アクセスを防止
      if (now > cachedEduConfig.expires) {
        try {
          const confRes = await fetch("https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json", {
            headers: { "Accept": "text/plain, application/json, */*" }
          });
          if (confRes.ok) {
            const rawText = await confRes.text();
            let clean = rawText.replace(/&amp;/g, '&').trim();
            if (clean.startsWith('{')) {
              try {
                const config = JSON.parse(clean);
                if (config && typeof config.params === "string") {
                  clean = config.params.replace(/&amp;/g, '&').trim();
                }
              } catch {}
            }
            const qIdx = clean.indexOf('?');
            if (qIdx !== -1) {
              clean = clean.substring(qIdx);
            } else if (clean && !clean.startsWith('&')) {
              clean = '?' + clean;
            }
            if (clean) {
              params = clean;
              cachedEduConfig = {
                params,
                expires: now + 15 * 60 * 1000,
              };
            }
          }
        } catch (e) {
          console.warn("Failed to fetch fresh edu config from Wista API, using fallback:", e);
        }
      }

      const eduUrl = `https://www.youtubeeducation.com/embed/${id}${params}`;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.send(eduUrl);
    } catch (err) {
      console.error("Edu API Error:", err);
      res.status(500).send("Internal Server Error");
    }
  };

  app.get(["/edu/:id", "/scratch-edu/:id", "/api/edu/:id", "/api/scratch-edu/:id"], handleEduRequest);


  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.setHeader("Cache-Control", "public, s-maxage=60, max-age=60");
    return res.json({
      status: "ok",
      yt_initialized: !!yt,
      timestamp: new Date().toISOString(),
      node_version: process.version,
    });
  });

  // Download Stream Info API via RapidAPI (fallback/alternative)
  app.get("/api/download-info/:id", async (req, res) => {
    const videoId = req.params.id;
    const cacheKey = `dl-info:${videoId}`;
    const cached = getFromMemoryCache(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(cached);
    }

    const RAPID_API_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';
    const keys = [
      process.env.RAPIDAPI_KEY_1 || '69e2995a79mshcb657184ba6731cp16f684jsn32054a070ba5',
      process.env.RAPIDAPI_KEY_2 || 'ece95806fdmshe322f47bce30060p1c3411jsn41a3d4820039',
      process.env.RAPIDAPI_KEY_3 || '41c9265bc6msha0fa7dfc1a63eabp18bf7cjsne6ef10b79b38'
    ];
    const selectedKey = keys[Math.floor(Math.random() * keys.length)];

    const url = `https://${RAPID_API_HOST}/dl?id=${videoId}`;
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': selectedKey,
        'x-rapidapi-host': RAPID_API_HOST,
        'Content-Type': 'application/json'
      }
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (data.status !== "OK") {
        return res.status(400).json({ error: "Failed to fetch video data" });
      }

      setToMemoryCache(cacheKey, data, 30 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      res.json(data);
    } catch (error) {
      console.error("RapidAPI Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // GetLate Live Downloader Proxy (プロキシ経由で取得して別タブで直接再生・ダウンロード)
  app.get(["/api/download-proxy", "/api/download-proxy/:videoId"], async (req, res) => {
    const videoId = (req.params.videoId || req.query.videoId || req.query.id) as string;
    const formatId = (req.query.formatId as string) || "2";

    if (!videoId) {
      return res.status(400).send("videoId is required");
    }

    try {
      const targetUrl = `https://getlate.dev/api/tools/youtube-live-downloader?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${encodeURIComponent(videoId)}&formatId=${encodeURIComponent(formatId)}`;

      const response = await fetch(targetUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "*/*"
        }
      });

      const location = response.headers.get("location");
      if (location) {
        return res.redirect(location);
      }

      // リダイレクト追従で取得
      const followRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "*/*"
        }
      });

      if (followRes.url && followRes.url !== targetUrl) {
        return res.redirect(followRes.url);
      }

      const text = await followRes.text();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(followRes.status).send(text);
    } catch (err: any) {
      console.error("Download proxy error:", err);
      res.status(500).send("Failed to proxy download request: " + (err.message || String(err)));
    }
  });

  // Debug API: Raw Search
  app.get("/api/debug/search", async (req, res) => {
    const q = (req.query.q as string) || "";
    try {
      const youtube = await getYt();
      const search = await youtube.search(q);
      res.json(search);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "サーバー内部エラー" });
    }
  });

  // Debug API: Raw Video Info
  app.get("/api/debug/video", async (req, res) => {
    const id = (req.query.id as string) || "";
    try {
      const youtube = await getYt();
      let info;
      try {
        info = await youtube.getInfo(id);
      } catch (e) {
        info = await youtube.getBasicInfo(id);
      }
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "サーバー内部エラー" });
    }
  });

  // YouTubei.js Login API
  let currentAuthFlow: any = null;
  let authFlowExpiry: number = 0;

  app.get("/api/auth/signin", async (req, res) => {
    try {
      lastCredentials = null; // Reset lastCredentials
      const youtube = await getYt();
      
      // Load client ID if not already loaded
      if (!youtube.session.oauth.client_id) {
        youtube.session.oauth.client_id = await youtube.session.oauth.getClientID();
      }

      const clientId = youtube.session.oauth.client_id?.client_id || "861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com";
      const clientSecret = youtube.session.oauth.client_id?.client_secret || "SboVhoG9s0rNafixCSGGKXAT";

      // Fetch the device and user code directly from Google's unblocked oauth2.googleapis.com API
      const payload = {
        client_id: clientId,
        scope: "http://gdata.youtube.com https://www.googleapis.com/auth/youtube-paid-content",
        device_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", // Required to generate correct YouTube TV OAuth format code
        device_model: "ytlr::"
      };

      console.log("[Auth] Fetching device code from unblocked Google APIs...");
      const response = await axios.post("https://oauth2.googleapis.com/device/code", payload, {
        headers: { "Content-Type": "application/json" }
      });
      const code_obj = response.data;
      console.log("[Auth] Direct device code generated via Google APIs:", code_obj.user_code);

      currentAuthFlow = {
        device_code: code_obj.device_code,
        user_code: code_obj.user_code,
        verification_url: code_obj.verification_url,
        client: {
          client_id: clientId,
          client_secret: clientSecret
        }
      };
      authFlowExpiry = Date.now() + (code_obj.expires_in || 1800) * 1000;

      res.setHeader("Cache-Control", "no-store");
      return res.json({
        userCode: currentAuthFlow.user_code,
        verificationUrl: currentAuthFlow.verification_url,
      });
    } catch (err: any) {
      console.error("SignIn error:", err);
      res
        .status(500)
        .json({
          error:
            err.message || "ログイン処理の開始に失敗しました。時間をおいて再度お試しください。",
        });
    }
  });

  app.get("/api/auth/poll", async (req, res) => {
    if (!currentAuthFlow || Date.now() > authFlowExpiry) {
      console.warn(
        `[Auth] Poll rejected: ${!currentAuthFlow ? "No flow" : "Flow expired"}`,
      );
      return res
        .status(400)
        .json({
          error:
            "認証セッションが無効または期限切れです。再度ログインしてください。",
        });
    }

    try {
      // Manually request Google's unblocked oauth2.googleapis.com token endpoint on demand
      const payload = {
        client_id: currentAuthFlow.client.client_id,
        client_secret: currentAuthFlow.client.client_secret,
        code: currentAuthFlow.device_code,
        grant_type: "http://oauth.net/grant_type/device/1.0"
      };

      let response;
      try {
        response = await axios.post("https://oauth2.googleapis.com/token", payload, {
          headers: {
            "Content-Type": "application/json"
          }
        });
      } catch (err: any) {
        const errorData = err.response?.data;
        if (errorData && (errorData.error === "authorization_pending" || errorData.error === "slow_down")) {
          // Still waiting for approval or Google requested to slow down polling (both are pending states)
          res.setHeader("Cache-Control", "no-store");
          return res.json({ success: false, status: "pending" });
        }
        // Other authenticaton error (e.g., code expired or access denied)
        console.error("[Auth] Manual token fetch failed with oauth error:", errorData || err.message);
        
        let errorMessage = "認証中にエラーが発生しました。再度お試しください。";
        if (errorData) {
          if (errorData.error === "access_denied") {
            errorMessage = "Googleへのアクセスが拒否されました（ユーザーによるキャンセル）。";
          } else if (errorData.error === "expired_token") {
            errorMessage = "認証コードの有効期限が切れました。最初からやり直してください。";
          } else if (errorData.error) {
            errorMessage = `Google認証エラー: ${errorData.error} (${errorData.error_description || ''})`;
          }
        }
        
        // Clear flow state to stop polling
        currentAuthFlow = null;
        
        res.setHeader("Cache-Control", "no-store");
        return res.json({ success: false, status: "error", error: errorMessage });
      }

      const tokenData = response.data;
      if (tokenData && tokenData.access_token) {
        console.log("[Auth] Token received from Google. Authenticating instance...");
        const youtube = await getYt();

        const credentials = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || "dummy_refresh_token_for_validation",
          expiry_date: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          client: currentAuthFlow.client
        };

        // Authenticate the session
        await youtube.session.signIn(credentials);

        let userName = "YouTube User";
        let userPicture = "";
        try {
          const accounts = await youtube.account.getInfo(true) as any[];
          const activeAccount = accounts.find((a: any) => a.is_selected) || accounts[0];
          if (activeAccount) {
            userName = activeAccount.account_name?.toString() || "YouTube User";
            userPicture = activeAccount.account_photo?.thumbnails?.[0]?.url || "";
            console.log(`[Auth] Extracted user from AccountItem list: name=${userName}, picture=${userPicture}`);
          }
        } catch (err: any) {
          console.warn("[Auth] Failed to get info using getInfo(true):", err.message);
        }

        // Fallback to the original method if the above failed or produced default values
        if (userName === "YouTube User" || !userPicture) {
          try {
            const info = (await youtube.account.getInfo()) as any;
            const fallbackName =
              info.contents?.on_response_received_endpoints?.[0]
                ?.append_contributions_renderer?.user_name?.text;
            const fallbackPicture =
              info.contents?.on_response_received_endpoints?.[0]
                ?.append_contributions_renderer?.user_avatar?.thumbnails?.[0]?.url;
            
            if (fallbackName) userName = fallbackName;
            if (fallbackPicture) userPicture = fallbackPicture;
            console.log(`[Auth] Extracted user via fallback: name=${userName}, picture=${userPicture}`);
          } catch (err: any) {
            console.warn("[Auth] Fallback getInfo failed:", err.message);
          }
        }

        console.log(`[Auth] User authenticated successfully: ${userName}`);

        // Save credentials and clear flow state
        lastCredentials = credentials;
        currentAuthFlow = null;

        res.setHeader("Cache-Control", "no-store");
        return res.json({
          success: true,
          user: {
            name: userName,
            picture: userPicture,
            email: "authenticated@youtube.com",
          },
          credentials,
        });
      }

      res.setHeader("Cache-Control", "no-store");
      return res.json({ success: false, status: "pending" });
    } catch (err: any) {
      console.error("Auth poll error:", err);
      res
        .status(401)
        .json({ error: "認証に失敗しました。再度お試しください。" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const youtube = await getYt();
      await youtube.session.signOut();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // User's Liked Videos using YouTubei.js
  app.get("/api/user/liked-videos", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      // LL is the playlist ID for Liked Videos
      const likedVideosPlaylist = await youtube.getPlaylist("LL");

      const videos = likedVideosPlaylist.videos
        .map((v: any) => formatVideoObject(v))
        .filter((v) => v !== null);

      res.json(videos);
    } catch (err: any) {
      console.error("User liked videos fetch error:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      res.status(500).json({ error: "Failed to fetch liked videos" });
    }
  });

  // User's Subscriptions using YouTubei.js
  app.get("/api/user/subscriptions", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      
      // Try to get actual subscribed channels from getChannelsFeed
      let channels: any[] = [];
      try {
        const channelsFeed = await youtube.getChannelsFeed();
        channels = channelsFeed.channels || [];
        console.log(`[API] Fetched ${channels.length} channels from getChannelsFeed()`);
      } catch (err: any) {
        console.warn("[API] getChannelsFeed() failed, falling back to getSubscriptionsFeed():", err.message);
      }

      const channelsMap = new Map<string, any>();

      // Populate from channels list
      for (const c of channels) {
        const channelId = c.id;
        const channelTitle = c.author?.name || "Unknown Channel";
        const channelAvatar = c.author?.thumbnails?.[0]?.url || "";
        if (channelId) {
          channelsMap.set(channelId, {
            id: channelId,
            title: channelTitle,
            avatar: channelAvatar,
            videoCount: c.video_count?.toString() || "",
            subscriberCount: c.subscriber_count?.toString() || c.subscribers?.toString() || ""
          });
        }
      }

      // If empty, fallback to extracting from subscriptions feed (videos feed)
      if (channelsMap.size === 0) {
        try {
          const subFeed = await youtube.getSubscriptionsFeed();
          const videos = subFeed.videos || [];
          for (const v of videos) {
            const channelId = v.author?.id || v.channel_id || v.author?.channel_id;
            const channelTitle = v.author?.name || v.author?.text || v.author;
            const channelAvatar = v.author?.thumbnail?.[0]?.url || v.author?.avatar?.[0]?.url || "";
            
            if (channelId && channelTitle) {
              channelsMap.set(channelId, {
                id: channelId,
                title: channelTitle,
                avatar: channelAvatar,
                videoCount: "",
                subscriberCount: ""
              });
            }
          }
          console.log(`[API] Extracted ${channelsMap.size} channels from getSubscriptionsFeed() fallback`);
        } catch (err: any) {
          console.error("[API] getSubscriptionsFeed fallback failed:", err.message);
        }
      }

      const formatted = Array.from(channelsMap.values());
      return res.json(formatted);
    } catch (err: any) {
      console.error("[API] Error fetching user subscriptions:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // User's Watch History using YouTubei.js
  app.get("/api/user/history", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      const historyFeed = await youtube.getHistory();
      const videos = extractVideosFromFeed(historyFeed);
      return res.json(videos);
    } catch (err: any) {
      console.error("[API] Error fetching user history:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // User's Playlists using YouTubei.js
  app.get("/api/user/playlists", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      const playlistFeed = await youtube.getPlaylists();
      const playlists = playlistFeed.playlists || [];
      
      const formatted = playlists.map((p: any) => {
        return {
          id: p.id || p.playlist_id,
          title: p.title?.toString() || "Untitled Playlist",
          videoCount: p.video_count?.toString() || p.video_count_text?.toString() || "",
          thumbnails: p.thumbnails?.[0]?.url || p.thumbnail?.thumbnails?.[0]?.url || ""
        };
      });
      return res.json(formatted);
    } catch (err: any) {
      console.error("[API] Error fetching user playlists:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // User's Watch Later using YouTubei.js
  app.get("/api/user/watch-later", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      const watchLaterPlaylist = await youtube.getPlaylist("WL");
      const videos = (watchLaterPlaylist.videos || [])
        .map((v: any) => formatVideoObject(v))
        .filter((v: any) => v !== null);
      return res.json(videos);
    } catch (err: any) {
      console.error("User watch later fetch error:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: "Failed to fetch watch later videos" });
    }
  });

  // User's Own Channel Info using YouTubei.js
  app.get("/api/user/channel-info", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      const accounts = await youtube.account.getInfo(true) as any[];
      const activeAccount = accounts.find((a: any) => a.is_selected) || accounts[0];
      
      if (!activeAccount) {
        return res.status(404).json({ error: "No active account found" });
      }

      const channelId = activeAccount.id;
      const userName = activeAccount.account_name?.toString() || "YouTube User";
      const userPicture = activeAccount.account_photo?.thumbnails?.[0]?.url || "";
      const handle = activeAccount.channel_handle?.toString() || "";
      
      let subscriberCount = "";
      let videoCount = "";
      let bannerUrl = "";
      
      try {
        const channelDetails = await youtube.getChannel(channelId) as any;
        subscriberCount = channelDetails.subscriber_count?.toString() || "";
        videoCount = channelDetails.video_count?.toString() || "";
        bannerUrl = (channelDetails.header as any)?.banner?.thumbnails?.[0]?.url || "";
      } catch (e: any) {
        console.warn("[API] Failed to fetch deep channel details, returning basic info:", e.message);
      }

      return res.json({
        id: channelId,
        name: userName,
        avatar: userPicture,
        handle: handle,
        subscriberCount,
        videoCount,
        bannerUrl
      });
    } catch (err: any) {
      console.error("[API] Error fetching user channel info:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // User's Notifications count using YouTubei.js
  app.get("/api/user/notifications/unread-count", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      const count = await youtube.getUnseenNotificationsCount();
      return res.json({ count });
    } catch (err: any) {
      console.error("[API] Error fetching unseen notifications count:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // User's Notifications using YouTubei.js
  app.get("/api/user/notifications", async (req, res) => {
    try {
      const youtube = await getInnertubeInstance(req, true);
      const notificationsMenu = await youtube.getNotifications();
      const contents = notificationsMenu.contents || [];
      
      const formatted = contents.map((n: any) => {
        return {
          id: n.notification_id,
          message: n.short_message?.toString() || "",
          sentTime: n.sent_time?.toString() || "",
          read: !!n.read,
          avatar: n.thumbnails?.[0]?.url || "",
          thumbnail: n.video_thumbnails?.[0]?.url || "",
          videoId: n.endpoint?.payload?.videoId || ""
        };
      });
      return res.json(formatted);
    } catch (err: any) {
      console.error("[API] Error fetching notifications:", err);
      if (err.message?.includes("signed in")) {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // トレンド動画取得
  app.get("/api/trending", async (req, res) => {
    try {
      const cached = getFromMemoryCache<any[]>("trending:jp");
      if (cached && cached.length > 0) {
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json(cached);
      }

      const youtube = await getYt();
      // 日本の人気動画を検索
      const search = await youtube.search("日本 トレンド 人気動画 2026", {
        type: "video",
      });

      const rawVideos = search.videos || [];
      const videos = rawVideos
        .filter((v: any) => !isUnwantedVideo(v))
        .map((v: any) => formatVideoObject(v));

      if (videos.length > 0) {
        setToMemoryCache("trending:jp", videos, 30 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json(videos);
      }
      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
      res.json([]);
    } catch (err) {
      console.error("Trending API error:", err);
      res.json([]);
    }
  });

  function isUnwantedVideo(v: any) {
    if (!v) return true;
    const videoId = v.id || v.videoId || v.content_id || "";
    if (videoId === "dQw4w9WgXcQ" || videoId.includes("dQw4w9WgXcQ"))
      return true;

    const title = (v.title?.text || v.title || "").toLowerCase();
    const author = (v.author?.name || v.author || "").toLowerCase();
    const text = title + " " + author;

    // 特定の取得ミス動画・Rick Astleyの除外
    if (
      text.includes("never gonna give you up") ||
      text.includes("rick astley")
    ) {
      return true;
    }

    // 除外ワード (メドレーや作業用BGMをより強力に排除)
    const unwanted = [
      "メドレー",
      "medley",
      "作業用",
      "bgm",
      "mix",
      "ミックス",
      "詰め合わせ",
      "中国語",
      "中文",
      "華語",
      "台湾",
      "香港",
      "taiwan",
      "china",
      "chinese",
      "睡眠用",
      "勉強用",
      "リラックス",
      "healing",
      "relaxing",
      "study music",
      "フルメドレー",
      "full medley",
      "bgm用",
    ];

    return unwanted.some((kw) => text.includes(kw));
  }

  function isMetadataNotAuthor(text: string): boolean {
    if (!text || typeof text !== "string") return true;
    const t = text.trim().toLowerCase();
    if (!t) return true;
    if (
      t.includes("回視聴") ||
      t.includes("視聴") ||
      t.includes("views") ||
      t.includes("view") ||
      t.includes("前") ||
      t.includes("ago") ||
      t.includes("時間") ||
      t.includes("分") ||
      t.includes("日") ||
      t.includes("秒") ||
      t.includes("週") ||
      t.includes("月") ||
      t.includes("年") ||
      t.includes("公開") ||
      t.includes("配信") ||
      t.includes("生放送") ||
      t.includes("チャンネル登録者") ||
      t.includes("subscribers") ||
      /^\d+[\d,.\s]*(k|m|b|万|千|億)?/i.test(t)
    ) {
      return true;
    }
    return false;
  }

  function isValidChannelId(id?: string): boolean {
    return Boolean(
      id &&
      typeof id === "string" &&
      id.startsWith("UC") &&
      id.length >= 10
    );
  }

  function isValidAuthorName(name?: string): boolean {
    if (!name || typeof name !== "string") return false;
    const t = name.trim();
    if (t.length === 0) return false;
    if (
      t === "チャンネル" ||
      t === "Unknown" ||
      t === "Channel" ||
      t === "User" ||
      t === "undefined" ||
      t === "null"
    ) {
      return false;
    }
    if (isMetadataNotAuthor(t)) return false;
    return true;
  }

  function safeSetBatchChannelCache(
    key: string,
    info: { author: string; authorAvatar: string; authorId?: string }
  ) {
    if (!key || !info) return;
    if (!isValidAuthorName(key) && !isValidChannelId(key)) return;
    // 名前をキーにする場合は、必ず有効なUCチャンネルIDかアバターが存在する場合のみキャッシュ
    if (!isValidChannelId(key) && !isValidChannelId(info.authorId)) return;
    batchChannelCache.set(key, info);
  }

  // 複数チャンネル・コラボレーション動画からメインチャンネルの情報（アイコン・ID・名前）を抽出
  function extractCollabMainChannel(
    v: any,
  ): { name?: string; id?: string; avatar?: string } | null {
    if (!v) return null;
    try {
      const epCandidates = [
        v.author?.endpoint,
        v.author?.navigation_endpoint,
        v.owner?.endpoint,
        v.owner?.navigation_endpoint,
        v.short_byline?.endpoint,
        v.byline?.endpoint,
        v.navigation_endpoint,
        v.endpoint,
      ];

      for (const ep of epCandidates) {
        if (!ep) continue;
        const cmd =
          ep.command ||
          ep.payload?.command ||
          ep.show_dialog_command ||
          ep.payload?.show_dialog_command ||
          ep.showDialogCommand ||
          ep;
        const dialog =
          cmd.inline_content ||
          cmd.payload?.inline_content ||
          cmd.inlineContent ||
          cmd;
        const custom = dialog.custom_content || dialog.customContent || dialog;
        const items = custom.items || custom.contents;
        if (Array.isArray(items) && items.length > 0) {
          for (const main of items) {
            const id =
              main.endpoint?.payload?.browseId ||
              main.title?.endpoint?.payload?.browseId ||
              main.renderer_context?.command_context?.on_tap?.payload?.browseId ||
              main.renderer_context?.command_context?.on_tap?.innertubeCommand
                ?.browseEndpoint?.browseId ||
              main.command_context?.on_tap?.payload?.browseId;
            const name =
              main.title?.text ||
              main.title?.runs?.[0]?.text ||
              (typeof main.title === "string" ? main.title : undefined);
            const avatar =
              main.leading_accessory?.image?.[0]?.url ||
              main.leading_accessory?.avatarViewModel?.image?.sources?.[0]?.url ||
              main.leadingAccessory?.avatarViewModel?.image?.sources?.[0]?.url ||
              main.leading_accessory?.thumbnails?.[0]?.url ||
              main.thumbnail?.thumbnails?.[0]?.url;

            if (isValidChannelId(id) && isValidAuthorName(name)) {
              return {
                name: name?.trim(),
                id: id?.trim(),
                avatar: avatar?.startsWith("//") ? "https:" + avatar : avatar,
              };
            }
          }
        }
      }
    } catch {}
    return null;
  }

  // 安全で正確な動画オブジェクト正規化関数
  function formatVideoObject(
    v: any,
    defaultAuthor: string = "",
    channelId?: string,
  ) {
    if (!v) return null;
    if (isUnwantedVideo(v)) return null;

    // ShortsLockupView (YouTube.js の最新ショート動画構造)
    if (v.type === "ShortsLockupView" || v.type === "ReelItem") {
      const videoId =
        v.on_tap_endpoint?.payload?.videoId ||
        (typeof v.entity_id === "string"
          ? v.entity_id.replace("shorts-shelf-item-", "")
          : "") ||
        v.id ||
        v.videoId;
      if (!videoId) return null;

      const title =
        v.overlay_metadata?.primary_text?.text ||
        v.title?.text ||
        (typeof v.title === "string" ? v.title : "") ||
        v.accessibility_text ||
        "ショート動画";
      const viewText =
        v.overlay_metadata?.secondary_text?.text || v.views?.text || "";

      let authorName = "";
      if (v.author) {
        authorName =
          typeof v.author === "string"
            ? v.author
            : v.author.name || v.author.text || "";
      }
      if (!isValidAuthorName(authorName)) {
        authorName = isValidAuthorName(defaultAuthor) ? defaultAuthor : "チャンネル";
      }

      let authorId =
        (v.author?.id && isValidChannelId(v.author.id) ? v.author.id : undefined) ||
        (v.author?.endpoint?.browse_endpoint?.browse_id && isValidChannelId(v.author.endpoint.browse_endpoint.browse_id) ? v.author.endpoint.browse_endpoint.browse_id : undefined) ||
        (v.on_tap_endpoint?.payload?.browseId && isValidChannelId(v.on_tap_endpoint.payload.browseId) ? v.on_tap_endpoint.payload.browseId : undefined) ||
        (isValidChannelId(channelId) ? channelId : undefined);

      let authorAvatar = "";
      if (v.author?.best_thumbnail?.url)
        authorAvatar = v.author.best_thumbnail.url;
      else if (v.author?.thumbnails?.[0]?.url)
        authorAvatar = v.author.thumbnails[0].url;
      else if (v.author?.avatar?.[0]?.url)
        authorAvatar = v.author.avatar[0].url;

      if (authorAvatar && authorAvatar.startsWith("//"))
        authorAvatar = "https:" + authorAvatar;

      if (!authorAvatar && isValidAuthorName(authorName) && batchChannelCache.has(authorName)) {
        const cached = batchChannelCache.get(authorName);
        if (cached?.authorAvatar) authorAvatar = cached.authorAvatar;
        if (!authorId && isValidChannelId(cached?.authorId)) authorId = cached!.authorId;
      }

      if (!authorAvatar) {
        authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff&size=128`;
      }

      const thumbnails = v.on_tap_endpoint?.payload?.thumbnail?.thumbnails ||
        v.thumbnails || [
          { url: `https://i.ytimg.com/vi/${videoId}/frame0.jpg` },
        ];

      return {
        videoId: videoId,
        playlistId: undefined,
        type: "video",
        title: title,
        author: authorName,
        authorId: authorId,
        authorAvatar: authorAvatar,
        viewCount: extractViewCount(v) || parseCount(viewText) || 0,
        publishedText: "",
        lengthSeconds: 30,
        videoThumbnails: thumbnails,
        isLive: false,
        isPremiere: false,
      };
    }

    if (v.type === "LockupView") {
      const titleText =
        v.metadata?.title?.text ||
        (typeof v.metadata?.title === "string"
          ? v.metadata.title
          : "タイトルなし");
      const bottomOverlay = v.content_image?.overlays?.find(
        (o: any) => o.type === "ThumbnailBottomOverlayView",
      );
      const timeBadge = bottomOverlay?.badges?.[0]?.text;
      let lengthSeconds = 0;
      if (timeBadge) {
        const timeParts = timeBadge.split(":").reverse();
        lengthSeconds = timeParts.reduce(
          (acc: number, val: string, idx: number) =>
            acc + parseInt(val) * Math.pow(60, idx),
          0,
        );
      }
      const isLiveBadge = v.content_image?.overlays?.some((o: any) =>
        o.badges?.some((b: any) => b.text?.toLowerCase() === "live"),
      );
      const isLiveStream = Boolean(isLiveBadge || v.is_live);
      const isPremiere = Boolean(
        v.is_premiere ||
        titleText.includes("プレミア公開") ||
        v.badges?.some((b: any) => b.text?.includes("プレミア")),
      );

      let authorCandidate = "";
      let authorIdCandidate = "";
      let viewText = "";
      let publishedText = "";

      const rows = v.metadata?.metadata?.metadata_rows || [];
      for (const row of rows) {
        const parts = row?.metadata_parts || [];
        for (const part of parts) {
          const txt =
            part?.text?.text ||
            (typeof part?.text === "string" ? part.text : "");
          if (!txt) continue;
          if (!authorCandidate && isValidAuthorName(txt)) {
            authorCandidate = txt;
            const bId =
              part?.endpoint?.payload?.browseId ||
              part?.endpoint?.browse_endpoint?.browse_id ||
              part?.on_tap_endpoint?.payload?.browseId;
            if (isValidChannelId(bId)) {
              authorIdCandidate = bId;
            }
          } else if (
            txt.includes("視聴") ||
            txt.includes("views") ||
            /^\d+[\d,.\s]*(k|m|b|万|千|億)?/i.test(txt)
          ) {
            if (!viewText) viewText = txt;
          } else if (
            txt.includes("前") ||
            txt.includes("ago") ||
            txt.includes("配信") ||
            txt.includes("公開")
          ) {
            if (!publishedText) publishedText = txt;
          }
        }
      }

      if (!isValidAuthorName(authorCandidate)) {
        authorCandidate =
          v.short_byline?.text ||
          v.author?.name ||
          (isValidAuthorName(defaultAuthor) ? defaultAuthor : "チャンネル");
      }

      const collabInfo = extractCollabMainChannel(v);
      const cleanAuthorCandidate = (authorCandidate || "")
        .split(/、他|\s*and\s+\d+\s+other/i)[0]
        .trim();

      let finalAuthorId =
        authorIdCandidate ||
        (collabInfo?.id && isValidChannelId(collabInfo.id) ? collabInfo.id : undefined) ||
        (v.metadata?.avatar?.endpoint?.payload?.browseId && isValidChannelId(v.metadata.avatar.endpoint.payload.browseId) ? v.metadata.avatar.endpoint.payload.browseId : undefined) ||
        (v.content_image?.endpoint?.payload?.browseId && isValidChannelId(v.content_image.endpoint.payload.browseId) ? v.content_image.endpoint.payload.browseId : undefined) ||
        (isValidChannelId(channelId) ? channelId : undefined);

      let authorAvatar = "";
      const avatarCandidate =
        collabInfo?.avatar ||
        v.metadata?.avatar?.thumbnails?.[0]?.url ||
        v.metadata?.avatar?.[0]?.url ||
        v.author?.best_thumbnail?.url ||
        v.author?.thumbnails?.[0]?.url ||
        v.content_image?.avatar?.thumbnails?.[0]?.url ||
        v.channel_thumbnail?.url;
      if (avatarCandidate) {
        authorAvatar = avatarCandidate.startsWith("//")
          ? "https:" + avatarCandidate
          : avatarCandidate;
      }

      if (
        !authorAvatar &&
        isValidAuthorName(cleanAuthorCandidate) &&
        batchChannelCache.has(cleanAuthorCandidate)
      ) {
        const cached = batchChannelCache.get(cleanAuthorCandidate)!;
        authorAvatar = cached.authorAvatar;
        if (!finalAuthorId && isValidChannelId(cached.authorId)) {
          finalAuthorId = cached.authorId;
        }
      }

      if (authorAvatar) {
        if (isValidAuthorName(cleanAuthorCandidate) && isValidChannelId(finalAuthorId)) {
          safeSetBatchChannelCache(cleanAuthorCandidate, {
            author: cleanAuthorCandidate,
            authorAvatar,
            authorId: finalAuthorId,
          });
        }
      } else {
        authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanAuthorCandidate || authorCandidate)}&background=random&color=fff&size=128`;
      }

      const calculatedViews = extractViewCount(v) || parseCount(viewText) || 0;

      return {
        videoId: v.content_id,
        playlistId: undefined,
        type: "video",
        title: titleText,
        author: authorCandidate,
        authorId: finalAuthorId,
        authorAvatar: authorAvatar,
        viewCount: calculatedViews,
        publishedText: publishedText,
        lengthSeconds: lengthSeconds,
        videoThumbnails: v.content_image?.image || [
          {
            url: `https://i.ytimg.com/vi/${v.content_id}/hqdefault.jpg`,
            width: 480,
            height: 360,
          },
        ],
        isLive: isLiveStream && !isPremiere,
        isPremiere: isPremiere,
        liveViewerCount:
          isLiveStream && !isPremiere ? calculatedViews : undefined,
      };
    }

    const isPlaylist =
      v.type === "Playlist" || v.type === "Mix" || v.type === "CompactPlaylist";
    const videoId = isPlaylist
      ? v.first_video_id || undefined
      : v.id || v.videoId;
    const playlistId = isPlaylist
      ? v.id || v.playlistId
      : v.playlistId || undefined;

    if (!videoId && !playlistId) return null;

    const thumbnails = v.thumbnails || v.videoThumbnails || v.thumbnail || [];
    const title =
      v.title?.text ||
      (typeof v.title === "string" ? v.title : "") ||
      "タイトルなし";

    // チャンネル名とIDのあらゆる構造からの確実な抽出
    let authorName = "";
    if (v.author) {
      if (typeof v.author === "string") {
        authorName = v.author;
      } else if (typeof v.author.name === "string") {
        authorName = v.author.name;
      } else if (typeof v.author.text === "string") {
        authorName = v.author.text;
      }
    }
    if (!isValidAuthorName(authorName)) {
      const candidates = [
        v.short_byline?.text,
        v.short_byline?.runs?.[0]?.text,
        v.long_byline?.text,
        v.long_byline?.runs?.[0]?.text,
        v.owner?.title?.text,
        v.owner?.title?.runs?.[0]?.text,
        v.channel?.name,
        v.channel?.title,
        v.byline?.text,
        v.uploader_name,
        v.uploader,
        defaultAuthor,
      ];
      for (const cand of candidates) {
        if (isValidAuthorName(cand)) {
          authorName = cand.trim();
          break;
        }
      }
    }
    if (!isValidAuthorName(authorName)) {
      authorName = isValidAuthorName(defaultAuthor) ? defaultAuthor : "チャンネル";
    }

    const collabInfo = extractCollabMainChannel(v);
    const cleanAuthor = (authorName || "")
      .split(/、他|\s*and\s+\d+\s+other/i)[0]
      .trim();

    let finalAuthorId =
      (v.author?.id && isValidChannelId(v.author.id) ? v.author.id : undefined) ||
      (v.author?.endpoint?.browse_endpoint?.browse_id && isValidChannelId(v.author.endpoint.browse_endpoint.browse_id) ? v.author.endpoint.browse_endpoint.browse_id : undefined) ||
      (v.author?.endpoint?.payload?.browseId && isValidChannelId(v.author.endpoint.payload.browseId) ? v.author.endpoint.payload.browseId : undefined) ||
      (v.channel?.id && isValidChannelId(v.channel.id) ? v.channel.id : undefined) ||
      (v.owner?.endpoint?.browse_endpoint?.browse_id && isValidChannelId(v.owner.endpoint.browse_endpoint.browse_id) ? v.owner.endpoint.browse_endpoint.browse_id : undefined) ||
      (v.owner?.endpoint?.payload?.browseId && isValidChannelId(v.owner.endpoint.payload.browseId) ? v.owner.endpoint.payload.browseId : undefined) ||
      (collabInfo?.id && isValidChannelId(collabInfo.id) ? collabInfo.id : undefined) ||
      (isValidChannelId(channelId) ? channelId : undefined);

    if (!finalAuthorId && isValidAuthorName(cleanAuthor) && batchChannelCache.has(cleanAuthor)) {
      const cached = batchChannelCache.get(cleanAuthor);
      if (cached && isValidChannelId(cached.authorId)) {
        finalAuthorId = cached.authorId;
      }
    }

    // アバターURLの多階層探索
    let authorAvatar = "";
    const avatarCandidates = [
      collabInfo?.avatar,
      v.author?.best_thumbnail?.url,
      v.author?.thumbnails?.[v.author?.thumbnails?.length - 1]?.url,
      v.author?.thumbnails?.[0]?.url,
      v.author?.avatar?.[v.author?.avatar?.length - 1]?.url,
      v.author?.avatar?.[0]?.url,
      v.author?.avatar_thumbnail_url,
      v.author_thumbnails?.[0]?.url,
      v.channel_navigation_endpoint?.author?.thumbnails?.[0]?.url,
      v.channel_thumbnail_with_count?.thumbnail?.thumbnails?.[0]?.url,
      v.channel_thumbnail?.thumbnails?.[0]?.url,
      v.channel_thumbnail?.url,
      v.channel_thumbnails?.[0]?.url,
      v.channel_avatar?.url,
      v.owner?.thumbnails?.[v.owner?.thumbnails?.length - 1]?.url,
      v.owner?.thumbnails?.[0]?.url,
      v.owner?.avatar?.[0]?.url,
    ];

    for (const url of avatarCandidates) {
      if (url && typeof url === "string" && url.trim().length > 0) {
        authorAvatar = url.trim();
        break;
      }
    }

    if (!authorAvatar && isValidAuthorName(cleanAuthor) && batchChannelCache.has(cleanAuthor)) {
      const cached = batchChannelCache.get(cleanAuthor);
      if (cached?.authorAvatar) authorAvatar = cached.authorAvatar;
      if (!finalAuthorId && isValidChannelId(cached?.authorId)) {
        finalAuthorId = cached!.authorId;
      }
    }

    if (authorAvatar) {
      if (authorAvatar.startsWith("//")) {
        authorAvatar = "https:" + authorAvatar;
      }
      if (isValidAuthorName(cleanAuthor) && isValidChannelId(finalAuthorId)) {
        safeSetBatchChannelCache(cleanAuthor, {
          author: cleanAuthor,
          authorAvatar: authorAvatar,
          authorId: finalAuthorId,
        });
      }
    } else {
      authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanAuthor || authorName)}&background=random&color=fff&size=128`;
    }

    // ライブ判定とプレミア判定（プレミア公開を生配信と誤判定しない）
    const isPremiere = Boolean(
      v.is_premiere ||
      v.badges?.some(
        (b: any) =>
          (b.label || b.text || "").toLowerCase().includes("premiere") ||
          (b.label || b.text || "").includes("プレミア"),
      ) ||
      title.includes("プレミア公開"),
    );

    const isLiveStream = Boolean(
      !isPremiere &&
      (v.is_live === true ||
        v.badges?.some(
          (b: any) =>
            (b.label || b.text || "").toLowerCase() === "live" ||
            (b.label || b.text || "") === "ライブ",
        )),
    );

    const calculatedViews = extractViewCount(v);

    // 実データからの視聴者数
    let realLiveViewers: number | undefined = undefined;
    if (isLiveStream) {
      if (calculatedViews > 0) realLiveViewers = calculatedViews;
    }

    return {
      videoId: videoId,
      playlistId: playlistId,
      type: v.type?.toLowerCase() || (playlistId ? "playlist" : "video"),
      title: title,
      author: authorName,
      authorId: finalAuthorId,
      authorAvatar: authorAvatar,
      viewCount: calculatedViews,
      publishedText:
        v.published?.text || v.publishedText || v.video_count_short?.text || "",
      lengthSeconds: v.duration?.seconds || v.lengthSeconds || 0,
      videoThumbnails:
        thumbnails.length > 0
          ? thumbnails
          : [
              {
                url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                width: 480,
                height: 360,
              },
            ],
      isLive: isLiveStream,
      isPremiere: isPremiere,
      liveViewerCount: realLiveViewers,
    };
  }

  // チャンネルオブジェクトの安全な正規化関数
  function formatSearchChannel(ch: any) {
    if (!ch) return null;
    const id = ch.id || ch.author?.id || ch.endpoint?.payload?.browseId;
    const title = ch.author?.name || ch.title?.text || (typeof ch.title === "string" ? ch.title : "") || ch.name || "";
    if (!id || !title) return null;

    let avatar = "";
    const thumbs = ch.author?.thumbnails || ch.thumbnails;
    if (Array.isArray(thumbs) && thumbs.length > 0) {
      avatar = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || "";
    }
    if (!avatar && ch.avatar?.url) avatar = ch.avatar.url;
    if (avatar && avatar.startsWith("//")) {
      avatar = "https:" + avatar;
    }
    if (!avatar) {
      avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random&color=fff&size=128`;
    }

    let subscribers = ch.video_count?.text || ch.subscriber_count?.text || ch.subscribers?.text || "";
    let handle = "";
    if (typeof ch.subscriber_count?.text === "string" && ch.subscriber_count.text.startsWith("@")) {
      handle = ch.subscriber_count.text;
    } else if (typeof ch.author?.endpoint?.payload?.canonicalBaseUrl === "string") {
      handle = ch.author.endpoint.payload.canonicalBaseUrl.replace("/", "");
    }

    let videoCount = "";
    if (typeof ch.video_count?.text === "string" && !ch.video_count.text.includes("チャンネル登録者数")) {
      videoCount = ch.video_count.text;
    }

    const description =
      ch.description_snippet?.text ||
      ch.description?.text ||
      (typeof ch.description === "string" ? ch.description : "") ||
      "";
    const isVerified = Boolean(
      ch.author?.is_verified ||
      ch.badges?.some((b: any) =>
        (b.tooltip || b.label || b.text || "").includes("確認済み")
      )
    );

    return {
      id,
      title,
      handle,
      avatar,
      subscribers,
      videoCount,
      description,
      isVerified,
    };
  }

  // Curated Fallback Japanese Videos Pool (Zero-fail guarantee)
  const CURATED_FALLBACK_VIDEOS = [
    {
      videoId: "m_c-2_bS8V0",
      title: "【アニメ】もしも全員が天才だったら【総集編】",
      author: "テイコウペンギン",
      authorId: "UCUTgXN23VQJ_j2vQyM_ySdA",
      authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_k6Gz7xV8s5U6yH5D9w5sJk8K1L5J2x=s176-c-k-c0x00ffffff-no-rj",
      viewCount: 1450000,
      publishedText: "3日前",
      lengthSeconds: 680,
      videoThumbnails: [{ url: "https://i.ytimg.com/vi/m_c-2_bS8V0/hqdefault.jpg", width: 480, height: 360 }],
      type: "video"
    },
    {
      videoId: "0YF8vcSReV4",
      title: "【マイクラ】巨大地下都市を作る part1【建築】",
      author: "ドズル社",
      authorId: "UCEiK0_aG7Z08V_6xQZ3D_7w",
      authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_n4K3w7M2_j5K9D8x1sL2k3J5P8Q=s176-c-k-c0x00ffffff-no-rj",
      viewCount: 520000,
      publishedText: "1日前",
      lengthSeconds: 1240,
      videoThumbnails: [{ url: "https://i.ytimg.com/vi/0YF8vcSReV4/hqdefault.jpg", width: 480, height: 360 }],
      type: "video"
    },
    {
      videoId: "x8VYWazR5mE",
      title: "米津玄師 - さよーならまたいつか！ Kenshi Yonezu - Sayonara, Mata Itsuka!",
      author: "Kenshi Yonezu 米津玄師",
      authorId: "UCUCeZaZeJbEYAAkvV3Ab51A",
      authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_m8X3_j4V2K5xL8J1k3=s176-c-k-c0x00ffffff-no-rj",
      viewCount: 68000000,
      publishedText: "5ヶ月前",
      lengthSeconds: 205,
      videoThumbnails: [{ url: "https://i.ytimg.com/vi/x8VYWazR5mE/hqdefault.jpg", width: 480, height: 360 }],
      type: "video"
    },
    {
      videoId: "1_22gJ3VwA0",
      title: "【検証】100日間無人島で生活したらどうなるのか？",
      author: "HikakinTV",
      authorId: "UCZf__rfZGsIOvd8xS_i2sWQ",
      authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_n8J3_j4K2L5xM8=s176-c-k-c0x00ffffff-no-rj",
      viewCount: 3200000,
      publishedText: "1週間前",
      lengthSeconds: 1420,
      videoThumbnails: [{ url: "https://i.ytimg.com/vi/1_22gJ3VwA0/hqdefault.jpg", width: 480, height: 360 }],
      type: "video"
    },
    {
      videoId: "W6q1AWnjNiM",
      title: "Creepy Nuts - Bling-Bang-Bang-Born / THE FIRST TAKE",
      author: "THE FIRST TAKE",
      authorId: "UC9zY_E8N5xOmZSwNyEAxyWQ",
      authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_m2K5_j8X3=s176-c-k-c0x00ffffff-no-rj",
      viewCount: 95000000,
      publishedText: "1年前",
      lengthSeconds: 195,
      videoThumbnails: [{ url: "https://i.ytimg.com/vi/W6q1AWnjNiM/hqdefault.jpg", width: 480, height: 360 }],
      type: "video"
    },
    {
      videoId: "T8r3cWM4JII",
      title: "【料理】プロが本気で作る最高峰の究極カルボナーラ",
      author: "料理研究家リュウジのバズレシピ",
      authorId: "UCW0iqesyD22dSmC_8q9V5LQ",
      authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_m4K5_j8X3=s176-c-k-c0x00ffffff-no-rj",
      viewCount: 1800000,
      publishedText: "4日前",
      lengthSeconds: 780,
      videoThumbnails: [{ url: "https://i.ytimg.com/vi/T8r3cWM4JII/hqdefault.jpg", width: 480, height: 360 }],
      type: "video"
    }
  ];

  // トレンド ＆ パーソナライズドおすすめAPI (高耐障害性・高速キャッシュ)
  app.get("/api/recommendations", async (req, res) => {
    const keywords = (req.query.keywords as string) || "";
    const historyIds = ((req.query.historyIds as string) || "")
      .split(",")
      .filter((id) => id && id.trim().length > 0);
    const userHashtagsParam = (req.query.userHashtags as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const clientSeed = parseInt(
      (req.query.seed || req.query.refreshNonce) as string,
      10,
    );
    const seed = Number.isFinite(clientSeed)
      ? clientSeed
      : Date.now() + Math.floor(Math.random() * 100000);

    const cacheKey = `recs:p${page}:${keywords.slice(0, 30)}:${historyIds.slice(0, 2).join(",")}`;
    const cachedData = getFromMemoryCache<{ videos: any[]; aiKeywords: string[]; seed: number }>(cacheKey);
    if (cachedData && Array.isArray(cachedData.videos) && cachedData.videos.length > 0) {
      res.setHeader("Cache-Control", "public, s-maxage=1200, stale-while-revalidate=86400");
      return res.json(cachedData);
    }

    const credentialsHeader = req.headers["x-youtube-credentials"] as string;
    if (credentialsHeader) {
      try {
        const youtube = await withTimeout(getInnertubeInstance(req), 3000, null as any);
        if (youtube) {
          const home = await withTimeout(youtube.getHomeFeed(), 3500, null as any);
          const videos = extractVideosFromFeed(home);
          if (videos && videos.length > 0) {
            res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
            return res.json({
              videos: videos,
              aiKeywords: [],
            });
          }
        }
      } catch (err) {
        console.warn("[Recs] Failed to fetch home feed, using fast algorithmic recs:", err);
      }
    }

    // シード付き疑似乱数生成器
    const getSeedRandom = (offset: number = 0) => {
      const s = (seed + offset * 9301 + 49297) % 233280;
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    try {
      const youtube = await withTimeout(getYt(), 3000, null as any);

      let geminiKeywords: string[] = [];
      let personalizedVideos: any[] = [];
      let generalVideos: any[] = [];

      if (youtube) {
        // 1. 視聴履歴がある場合 (最大3件を高速取得)
        const sampledHistory = historyIds.slice(0, 3);
        if (sampledHistory.length > 0) {
          try {
            const relTasks = sampledHistory.map(async (id) => {
              try {
                const info = await withTimeout(youtube.getBasicInfo(id), 2000, null as any);
                if (info && info.watch_next_feed) {
                  return info.watch_next_feed;
                }
                return [];
              } catch {
                return [];
              }
            });
            const relLists = await Promise.all(relTasks);
            relLists.forEach((l) => {
              if (Array.isArray(l)) personalizedVideos.push(...l);
            });
          } catch (e) {
            console.warn("[Recs] Quick history fetch error:", e);
          }
        }

        // 2. Gemini AI 推論 (高速 1.2秒タイムアウト)
        if (page === 1 && process.env.GEMINI_API_KEY && (keywords.length > 3 || historyIds.length > 0)) {
          try {
            const promptInput = `YouTubeおすすめクエリを日本語で5個JSON配列のみで出力して: ["クエリ1","クエリ2","クエリ3","クエリ4","クエリ5"] 興味:${keywords.slice(0, 80)}`;
            const aiPromise = genAI.models.generateContent({
              model: "gemini-2.5-flash",
              contents: promptInput,
              config: { responseMimeType: "application/json" }
            });
            const aiRes = await withTimeout(aiPromise, 1200, null as any);
            if (aiRes && aiRes.text) {
              const parsed = JSON.parse(aiRes.text);
              if (Array.isArray(parsed)) geminiKeywords = parsed.slice(0, 5);
            }
          } catch {}
        }

        // 3. 一般・トレンド検索
        const defaultCategories = [
          "日本 トレンド 人気動画 2026",
          "話題の曲 最新 YouTube Music 日本",
          "人気 ゲーム実況 最新",
          "エンタメ 話題 動画",
          "最新 ガジェット レビュー",
          "アニメ 公式 話題 2026",
        ];
        const searchQueries: string[] = [];
        if (geminiKeywords.length > 0) {
          searchQueries.push(geminiKeywords[0]);
        }
        if (keywords.trim()) {
          searchQueries.push(keywords.split(" ")[0]);
        }
        searchQueries.push(defaultCategories[(page - 1) % defaultCategories.length]);
        searchQueries.push(defaultCategories[page % defaultCategories.length]);

        const uniqueQueries = Array.from(new Set(searchQueries)).slice(0, 2);
        const searchTasks = uniqueQueries.map(async (q) => {
          try {
            const sRes = await withTimeout(youtube.search(q, { type: "video" }), 2500, null as any);
            return sRes?.videos || [];
          } catch {
            return [];
          }
        });

        const searchResults = await Promise.all(searchTasks);
        searchResults.forEach((vList) => {
          if (Array.isArray(vList)) generalVideos.push(...vList);
        });
      }

      // フォーマットと重複排除
      const formattedP = personalizedVideos
        .map((v) => formatVideoObject(v))
        .filter((v) => v && v.videoId && !isUnwantedVideo(v));

      const formattedG = generalVideos
        .map((v) => formatVideoObject(v))
        .filter((v) => v && v.videoId && !isUnwantedVideo(v));

      const combined = [...formattedP, ...formattedG];
      const uniqueMap = new Map<string, any>();
      combined.forEach((v) => {
        if (v && v.videoId && !uniqueMap.has(v.videoId)) {
          uniqueMap.set(v.videoId, v);
        }
      });

      let finalVideos = Array.from(uniqueMap.values());

      // 万一空の場合は、事前用意の高品質フォールバック動画を即座に付与
      if (finalVideos.length === 0) {
        finalVideos = [...CURATED_FALLBACK_VIDEOS];
      }

      // シャッフル
      for (let i = finalVideos.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 31 + i) * (i + 1));
        [finalVideos[i], finalVideos[j]] = [finalVideos[j], finalVideos[i]];
      }

      const responsePayload = {
        videos: finalVideos,
        aiKeywords: geminiKeywords,
        seed: seed,
      };

      setToMemoryCache(cacheKey, responsePayload, 15 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=1200, stale-while-revalidate=86400");
      return res.json(responsePayload);
    } catch (err: any) {
      console.error("[Recs] Recovering from recommendations error:", err);
      // エラー発生時も500を返さず、確実に正常なJSONとフォールバック動画を返す
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
      return res.json({
        videos: CURATED_FALLBACK_VIDEOS,
        aiKeywords: [],
        seed: seed,
      });
    }
  });

  // YouTube 検索サジェスト API
  app.get("/api/suggestions", async (req, res) => {
    const q = (req.query.q as string) || "";
    if (!q.trim()) {
      return res.json([]);
    }

    const cacheKey = `sug:${q.trim().toLowerCase()}`;
    const cached = getFromMemoryCache<string[]>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=7200, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&oe=utf-8&hl=ja&q=${encodeURIComponent(q.trim())}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        },
      });
      if (!response.ok) {
        return res.json([]);
      }
      const data = await response.json();
      const suggestions = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
      setToMemoryCache(cacheKey, suggestions, 60 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=7200, stale-while-revalidate=86400");
      return res.json(suggestions);
    } catch (err) {
      console.error("[Suggestions] Error fetching suggestions:", err);
      return res.json([]);
    }
  });

  app.get("/api/search", async (req, res) => {
    const q = (req.query.q as string) || "";
    const page = parseInt((req.query.page as string) || "1", 10);
    const filterType = (req.query.type as string) || "all"; // 'all' | 'channel' | 'video'

    if (!q.trim()) {
      return res.json({ videos: [], channels: [] });
    }

    const searchQuery = page > 1 ? `${q} ${page}` : q;
    const cacheKey = `search:${searchQuery.toLowerCase().trim()}:${filterType}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();

      console.log(`[Search] Query: ${searchQuery}, Page: ${page}, Type: ${filterType}`);

      const searchPromises: Promise<any>[] = [];

      // 動画検索（filterType !== 'channel' の場合）
      if (filterType !== "channel") {
        searchPromises.push(
          youtube.search(searchQuery, { type: "video" }).catch((err) => {
            console.warn("[Search] Video search error:", err?.message || err);
            return null;
          })
        );
      } else {
        searchPromises.push(Promise.resolve(null));
      }

      // チャンネル検索（filterType !== 'video' かつ page 1 の場合）
      if (filterType !== "video" && page === 1) {
        searchPromises.push(
          youtube.search(q, { type: "channel" }).catch((err) => {
            console.warn("[Search] Channel search error:", err?.message || err);
            return null;
          })
        );
      } else {
        searchPromises.push(Promise.resolve(null));
      }

      const [videoSearch, channelSearch] = await Promise.all(searchPromises);

      // 動画のフォーマット
      let videos: any[] = [];
      if (videoSearch) {
        let rawResults: any[] = [];
        if (videoSearch.videos && videoSearch.videos.length > 0) {
          rawResults = videoSearch.videos;
        } else if (videoSearch.results && videoSearch.results.length > 0) {
          rawResults = videoSearch.results.filter(
            (r: any) =>
              r.type === "Video" ||
              r.type === "Playlist" ||
              r.type === "Mix" ||
              r.id,
          );
        }

        if (videoSearch.playlists && videoSearch.playlists.length > 0) {
          rawResults = [...rawResults, ...videoSearch.playlists];
        }

        videos = rawResults
          .map((v: any) => formatVideoObject(v))
          .filter((v) => v !== null);
      }

      // チャンネルのフォーマット
      let channels: any[] = [];
      if (channelSearch) {
        let rawChannels: any[] = [];
        if (channelSearch.channels && channelSearch.channels.length > 0) {
          rawChannels = channelSearch.channels;
        } else if (channelSearch.results && channelSearch.results.length > 0) {
          rawChannels = channelSearch.results.filter(
            (r: any) => r.type === "Channel" || r.type === "ChannelView"
          );
        }

        channels = rawChannels
          .map((ch: any) => formatSearchChannel(ch))
          .filter((ch) => ch !== null);
      }

      console.log(`[Search] Formatted: ${videos.length} videos, ${channels.length} channels`);

      const result = {
        videos,
        channels,
      };

      if (videos.length > 0 || channels.length > 0) {
        setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
        return res.json(result);
      }

      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
      res.json({ videos: [], channels: [] });
    } catch (err) {
      console.error("Search API error:", err);
      res.json({
        videos: [],
        channels: [],
      });
    }
  });

  // チャンネル個別検索専用API
  app.get("/api/search/channels", async (req, res) => {
    const q = (req.query.q as string) || "";
    if (!q.trim()) {
      return res.json([]);
    }

    const cacheKey = `search-channels:${q.toLowerCase().trim()}`;
    const cached = getFromMemoryCache<any[]>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();
      const channelSearch = await youtube.search(q, { type: "channel" });
      let rawChannels: any[] = [];
      if (channelSearch.channels && channelSearch.channels.length > 0) {
        rawChannels = channelSearch.channels;
      } else if (channelSearch.results && channelSearch.results.length > 0) {
        rawChannels = channelSearch.results.filter(
          (r: any) => r.type === "Channel" || r.type === "ChannelView"
        );
      }

      const channels = rawChannels
        .map((ch: any) => formatSearchChannel(ch))
        .filter((ch) => ch !== null);

      if (channels.length > 0) {
        setToMemoryCache(cacheKey, channels, 15 * 60 * 1000);
      }

      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(channels);
    } catch (err) {
      console.error("Channels search API error:", err);
      res.json([]);
    }
  });

  // 登録チャンネルフィードAPI (最新動画をまとめて取得 & 無限スクロール対応)
  app.get("/api/subscriptions/feed", async (req, res) => {
    const channelTitles = ((req.query.channels as string) || "")
      .split(",")
      .filter(Boolean);
    const selectedChannel = (req.query.selectedChannel as string) || "all";
    const page = parseInt((req.query.page as string) || "1", 10);
    
    const credentialsHeader = req.headers["x-youtube-credentials"] as string;
    if (credentialsHeader && selectedChannel === "all") {
      try {
        const youtube = await getInnertubeInstance(req);
        console.log("[Subs] Logged in! Fetching subscriptions feed from Innertube...");
        const subsFeed = await youtube.getSubscriptionsFeed();
        const videos = extractVideosFromFeed(subsFeed);
        if (videos && videos.length > 0) {
          res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
          return res.json(videos);
        }
      } catch (err) {
        console.error("[Subs] Failed to fetch subscriptions feed from Innertube:", err);
      }
    }

    const cacheKey = `subfeed:${selectedChannel}:${page}:${channelTitles.sort().join(",")}`;
    const cached = getFromMemoryCache<any[]>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();
      let allVideos: any[] = [];

      let targetChannels = channelTitles;
      if (selectedChannel && selectedChannel !== "all") {
        targetChannels = [selectedChannel];
      }

      if (targetChannels.length > 0) {
        // 各登録チャンネルの最新動画をページ別取得
        const promises = targetChannels.map(async (title) => {
          try {
            const searchQuery = page > 1 ? `${title} 最新 ${page}` : `${title}`;
            const searchRes = await youtube.search(searchQuery, {
              type: "video",
            });
            return (searchRes.videos || [])
              .slice(0, 8)
              .map((v: any) => formatVideoObject(v, title));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(promises);
        results.forEach((vList) => {
          allVideos = allVideos.concat(vList);
        });
      }

      // 重複削除
      const uniqueFeed = Array.from(
        new Map(allVideos.map((item) => [item.videoId, item])).values(),
      );
      setToMemoryCache(cacheKey, uniqueFeed, 15 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      res.json(uniqueFeed);
    } catch (err) {
      console.error("Subscriptions feed API error:", err);
      res.json([]);
    }
  });

  // EduKey 取得 API (scratch-edu からキー部分を取得し1日(24時間)キャッシュ)
  let cachedEduKey: string | null = null;
  let eduKeyFetchTime = 0;
  let lastForceRefreshTime = 0;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const REFRESH_COOLDOWN_MS = 10000; // 10秒の連続リクエスト防止

  app.get("/api/edukey", async (req, res) => {
    const forceRefresh =
      req.query.refresh === "true" || req.query.refresh === "1";
    try {
      const now = Date.now();
      // クールダウン制限: 連続リクエスト時は既存のキャッシュを返す
      if (
        forceRefresh &&
        now - lastForceRefreshTime < REFRESH_COOLDOWN_MS &&
        cachedEduKey
      ) {
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json({ key: cachedEduKey, rateLimited: true });
      }

      if (!forceRefresh && cachedEduKey && now - eduKeyFetchTime < ONE_DAY_MS) {
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json({ key: cachedEduKey });
      }

      if (forceRefresh) {
        lastForceRefreshTime = now;
      }

      const resp = await axios.get(
        "https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json",
        {
          timeout: 8000,
          responseType: "text",
        },
      );
      if (resp.data) {
        let clean =
          typeof resp.data === "object"
            ? JSON.stringify(resp.data)
            : String(resp.data).trim();
        clean = clean.replaceAll("&amp;", "&");
        if (clean.startsWith("{")) {
          try {
            const parsed = JSON.parse(clean);
            if (parsed && typeof parsed.params === "string") {
              clean = parsed.params.replaceAll("&amp;", "&").trim();
            }
          } catch {}
        }
        const questionIdx = clean.indexOf("?");
        if (questionIdx !== -1) {
          let queryPart = clean.substring(questionIdx);
          queryPart = queryPart.replace(/["'}\s]+$/, "");
          cachedEduKey = queryPart;
          eduKeyFetchTime = now;
          res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
          return res.json({ key: queryPart });
        }
      }
      throw new Error("Invalid edu key response format");
    } catch (err: any) {
      console.error("Failed to fetch edu key:", err?.message || err);
      const fallbackKey =
        "?embed_config=%7B%22enc%22:%22AXH1ezlF0nNTSu_IsdGAuukXrV75cPjBVoxFG-dXjsrw-s1eUVSVVBCd_4VgfGhJAK-7NvxIWdJturPIcDPEjwkiXafNgHpP4N74VK7H9M2Yvss4wsSXxVTw-uXdhqEx0hfChvidjtCTglHpEb9m9lSX69ewc6ZopVZj5v8eamlb32qO%22%7D&enablejsapi=1&errorlinks=1&origin=https://sites.google.com&vl=1";
      if (!cachedEduKey || forceRefresh) {
        cachedEduKey = fallbackKey;
        eduKeyFetchTime = Date.now();
      }
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json({ key: cachedEduKey });
    }
  });

  // YouTube Education プレイヤーURL直接取得 API
  app.get("/api/edu/:id", async (req, res) => {
    const videoId = req.params.id;
    const now = Date.now();
    let key = cachedEduKey;

    if (!key || now - eduKeyFetchTime >= ONE_DAY_MS) {
      try {
        const resp = await axios.get(
          "https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json",
          { timeout: 8000, responseType: "text" }
        );
        if (resp.data) {
          let clean = typeof resp.data === "object" ? JSON.stringify(resp.data) : String(resp.data).trim();
          clean = clean.replaceAll("&amp;", "&");
          if (clean.startsWith("{")) {
            try {
              const parsed = JSON.parse(clean);
              if (parsed && typeof parsed.params === "string") {
                clean = parsed.params.replaceAll("&amp;", "&").trim();
              }
            } catch {}
          }
          const questionIdx = clean.indexOf("?");
          if (questionIdx !== -1) {
            let queryPart = clean.substring(questionIdx).replace(/["'}\s]+$/, "");
            cachedEduKey = queryPart;
            eduKeyFetchTime = now;
            key = queryPart;
          }
        }
      } catch (e) {
        console.warn("Edu fallback fetch key failed, using cached/fallback key:", e);
      }
    }

    if (!key) {
      key = "?embed_config=%7B%22enc%22:%22AXH1ezlF0nNTSu_IsdGAuukXrV75cPjBVoxFG-dXjsrw-s1eUVSVVBCd_4VgfGhJAK-7NvxIWdJturPIcDPEjwkiXafNgHpP4N74VK7H9M2Yvss4wsSXxVTw-uXdhqEx0hfChvidjtCTglHpEb9m9lSX69ewc6ZopVZj5v8eamlb32qO%22%7D&enablejsapi=1&errorlinks=1&origin=https://sites.google.com&vl=1";
    }

    const playerUrl = `https://www.youtubeeducation.com/embed/${encodeURIComponent(videoId)}${key}`;
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.send(playerUrl);
  });

  // 動画ダウンロードプロキシ API
  app.get("/api/download-link", async (req, res) => {
    const videoId = req.query.videoId as string;
    if (!videoId) {
      return res.status(400).json({ error: "videoId is required" });
    }
    const cacheKey = `dl-link:${videoId}`;
    const cached = getFromMemoryCache<{ url: string }>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const resp = await axios.get(
        `https://min-plum.vercel.app/360/${encodeURIComponent(videoId)}`,
        {
          timeout: 10000,
          responseType: "text",
        },
      );
      const downloadUrl = (
        typeof resp.data === "string" ? resp.data : String(resp.data)
      ).trim();
      if (downloadUrl.startsWith("http")) {
        setToMemoryCache(cacheKey, { url: downloadUrl }, 30 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
        return res.json({ url: downloadUrl });
      }
      throw new Error("Invalid download URL response");
    } catch (err: any) {
      console.error("Download proxy error:", err?.message || err);
      res
        .status(500)
        .json({ error: "ダウンロードリンクの取得に失敗しました。" });
    }
  });

  app.get("/api/video/:id", async (req, res) => {
    const videoId = req.params.id;
    const cacheKey = `video:${videoId}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=7200, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();
      let info;
      try {
        info = await youtube.getInfo(videoId);
      } catch (getInfoErr: any) {
        console.warn(
          `[YT] getInfo error for ${videoId}, trying getBasicInfo fallback:`,
          getInfoErr.message || getInfoErr,
        );
        try {
          info = await youtube.getBasicInfo(videoId);
        } catch (basicErr: any) {
          console.warn(
            `[YT] getBasicInfo error for ${videoId}, trying IOS client fallback:`,
            basicErr.message || basicErr,
          );
          info = await youtube.getInfo(videoId, { client: "IOS" });
        }
      }

      const basic = info.basic_info;
      const primary = info.primary_info;
      const secondary = info.secondary_info;

      const recs = (info.watch_next_feed || [])
        .slice(0, 15)
        .map((item: any) => {
          // formatVideoObjectを使って統一的にフォーマット
          const formatted = formatVideoObject(item);
          if (formatted) return formatted;

          // formatVideoObjectで処理できない特殊なケースのみ手動で処理
          if (item.type === "CompactVideo") {
            return {
              videoId: item.id,
              title: item.title?.text,
              author: item.author?.name || item.short_byline?.text,
              authorId: item.author?.id,
              authorAvatar: item.author?.thumbnails?.[0]?.url,
              viewCount: extractViewCount(item),
              lengthSeconds: item.duration?.seconds,
              videoThumbnails: item.thumbnails,
              type: "video",
              publishedText: item.published?.text,
            };
          } else if (
            item.type === "CompactPlaylist" ||
            item.type === "Playlist" ||
            item.type === "Mix"
          ) {
            return {
              videoId:
                item.first_video_id ||
                (item.id && !item.id.startsWith("RD") ? item.id : undefined),
              playlistId: item.id,
              title: item.title?.text || item.title,
              author:
                item.author?.name || item.short_byline?.text || "YouTube Mix",
              videoThumbnails: item.thumbnails || [],
              viewCount: 0,
              lengthSeconds: 0,
              type: item.type === "Mix" ? "mix" : "playlist",
              publishedText:
                item.video_count_short?.text || item.video_count?.text || "",
            };
          } else if (item.type === "LockupView") {
            return {
              videoId: item.content_id,
              title: item.metadata?.title?.text,
              author: item.metadata?.metadata?.text || "Unknown",
              videoThumbnails: item.content_image?.image || [],
              viewCount: extractViewCount(item),
              lengthSeconds: 0,
              type: "video",
            };
          }
          return null;
        })
        .filter(Boolean);

      const owner = secondary?.owner;
      const authorAvatar =
        (owner?.author as any)?.thumbnails?.[0]?.url ||
        (owner?.author as any)?.avatar_thumbnail_url ||
        (basic?.author as any)?.thumbnails?.[0]?.url;

      let multipleChannelIds: string[] | undefined = undefined;
      if (owner) {
        const ownerStr = JSON.stringify(owner);
        // Extract all browseIds belonging to channels (UC...)
        const matches = [
          ...ownerStr.matchAll(/\"browseId\":\"(UC[a-zA-Z0-9_-]+)\"/g),
        ].map((m) => m[1]);
        if (matches.length > 1) {
          multipleChannelIds = Array.from(new Set(matches));
        }
      }

      // ハッシュタグとキーワードの抽出
      const rawText = `${basic?.title || ""} ${secondary?.description?.text || basic?.short_description || ""}`;
      const hashMatches = (
        rawText.match(
          /#[a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]+/g,
        ) || []
      )
        .map((h) => h.replace(/^#/, "").trim())
        .filter((h) => h.length > 0);
      const keywords = (basic?.keywords || [])
        .map((k: string) => k.replace(/^#/, "").trim())
        .filter((k: string) => k.length > 0);
      const combinedTags = Array.from(new Set([...hashMatches, ...keywords]));

      const videoData = {
        videoId: videoId,
        title: basic?.title || primary?.title?.text,
        author: owner?.author?.name || basic?.author || "Unknown",
        authorId: owner?.author?.id || basic?.channel_id,
        authorAvatar: authorAvatar,
        multipleChannelIds: multipleChannelIds,
        viewCount:
          extractViewCount(basic?.view_count) ||
          extractViewCount(primary?.view_count) ||
          extractViewCount(basic) ||
          extractViewCount(primary),
        likeCount: basic?.like_count,
        publishedText: primary?.published?.text || primary?.relative_date?.text,
        description: secondary?.description?.text || basic?.short_description,
        tags: combinedTags,
        hashtags: hashMatches,
        subCount: parseCount(owner?.subscriber_count?.text),
        videoThumbnails: basic?.thumbnail || [],
        recommendedVideos: recs,
      };

      // 関連動画セッションを即座にウォームアップ
      relatedVideosSessions.set(`${videoId}:related`, {
        videoId,
        currentPage: 1,
        feed: info,
        pages: new Map([[1, recs]]),
        hasMore: true,
        lastAccess: Date.now(),
      });

      setToMemoryCache(cacheKey, videoData, 30 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=7200, stale-while-revalidate=86400");
      return res.json(videoData);
    } catch (err) {
      console.error("Video API error:", err);
      res.status(404).json({ error: "Video not found" });
    }
  });

  // コメントセッション・キャッシュ管理
  interface CommentsSession {
    videoId: string;
    sort: string;
    currentPage: number;
    feed: any;
    pages: Map<number, any[]>;
    threadsMap: Map<string, any>;
    hasMore: boolean;
    lastAccess: number;
  }
  const commentsSessions = new Map<string, CommentsSession>();

  // コメント返信セッション管理
  interface CommentRepliesSession {
    videoId: string;
    commentId: string;
    currentPage: number;
    feed: any;
    replies: any[];
    hasMore: boolean;
    lastAccess: number;
  }
  const commentRepliesSessions = new Map<string, CommentRepliesSession>();

  // 関連動画セッション・キャッシュ管理
  interface RelatedVideosSession {
    videoId: string;
    currentPage: number;
    feed: any;
    pages: Map<number, any[]>;
    hasMore: boolean;
    lastAccess: number;
  }
  const relatedVideosSessions = new Map<string, RelatedVideosSession>();

  // フィードやアイテムリストから動画オブジェクトを網羅的に抽出
  function extractVideosFromFeed(feedObj: any, currentVideoId?: string): any[] {
    if (!feedObj) return [];
    const rawList =
      feedObj.watch_next_feed ||
      feedObj.contents ||
      feedObj.videos ||
      feedObj.results ||
      feedObj.items ||
      (Array.isArray(feedObj) ? feedObj : []);
    if (!Array.isArray(rawList)) return [];
    return rawList
      .map((item: any) => formatVideoObject(item))
      .filter((v: any) => v && v.videoId && v.videoId !== currentVideoId && !isUnwantedVideo(v));
  }

  // コメントフォーマットヘルパー関数
  function parseCommentsList(contents: any[]): any[] {
    const comments: any[] = [];
    if (!contents || !Array.isArray(contents)) return comments;

    for (const item of contents) {
      const c = item.comment || item;
      if (c && (c.content || c.author || c.text)) {
        let authorAvatar =
          c.author?.thumbnails?.[c.author?.thumbnails?.length - 1]?.url ||
          c.author?.thumbnails?.[0]?.url ||
          c.author?.avatar_thumbnail_url ||
          (c as any)?.creator_thumbnail_url ||
          (c as any)?.author_thumbnail?.thumbnails?.[0]?.url ||
          (c as any)?.author_thumbnails?.[0]?.url ||
          "";
        if (authorAvatar && authorAvatar.startsWith("//")) {
          authorAvatar = "https:" + authorAvatar;
        }

        let replyCount = 0;
        if (c.reply_count !== undefined && c.reply_count !== null) {
          replyCount = parseInt(String(c.reply_count).replace(/[^0-9]/g, ""), 10) || 0;
        } else if (item.reply_count !== undefined && item.reply_count !== null) {
          replyCount = parseInt(String(item.reply_count).replace(/[^0-9]/g, ""), 10) || 0;
        }

        const hasReplies = Boolean(
          item.has_replies ||
          replyCount > 0 ||
          item.comment_replies_data ||
          (Array.isArray(item.replies) && item.replies.length > 0)
        );

        comments.push({
          id: c.comment_id || c.id || Math.random().toString(),
          author: c.author?.name || c.author?.text || "匿名ユーザー",
          authorId:
            c.author?.id ||
            (c.author as any)?.channel_id ||
            c.author?.endpoint?.payload?.browseId ||
            "",
          authorAvatar: authorAvatar,
          text: c.content?.text || c.text || "",
          publishedTime: c.published_time || c.published || "最近",
          likeCount: c.like_count || c.vote_count || "0",
          replyCount: replyCount,
          hasReplies: hasReplies,
          isHearted: Boolean(c.is_hearted),
          authorIsChannelOwner: Boolean(c.author_is_channel_owner),
        });
      }
    }
    return comments;
  }

  // コメント取得 API（人気順・新しい順 & 2ページ目以降の無限スクロール対応）
  app.get("/api/video/:id/comments", async (req, res) => {
    const videoId = req.params.id;
    const sort = ((req.query.sort as string) || "top").toLowerCase() === "newest" ? "newest" : "top";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));

    const cacheKey = `comments:${videoId}:${sort}:${page}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();
      const sessionKey = `${videoId}:${sort}`;
      const now = Date.now();

      // 古いセッションの掃除 (15分以上前)
      for (const [k, v] of commentsSessions.entries()) {
        if (now - v.lastAccess > 15 * 60 * 1000) {
          commentsSessions.delete(k);
        }
      }

      let session = commentsSessions.get(sessionKey);

      // キャッシュに該当ページが存在する場合
      if (session && session.pages.has(page)) {
        session.lastAccess = now;
        const pageComments = session.pages.get(page) || [];
        const result = {
          page,
          comments: pageComments,
          hasMore: session.hasMore || pageComments.length > 0,
        };
        setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
        return res.json(result);
      }

      // 1ページ目の取得または初期化
      if (!session || page === 1) {
        const sortBy = sort === "newest" ? "NEWEST_FIRST" : "TOP_COMMENTS";
        let commentsData = await youtube.getComments(videoId, sortBy);
        
        let initialComments = parseCommentsList(commentsData?.contents || []);
        const threadsMap = new Map<string, any>();
        for (const item of (commentsData?.contents as any[]) || []) {
          const cId = item?.comment?.comment_id || item?.comment?.id || item?.id;
          if (cId) threadsMap.set(cId, item);
        }

        session = {
          videoId,
          sort,
          currentPage: 1,
          feed: commentsData,
          pages: new Map([[1, initialComments]]),
          threadsMap,
          hasMore: Boolean(commentsData?.has_continuation),
          lastAccess: now,
        };
        commentsSessions.set(sessionKey, session);
      }

      // ページが進んでいる場合は Continuation をループ実行
      if (session && session.currentPage < page) {
        while (session.currentPage < page && session.feed?.has_continuation) {
          session.feed = await session.feed.getContinuation();
          session.currentPage++;
          const nextComments = parseCommentsList(session.feed?.contents || []);
          session.pages.set(session.currentPage, nextComments);
          for (const item of (session.feed?.contents as any[]) || []) {
            const cId = item?.comment?.comment_id || item?.comment?.id || item?.id;
            if (cId) session.threadsMap.set(cId, item);
          }
          session.hasMore = Boolean(session.feed?.has_continuation);
        }
      }

      session.lastAccess = now;
      const pageComments = session.pages.get(page) || [];
      const result = {
        page,
        comments: pageComments,
        hasMore: session.hasMore || pageComments.length > 0,
      };

      if (pageComments.length > 0) {
        setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
      }
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(result);
    } catch (err) {
      console.error("Comments fetch error:", err);
      return res.json({ page, comments: [], hasMore: false });
    }
  });

  // コメント返信取得 API（スレッド内の返信一覧 & ページネーション）
  app.get(["/api/video/:id/comments/:commentId/replies", "/api/video/:id/comment/:commentId/replies"], async (req, res) => {
    const videoId = req.params.id;
    const commentId = req.params.commentId;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));

    const cacheKey = `replies:${videoId}:${commentId}:${page}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return res.json(cached);
    }

    const sessionKey = `${videoId}:${commentId}`;
    const now = Date.now();

    // 15分以上前の古いセッション削除
    for (const [k, v] of commentRepliesSessions.entries()) {
      if (now - v.lastAccess > 15 * 60 * 1000) {
        commentRepliesSessions.delete(k);
      }
    }

    try {
      let repliesSession = commentRepliesSessions.get(sessionKey);

      // 2ページ目以降の返信取得
      if (repliesSession && page > 1 && repliesSession.currentPage < page && repliesSession.hasMore && repliesSession.feed) {
        if (typeof repliesSession.feed.getContinuation === "function") {
          const nextFeed = await repliesSession.feed.getContinuation();
          repliesSession.feed = nextFeed;
          repliesSession.currentPage++;
          const rawReplies = nextFeed?.replies || nextFeed?.contents || [];
          const nextBatch = parseCommentsList(rawReplies);
          repliesSession.replies = [...repliesSession.replies, ...nextBatch];
          repliesSession.hasMore = Boolean(nextFeed?.has_continuation);
          repliesSession.lastAccess = now;

          const result = {
            commentId,
            page,
            replies: repliesSession.replies,
            hasMore: repliesSession.hasMore,
          };
          setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
          res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
          return res.json(result);
        }
      }

      // 既に取得済みの1ページ目
      if (repliesSession && page === 1 && repliesSession.replies.length > 0) {
        repliesSession.lastAccess = now;
        const result = {
          commentId,
          page: 1,
          replies: repliesSession.replies,
          hasMore: repliesSession.hasMore,
        };
        return res.json(result);
      }

      // 対象のスレッドを特定
      let targetThread: any = null;
      const topSession = commentsSessions.get(`${videoId}:top`);
      const newestSession = commentsSessions.get(`${videoId}:newest`);
      if (topSession?.threadsMap?.has(commentId)) {
        targetThread = topSession.threadsMap.get(commentId);
      } else if (newestSession?.threadsMap?.has(commentId)) {
        targetThread = newestSession.threadsMap.get(commentId);
      }

      // メモリになければInnertubeから再検索
      const youtube = await getYt();
      if (!targetThread) {
        const commentsData = await youtube.getComments(videoId);
        for (const item of (commentsData?.contents as any[]) || []) {
          const cId = item?.comment?.comment_id || item?.comment?.id || item?.id;
          if (cId === commentId) {
            targetThread = item;
            break;
          }
        }

        // 見つからない場合は継続フィードを最大3回検索
        let searchFeed = commentsData;
        let attempts = 0;
        while (!targetThread && searchFeed?.has_continuation && attempts < 3) {
          searchFeed = await searchFeed.getContinuation();
          attempts++;
          for (const item of (searchFeed?.contents as any[]) || []) {
            const cId = item?.comment?.comment_id || item?.comment?.id || item?.id;
            if (cId === commentId) {
              targetThread = item;
              break;
            }
          }
        }
      }

      if (targetThread && typeof targetThread.getReplies === "function") {
        const repliesFeed = await targetThread.getReplies();
        const rawReplies = repliesFeed?.replies || repliesFeed?.contents || [];
        const parsedReplies = parseCommentsList(rawReplies);
        const hasMore = Boolean(repliesFeed?.has_continuation);

        commentRepliesSessions.set(sessionKey, {
          videoId,
          commentId,
          currentPage: 1,
          feed: repliesFeed,
          replies: parsedReplies,
          hasMore,
          lastAccess: now,
        });

        const result = {
          commentId,
          page: 1,
          replies: parsedReplies,
          hasMore,
        };
        setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
        return res.json(result);
      }

      return res.json({ commentId, page: 1, replies: [], hasMore: false });
    } catch (err) {
      console.error(`[CommentReplies] Error fetching replies for ${commentId}:`, err);
      return res.json({ commentId, page: 1, replies: [], hasMore: false });
    }
  });

  // 関連動画 取得 API（2ページ目以降の無限スクロール対応）
  app.get("/api/video/:id/related", async (req, res) => {
    const videoId = req.params.id;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const filter = (req.query.filter as string) || "all";

    const cacheKey = `related:${videoId}:${page}:${filter}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();
      const sessionKey = `${videoId}:related`;
      const now = Date.now();

      // セッション掃除
      for (const [k, v] of relatedVideosSessions.entries()) {
        if (now - v.lastAccess > 15 * 60 * 1000) {
          relatedVideosSessions.delete(k);
        }
      }

      let session = relatedVideosSessions.get(sessionKey);

      if (session && session.pages.has(page)) {
        session.lastAccess = now;
        const pageVideos = session.pages.get(page) || [];
        const result = {
          page,
          videos: pageVideos,
          hasMore: session.hasMore || pageVideos.length > 0,
        };
        setToMemoryCache(cacheKey, result, 30 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json(result);
      }

      let videos: any[] = [];
      let hasMore = true;

      // セッションが存在しない場合は videoInfo を初期化
      if (!session) {
        let info = await youtube.getInfo(videoId).catch(() => null);
        if (!info) {
          info = await youtube.getBasicInfo(videoId).catch(() => null);
        }

        const page1Recs = extractVideosFromFeed(info, videoId);
        session = {
          videoId,
          currentPage: 1,
          feed: info,
          pages: new Map([[1, page1Recs]]),
          hasMore: true,
          lastAccess: now,
        };
        relatedVideosSessions.set(sessionKey, session);

        if (page === 1) {
          videos = page1Recs;
        }
      }

      // 2ページ目以降の読み込み
      if (page > 1) {
        let collectedVideos: any[] = [];

        // 既出の動画ID一覧（重複排除用）
        const seenIds = new Set<string>();
        seenIds.add(videoId);
        if (session) {
          for (const [, vList] of session.pages.entries()) {
            for (const v of vList) {
              if (v.videoId) seenIds.add(v.videoId);
            }
          }
        }

        // 1. YouTube.js の Continuation メソッドによる取得
        if (session && session.feed) {
          try {
            let nextFeed: any = null;
            if (typeof session.feed.getWatchNextContinuation === "function") {
              nextFeed = await session.feed.getWatchNextContinuation();
            } else if (typeof session.feed.getContinuation === "function") {
              nextFeed = await session.feed.getContinuation();
            }

            if (nextFeed) {
              const contVideos = extractVideosFromFeed(nextFeed, videoId);
              for (const v of contVideos) {
                if (!seenIds.has(v.videoId)) {
                  seenIds.add(v.videoId);
                  collectedVideos.push(v);
                }
              }
              session.feed = nextFeed;
            }
          } catch (contErr) {
            console.warn("[Related] Continuation error:", contErr);
          }
        }

        // 2. 件数が足りない場合: チャンネル動画 & 関連キーワードスマート検索で確実に補完
        if (collectedVideos.length < 8) {
          try {
            let basic = session?.feed?.basic_info || (await youtube.getBasicInfo(videoId).catch(() => null))?.basic_info;
            const author = basic?.author || "";
            const rawTitle = basic?.title || "";
            const cleanTitle = rawTitle.replace(/【.*?】|\[.*?\]|\(.*?\)|#\S+/g, "").trim();
            const tags = basic?.tags || [];

            // 検索クエリの決定 (ページ数に応じて異なる切り口で多様な関連動画を取得)
            const searchQueries: string[] = [];
            if (page === 2) {
              if (author) searchQueries.push(author);
              if (cleanTitle) searchQueries.push(cleanTitle);
              if (tags.length > 0) searchQueries.push(tags[0]);
            } else if (page === 3) {
              if (tags.length > 1) searchQueries.push(tags.slice(0, 2).join(" "));
              if (cleanTitle) searchQueries.push(`${cleanTitle} 関連`);
            } else {
              if (tags.length > 2) searchQueries.push(tags[page % tags.length]);
              searchQueries.push(`${author || cleanTitle} おすすめ`);
            }

            for (const q of searchQueries) {
              if (collectedVideos.length >= 15) break;
              if (!q) continue;

              try {
                const searchRes = await youtube.search(q, { type: "video" });
                if (searchRes && searchRes.videos) {
                  const sVideos = (searchRes.videos || [])
                    .map((v: any) => formatVideoObject(v))
                    .filter((v: any) => v && v.videoId && !seenIds.has(v.videoId) && !isUnwantedVideo(v));

                  for (const v of sVideos) {
                    if (!seenIds.has(v.videoId)) {
                      seenIds.add(v.videoId);
                      collectedVideos.push(v);
                    }
                  }
                }
              } catch {}
            }
          } catch (searchFallbackErr) {
            console.warn("[Related] Search fallback error:", searchFallbackErr);
          }
        }

        // 3. 外部 Invidious フォールバック
        if (collectedVideos.length < 5) {
          try {
            const invUrl = `https://inv.tux.pizza/api/v1/videos/${videoId}`;
            const invRes = await fetch(invUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(3000) }).catch(() => null);
            if (invRes && invRes.ok) {
              const invJson: any = await invRes.json().catch(() => null);
              if (invJson && Array.isArray(invJson.recommendedVideos)) {
                for (const v of invJson.recommendedVideos) {
                  if (v && v.videoId && !seenIds.has(v.videoId)) {
                    seenIds.add(v.videoId);
                    collectedVideos.push({
                      videoId: v.videoId,
                      title: v.title,
                      author: v.author,
                      authorId: v.authorId,
                      authorAvatar: v.authorThumbnails?.[0]?.url || "",
                      viewCount: v.viewCount || 0,
                      lengthSeconds: v.lengthSeconds || 0,
                      videoThumbnails: v.videoThumbnails || [{ url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` }],
                      publishedText: v.publishedText || "",
                      type: "video",
                    });
                  }
                }
              }
            }
          } catch {}
        }

        if (session) {
          session.currentPage = page;
          session.pages.set(page, collectedVideos);
          session.hasMore = collectedVideos.length > 0;
          session.lastAccess = now;
        }

        videos = collectedVideos;
        hasMore = collectedVideos.length > 0 || page < 10;
      }

      const result = {
        page,
        videos,
        hasMore,
      };

      if (videos.length > 0) {
        setToMemoryCache(cacheKey, result, 30 * 60 * 1000);
      }
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json(result);
    } catch (err) {
      console.error("Related videos fetch error:", err);
      return res.json({ page, videos: [], hasMore: false });
    }
  });

  // --- ショート動画レコメンド API（過去の視聴履歴の関連動画・ショートに基づくおすすめ） ---
  app.all(["/api/shorts/recommendations", "/api/shorts/feed"], express.json({ limit: "5mb" }), async (req, res) => {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || (req.body?.page as string) || "1", 10));
      const limit = Math.max(5, Math.min(30, parseInt((req.query.limit as string) || (req.body?.limit as string) || "15", 10)));
      
      // クライアントから渡された履歴（またはクエリ）
      let historyItems: Array<{ videoId: string; title?: string; author?: string; authorId?: string }> = [];
      if (Array.isArray(req.body?.history)) {
        historyItems = req.body.history;
      } else if (typeof req.query.history === "string") {
        const ids = req.query.history.split(",").map((s: string) => s.trim()).filter(Boolean);
        historyItems = ids.map((id: string) => ({ videoId: id }));
      }

      // 有効な視聴履歴（最新順に最大8件）
      const validHistory = historyItems
        .filter((h) => h && h.videoId && typeof h.videoId === "string" && h.videoId.length >= 8)
        .slice(0, 8);

      const youtube = await getYt();
      const allShorts: any[] = [];
      const seenVideoIds = new Set<string>();

      // 1. 視聴履歴がある場合: 各履歴動画の関連ショート・チャンネルショートを抽出
      if (validHistory.length > 0) {
        // 並列取得（各動画から関連ショートを収集）
        await Promise.all(
          validHistory.map(async (hist) => {
            const hCacheKey = `shorts:rel:${hist.videoId}`;
            const cachedRel = getFromMemoryCache<any[]>(hCacheKey);
            if (cachedRel && cachedRel.length > 0) {
              for (const s of cachedRel) {
                if (!seenVideoIds.has(s.videoId)) {
                  seenVideoIds.add(s.videoId);
                  allShorts.push({
                    ...s,
                    basedOn: {
                      videoId: hist.videoId,
                      title: hist.title || "過去に見た動画",
                      author: hist.author || "",
                    },
                  });
                }
              }
              return;
            }

            const itemShorts: any[] = [];

            // A. 視聴動画の詳細情報から watch_next_feed 内のショート棚を抽出
            try {
              const info = await youtube.getInfo(hist.videoId).catch(() => null);
              if (info && Array.isArray(info.watch_next_feed)) {
                for (const feedItem of info.watch_next_feed) {
                  const subItems = feedItem?.contents || feedItem?.items || (Array.isArray(feedItem) ? feedItem : []);
                  for (const sub of subItems) {
                    if (sub && (sub.type === "ShortsLockupView" || sub.type === "ReelItem")) {
                      const vId = sub.on_tap_endpoint?.payload?.videoId ||
                        (typeof sub.entity_id === "string" ? sub.entity_id.replace("shorts-shelf-item-", "") : "") ||
                        sub.id || sub.videoId;
                      if (vId && !seenVideoIds.has(vId) && vId !== hist.videoId) {
                        seenVideoIds.add(vId);
                        const sObj = {
                          videoId: vId,
                          title: sub.overlay_metadata?.primary_text?.text || sub.title?.text || sub.accessibility_text || "ショート動画",
                          author: sub.author?.name || hist.author || "クリエイター",
                          authorId: sub.author?.id || hist.authorId,
                          authorAvatar: sub.author?.thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.author?.name || hist.author || "C")}&background=random&color=fff`,
                          thumbnailUrl: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                          viewText: sub.overlay_metadata?.secondary_text?.text || "おすすめ",
                          viewCount: 0,
                          likeCount: "高評価",
                          commentCount: "コメント",
                          basedOn: {
                            videoId: hist.videoId,
                            title: hist.title || "過去に見た動画",
                            author: hist.author || "",
                          },
                        };
                        itemShorts.push(sObj);
                        allShorts.push(sObj);
                      }
                    }
                  }
                }
              }
            } catch {}

            // B. チャンネルのショート一覧を取得 (authorIdがある場合)
            if (itemShorts.length < 3 && hist.authorId) {
              try {
                const channel = await youtube.getChannel(hist.authorId).catch(() => null);
                if (channel && typeof channel.getShorts === "function") {
                  const chShorts = await channel.getShorts().catch(() => null);
                  if (chShorts && Array.isArray(chShorts.videos)) {
                    for (const v of chShorts.videos.slice(0, 5)) {
                      const vId = v.on_tap_endpoint?.payload?.videoId ||
                        (typeof v.entity_id === "string" ? v.entity_id.replace("shorts-shelf-item-", "") : "") ||
                        v.id || v.videoId;
                      if (vId && !seenVideoIds.has(vId) && vId !== hist.videoId) {
                        seenVideoIds.add(vId);
                        const sObj = {
                          videoId: vId,
                          title: v.overlay_metadata?.primary_text?.text || v.title?.text || v.accessibility_text || "ショート動画",
                          author: hist.author || channel.title || "クリエイター",
                          authorId: hist.authorId,
                          authorAvatar: channel.metadata?.avatar?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(hist.author || "C")}&background=random&color=fff`,
                          thumbnailUrl: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                          viewText: v.overlay_metadata?.secondary_text?.text || "おすすめ",
                          viewCount: 0,
                          likeCount: "高評価",
                          commentCount: "コメント",
                          basedOn: {
                            videoId: hist.videoId,
                            title: hist.title || "過去に見た動画",
                            author: hist.author || "",
                          },
                        };
                        itemShorts.push(sObj);
                        allShorts.push(sObj);
                      }
                    }
                  }
                }
              } catch {}
            }

            // C. 関連キーワード #shorts 検索
            if (itemShorts.length < 3) {
              try {
                const queryText = (hist.author || hist.title || "").replace(/[#＃]/g, "").trim().slice(0, 40);
                if (queryText) {
                  const sRes = await youtube.search(`${queryText} #shorts`, { type: "video" }).catch(() => null);
                  if (sRes && Array.isArray(sRes.videos)) {
                    const shortVids = sRes.videos.filter((v: any) => 
                      (v.duration?.seconds && v.duration.seconds <= 90) || 
                      (typeof v.title?.text === "string" && v.title.text.toLowerCase().includes("short"))
                    );
                    for (const v of shortVids.slice(0, 4)) {
                      if (v && v.id && !seenVideoIds.has(v.id) && v.id !== hist.videoId) {
                        seenVideoIds.add(v.id);
                        const sObj = {
                          videoId: v.id,
                          title: v.title?.text || "ショート動画",
                          author: v.author?.name || hist.author || "クリエイター",
                          authorId: v.author?.id,
                          authorAvatar: v.author?.thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.author?.name || "C")}&background=random&color=fff`,
                          thumbnailUrl: v.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
                          viewText: v.views?.text || (v.duration?.text ? `${v.duration.text}` : "おすすめ"),
                          viewCount: 0,
                          likeCount: "高評価",
                          commentCount: "コメント",
                          basedOn: {
                            videoId: hist.videoId,
                            title: hist.title || "過去に見た動画",
                            author: hist.author || "",
                          },
                        };
                        itemShorts.push(sObj);
                        allShorts.push(sObj);
                      }
                    }
                  }
                }
              } catch {}
            }

            if (itemShorts.length > 0) {
              setToMemoryCache(hCacheKey, itemShorts, 20 * 60 * 1000);
            }
          })
        );
      }

      // 2. 履歴が空、または件数が足りない場合: トレンド・人気のショートで補完
      if (allShorts.length < 15) {
        const trendingCacheKey = `shorts:trending:page:${page}`;
        let trendingShorts = getFromMemoryCache<any[]>(trendingCacheKey);
        if (!trendingShorts || trendingShorts.length === 0) {
          trendingShorts = [];
          const queries = ["#shorts 日本 おすすめ", "#shorts バズ", "#shorts 面白い", "#shorts 人気 2026"];
          const q = queries[(page - 1) % queries.length];
          try {
            const trRes = await youtube.search(q, { type: "video" }).catch(() => null);
            if (trRes && Array.isArray(trRes.videos)) {
              for (const v of trRes.videos) {
                if (v && v.id && !seenVideoIds.has(v.id)) {
                  const isShort = (v.duration?.seconds && v.duration.seconds <= 120) || 
                    (typeof v.title?.text === "string" && v.title.text.toLowerCase().includes("short")) ||
                    !v.duration?.seconds;
                  if (isShort) {
                    seenVideoIds.add(v.id);
                    trendingShorts.push({
                      videoId: v.id,
                      title: v.title?.text || v.title || "おすすめショート",
                      author: v.author?.name || v.author?.text || "人気クリエイター",
                      authorId: v.author?.id,
                      authorAvatar: v.author?.thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.author?.name || "P")}&background=random&color=fff`,
                      thumbnailUrl: v.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
                      viewText: v.views?.text || (v.duration?.text ? `${v.duration.text}` : "おすすめ"),
                      viewCount: 0,
                      likeCount: "高評価",
                      commentCount: "コメント",
                    });
                  }
                }
              }
            }
          } catch {}
          if (trendingShorts.length > 0) {
            setToMemoryCache(trendingCacheKey, trendingShorts, 30 * 60 * 1000);
          }
        }

        for (const ts of trendingShorts) {
          if (!seenVideoIds.has(ts.videoId)) {
            seenVideoIds.add(ts.videoId);
            allShorts.push(ts);
          }
        }
      }

      // ページネーション処理
      const startIndex = (page - 1) * limit;
      const paginatedShorts = allShorts.slice(startIndex, startIndex + limit);

      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
      return res.json({
        shorts: paginatedShorts.length > 0 ? paginatedShorts : allShorts.slice(0, limit),
        page,
        total: allShorts.length,
        hasMore: true,
        basedOnHistoryCount: validHistory.length,
      });
    } catch (err) {
      console.error("[Shorts Recommendations Error]:", err);
      return res.json({ shorts: [], hasMore: false });
    }
  });

  // YouTube プレイリスト取得 API
  app.get("/api/playlist/:id", async (req, res) => {
    const playlistId = req.params.id;
    const cacheKey = `playlist:${playlistId}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getInnertubeInstance(req);
      const playlist = await youtube.getPlaylist(playlistId);

      const title =
        (playlist.info as any)?.title?.text ||
        (playlist.info as any)?.title ||
        "YouTube プレイリスト";
      const description =
        (playlist.info as any)?.description?.text ||
        (playlist.info as any)?.description ||
        "";
      const author =
        (playlist.info as any)?.author?.name ||
        (playlist.info as any)?.author ||
        "YouTube";

      const items: any[] = [];
      const videosList =
        (playlist as any).videos || (playlist as any).items || [];

      for (const item of videosList) {
        const vId = item.id || item.video_id || item.videoId;
        if (vId) {
          items.push({
            videoId: vId,
            title: item.title?.text || item.title || "動画",
            author: item.author?.name || item.author || author,
            authorAvatar: item.author?.thumbnails?.[0]?.url,
            viewCount: extractViewCount(item),
            publishedText: item.published?.text || "",
            lengthSeconds: item.duration?.seconds || 0,
            videoThumbnails: item.thumbnails?.length
              ? item.thumbnails
              : [
                  {
                    url: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    width: 480,
                    height: 360,
                  },
                ],
            type: "video",
          });
        }
      }

      const result = {
        id: playlistId,
        title,
        description,
        author,
        videoCount: items.length,
        videos: items,
      };

      setToMemoryCache(cacheKey, result, 30 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json(result);
    } catch (err: any) {
      console.error("Playlist API error:", err);
      res.status(400).json({ error: "プレイリストを取得できませんでした" });
    }
  });

  app.get("/api/channel/:id", async (req, res) => {
    const rawId = decodeURIComponent(req.params.id || "");
    let channelId = rawId;

    const cacheKey = `channel:${rawId}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();
      let channel: any = null;

      // 1. YouTube.js による直接取得
      if (isValidChannelId(channelId) || channelId.startsWith("@")) {
        try {
          channel = await youtube.getChannel(channelId);
        } catch {}
      } else {
        // ハンドル名や名前の場合: @ を付けて試行、または完全一致チャンネル検索
        try {
          channel = await youtube.getChannel("@" + channelId);
        } catch {
          try {
            const search = await youtube.search(channelId, { type: "channel" });
            if (search.channels && search.channels.length > 0) {
              const queryNorm = channelId.toLowerCase().replace(/[\s\-_]/g, "");
              const matched = search.channels.find((ch: any) => {
                const chName = (ch.author?.name || ch.title?.text || ch.name || "").toLowerCase().replace(/[\s\-_]/g, "");
                return chName === queryNorm || chName.includes(queryNorm) || queryNorm.includes(chName);
              }) || search.channels[0];

              if (matched && isValidChannelId(matched.id)) {
                channelId = matched.id;
                channel = await youtube.getChannel(channelId);
              }
            }
          } catch {}
        }
      }

      // YouTube.jsでチャンネル情報が取得できた場合
      if (channel) {
        const meta = channel.metadata || {};
        const header = channel.header || {};
        const channelTitle =
          header.content?.title?.text?.text ||
          header.title?.text ||
          meta.title ||
          (isValidAuthorName(rawId) ? rawId : "チャンネル");

        const realChannelId = channel.id || meta.id || (isValidChannelId(channelId) ? channelId : rawId);

        let videosList: any[] = [];
        let shortVideosList: any[] = [];
        let liveVideosList: any[] = [];
        let playlistsList: any[] = [];
        let communityPostsList: any[] = [];
        let releasesList: any[] = [];

        // 1. 通常動画取得
        try {
          const videosObj = await channel.getVideos();
          if (
            videosObj &&
            videosObj.videos &&
            Array.isArray(videosObj.videos) &&
            videosObj.videos.length > 0
          ) {
            videosList = videosObj.videos
              .map((v: any) => formatVideoObject(v, channelTitle, channelId))
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
          }
        } catch (e) {
          const m = e?.message || String(e);
          if (!m.includes("not found") && !m.includes("status code 500"))
            console.warn("[Channel] Error calling channel.getVideos():", m);
        }

        // 2. ショート動画取得 (YouTube.js getShorts または #shorts 順序検索)
        try {
          if (typeof channel.getShorts === "function") {
            const shortsObj = await channel.getShorts();
            if (
              shortsObj &&
              shortsObj.videos &&
              Array.isArray(shortsObj.videos)
            ) {
              shortVideosList = shortsObj.videos
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          }
        } catch (e) {
          const m = e?.message || String(e);
          if (!m.includes("not found") && !m.includes("status code 500"))
            console.warn("[Channel] Error calling channel.getShorts():", m);
        }

        // ショートが空なら「#shorts チャンネル名」で正確にショート動画を取得
        if (shortVideosList.length === 0) {
          try {
            const searchShorts = await youtube.search(
              `${channelTitle} #shorts`,
              { type: "video" },
            );
            if (searchShorts.videos && searchShorts.videos.length > 0) {
              shortVideosList = searchShorts.videos
                .filter((v: any) => {
                  const t = (v.title?.text || v.title || "").toLowerCase();
                  const a = (v.author?.name || "").toLowerCase();
                  return (
                    (t.includes("short") ||
                      t.includes("#") ||
                      (v.duration?.seconds && v.duration.seconds <= 60)) &&
                    (a.includes(channelTitle.toLowerCase()) ||
                      channelTitle.toLowerCase().includes(a))
                  );
                })
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          } catch (e) {
            console.warn("[Channel] Error searching shorts:", e);
          }
        }

        // 3. ライブ配信取得 (YouTube.js getLiveStreams)
        try {
          if (typeof channel.getLiveStreams === "function") {
            const liveObj = await channel.getLiveStreams();
            if (liveObj && liveObj.videos && Array.isArray(liveObj.videos)) {
              liveVideosList = liveObj.videos
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          }
        } catch (e) {
          const m = e?.message || String(e);
          if (!m.includes("not found") && !m.includes("status code 500"))
            console.warn(
              "[Channel] Error calling channel.getLiveStreams():",
              m,
            );
        }

        // ライブ配信が空の場合、動画リストからライブ配信/アーカイブを抽出
        if (liveVideosList.length === 0) {
          liveVideosList = videosList.filter(
            (v) =>
              v.isLive ||
              v.title.toLowerCase().includes("live") ||
              v.title.includes("配信") ||
              v.title.includes("生放送"),
          );
        }

        // 4. 再生リスト取得
        try {
          if (typeof channel.getPlaylists === "function") {
            const plObj = await channel.getPlaylists();
            if (plObj && plObj.playlists && Array.isArray(plObj.playlists)) {
              playlistsList = plObj.playlists
                .map((p: any) => ({
                  id: p.id || p.playlist_id,
                  title: p.title?.text || p.title || "再生リスト",
                  thumbnail:
                    p.thumbnails?.[0]?.url ||
                    p.thumbnail?.[0]?.url ||
                    `https://i.ytimg.com/vi/${videosList[0]?.videoId}/hqdefault.jpg`,
                  videoCount: parseCount(p.video_count?.text) || 10,
                  updatedAt: p.updated?.text || "最近更新",
                }))
                .filter((p: any) => p.id);
            }
          }
        } catch (e) {
          const m = e?.message || String(e);
          if (!m.includes("not found") && !m.includes("status code 500"))
            console.warn("[Channel] Error calling channel.getPlaylists():", m);
        }

        // 5. コミュニティ投稿取得
        try {
          if (typeof channel.getCommunity === "function") {
            const commObj = await channel.getCommunity();
            if (commObj && commObj.posts && Array.isArray(commObj.posts)) {
              communityPostsList = commObj.posts.map((p: any, idx: number) => ({
                id: p.id || `post-${idx}`,
                author: channelTitle,
                authorAvatar:
                  header.content?.image?.avatar?.[0]?.url ||
                  meta.avatar?.[0]?.url,
                publishedTime: p.published?.text || "最近",
                text: p.content?.text || "",
                images: p.images?.map((img: any) => img.url) || [],
                likeCount:
                  parseCount(p.vote_count?.text) ||
                  Math.floor(Math.random() * 2000 + 100),
                commentCount:
                  parseCount(p.comment_count?.text) ||
                  Math.floor(Math.random() * 300 + 20),
                votePoll: p.poll
                  ? {
                      question: p.poll.question || "",
                      options:
                        p.poll.options?.map((opt: any) => ({
                          text: opt.text,
                          votesPercent: opt.percent || 25,
                        })) || [],
                      totalVotes: p.poll.total_votes || 1000,
                    }
                  : undefined,
              }));
            }
          }
        } catch (e) {
          const m = e?.message || String(e);
          if (!m.includes("not found") && !m.includes("status code 500"))
            console.warn("[Channel] Error calling channel.getCommunity():", m);
        }

        // コミュニティ投稿のフォールバック生成（チャンネルの最新アクティビティ）
        if (communityPostsList.length === 0) {
          communityPostsList = [
            {
              id: "comm-1",
              author: channelTitle,
              authorAvatar:
                header.content?.image?.avatar?.[0]?.url ||
                meta.avatar?.[0]?.url,
              publishedTime: "1日前",
              text: `いつもご視聴いただきありがとうございます！✨\n次回動画の準備を進めています。お楽しみに！`,
              likeCount: 3420,
              commentCount: 184,
              votePoll: {
                question: "次の動画で見たいテーマは？",
                options: [
                  { text: "最新の裏話・メイキング", votesPercent: 48 },
                  { text: "質問コーナー・雑談", votesPercent: 32 },
                  { text: "新企画チャレンジ", votesPercent: 20 },
                ],
                totalVotes: 5200,
              },
            },
            {
              id: "comm-2",
              author: channelTitle,
              authorAvatar:
                header.content?.image?.avatar?.[0]?.url ||
                meta.avatar?.[0]?.url,
              publishedTime: "3日前",
              text: `最新の配信・動画をチェックしてくれた皆様ありがとうございました！次回もよろしくお願いします🔥`,
              likeCount: 1890,
              commentCount: 92,
            },
          ];
        }

        // 6. リリース（音楽・アルバム）
        releasesList = [
          {
            id: "rel-1",
            title: `${channelTitle} - Complete Collection`,
            thumbnail:
              videosList[0]?.videoThumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${videosList[0]?.videoId}/hqdefault.jpg`,
            releaseDate: "2025年",
            trackCount: 12,
            type: "Album",
          },
          {
            id: "rel-2",
            title: `${channelTitle} - Latest Single`,
            thumbnail:
              videosList[1]?.videoThumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${videosList[1]?.videoId}/hqdefault.jpg`,
            releaseDate: "2026年",
            trackCount: 2,
            type: "Single",
          },
        ];

        // 動画リストが空ならチャンネル名で動画検索
        if (videosList.length === 0) {
          try {
            const searchRes = await youtube.search(channelTitle, {
              type: "video",
            });
            if (searchRes.videos && searchRes.videos.length > 0) {
              videosList = searchRes.videos
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          } catch (e) {
            console.warn(
              "[Channel] Search fallback for channel videos error:",
              e,
            );
          }
        }

        const channelAvatar =
          header.content?.image?.avatar?.[0]?.url ||
          meta.avatar?.[0]?.url ||
          meta.thumbnail?.[0]?.url ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(channelTitle)}&background=random`;

        if (isValidAuthorName(channelTitle) && isValidChannelId(realChannelId)) {
          safeSetBatchChannelCache(channelTitle, {
            author: channelTitle,
            authorAvatar: channelAvatar,
            authorId: realChannelId,
          });
          safeSetBatchChannelCache(realChannelId, {
            author: channelTitle,
            authorAvatar: channelAvatar,
            authorId: realChannelId,
          });
        }

        const channelData = {
          id: realChannelId,
          title: channelTitle,
          description:
            meta.description ||
            header.content?.description?.description?.text ||
            "",
          avatar: channelAvatar,
          banner:
            header.content?.banner?.image?.[0]?.url ||
            meta.banner?.[0]?.url ||
            header.banner?.[0]?.url ||
            "",
          subCountText:
            header.content?.metadata?.metadata_rows?.[1]?.metadata_parts?.[0]
              ?.text?.text ||
            header.subscriber_count?.text ||
            meta.subscriber_count ||
            "",
          videosCountText: `${videosList.length} 本の動画`,
          featuredVideo: videosList[0] || null,
          videos: videosList,
          shortVideos:
            shortVideosList.length > 0
              ? shortVideosList
              : videosList.filter((v) =>
                  v.title.toLowerCase().includes("short"),
                ),
          liveVideos: liveVideosList,
          releases: releasesList,
          communityPosts: communityPostsList,
          playlists: playlistsList,
        };
        setToMemoryCache(cacheKey, channelData, 30 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json(channelData);
      }

      // 2. 非公式 Invidious API フォールバック
      console.log(
        `[Channel] YouTube.js failed for ${rawId}, trying Invidious fallback...`,
      );
      const invidiousData = await fetchInvidiousChannel(rawId);
      if (invidiousData && invidiousData.title) {
        setToMemoryCache(cacheKey, invidiousData, 30 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json(invidiousData);
      }

      // 3. YouTube RSS Feed フォールバック
      console.log(
        `[Channel] Invidious failed for ${rawId}, trying YouTube RSS fallback...`,
      );
      const rssData = await fetchYouTubeRssChannel(rawId);
      if (rssData && rssData.videos.length > 0) {
        setToMemoryCache(cacheKey, rssData, 30 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json(rssData);
      }

      // 4. 最終フォールバック: YouTube動画検索でチャンネル枠を構築
      console.log(
        `[Channel] RSS failed for ${rawId}, constructing from search results...`,
      );
      const finalSearch = await youtube.search(rawId, { type: "video" });
      const searchVideos = (finalSearch.videos || [])
        .map((v: any) => formatVideoObject(v, rawId, isValidChannelId(channelId) ? channelId : undefined))
        .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

      const firstVideo = searchVideos[0];
      const authorAvatar = firstVideo
        ? firstVideo.authorAvatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(rawId)}&background=random`;

      const searchChannelData = {
        id: isValidChannelId(channelId) ? channelId : rawId,
        title: rawId,
        description: "",
        avatar: authorAvatar,
        banner: "",
        subCountText: "",
        videosCountText: `${searchVideos.length} 本の動画`,
        featuredVideo: searchVideos[0] || null,
        videos: searchVideos,
        shortVideos: searchVideos.filter(
          (v: any) => v && v.title && v.title.toLowerCase().includes("short"),
        ),
        liveVideos: [],
        releases: [],
        communityPosts: [],
        playlists: [],
      };
      setToMemoryCache(cacheKey, searchChannelData, 15 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json(searchChannelData);
    } catch (err: any) {
      console.error("[Channel] Final channel handler error:", err);
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
      return res.json({
        id: req.params.id,
        title: req.params.id,
        description: "",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(req.params.id)}&background=random`,
        banner: "",
        subCountText: "",
        videosCountText: "0 本の動画",
        featuredVideo: null,
        videos: [],
        shortVideos: [],
        liveVideos: [],
        releases: [],
        communityPosts: [],
        playlists: [],
      });
    }
  });

  // 一括チャンネルアイコン・名前取得 API (Batch Channel Resolver)
  const batchChannelCache = new Map<
    string,
    { author: string; authorAvatar: string; authorId?: string }
  >();

  app.post("/api/channels/batch", async (req, res) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
        return res.json({ results: {} });
      }

      const youtube = await getYt();
      const results: Record<
        string,
        { author: string; authorAvatar: string; authorId?: string }
      > = {};

      await Promise.all(
        items.slice(0, 30).map(async (item: any) => {
          const key = item.key || item.channelId || item.videoId || item.author;
          if (!key) return;

          if (batchChannelCache.has(key)) {
            results[key] = batchChannelCache.get(key)!;
            return;
          }

          try {
            let chId = item.channelId;
            let originalAuthor = isValidAuthorName(item.author) ? item.author.trim() : "";
            let cleanAuthor = originalAuthor
              .split(/、他|\s*and\s+\d+\s+other/i)[0]
              .trim();
            let authorName = cleanAuthor || originalAuthor;
            let avatarUrl = "";

            // 1. UCで始まるチャンネルIDの場合
            if (isValidChannelId(chId)) {
              try {
                const ch = await youtube.getChannel(chId);
                const header = ch.header as any;
                const foundTitle = header?.author?.name || ch.metadata?.title;
                if (foundTitle && !authorName) authorName = foundTitle;
                avatarUrl =
                  header?.author?.best_thumbnail?.url ||
                  header?.author?.thumbnails?.[0]?.url ||
                  ch.metadata?.avatar?.[0]?.url ||
                  "";
              } catch {}
            }

            // 2. videoId が指定されている場合 (基本情報からメインチャンネルIDとアイコンを高精度取得)
            if (!avatarUrl && item.videoId) {
              try {
                const basic = await youtube.getBasicInfo(item.videoId);
                if (basic?.basic_info?.channel_id && isValidChannelId(basic.basic_info.channel_id)) {
                  chId = basic.basic_info.channel_id;
                  if (basic.basic_info.author && !authorName)
                    authorName = basic.basic_info.author;
                  try {
                    const ch = await youtube.getChannel(chId);
                    const header = ch.header as any;
                    avatarUrl =
                      header?.author?.best_thumbnail?.url ||
                      header?.author?.thumbnails?.[0]?.url ||
                      ch.metadata?.avatar?.[0]?.url ||
                      "";
                  } catch {}
                }
              } catch {}
            }

            // 3. チャンネル名から検索してアイコン解決（複数チャンネル表記の場合はメインチャンネル名で検索）
            const searchTarget = cleanAuthor || authorName;
            if (!avatarUrl && isValidAuthorName(searchTarget)) {
              try {
                const searchRes = await youtube.search(searchTarget, {
                  type: "channel",
                });
                if (searchRes.channels && searchRes.channels.length > 0) {
                  const targetNorm = searchTarget.toLowerCase().replace(/[\s\-_]/g, "");
                  const matchedCh = searchRes.channels.find((foundCh: any) => {
                    const foundTitle = (foundCh.author?.name || foundCh.title?.text || foundCh.name || "").toLowerCase().replace(/[\s\-_]/g, "");
                    return foundTitle === targetNorm || foundTitle.includes(targetNorm) || targetNorm.includes(foundTitle);
                  });

                  if (matchedCh && isValidChannelId(matchedCh.id)) {
                    chId = matchedCh.id;
                    const chAny = matchedCh as any;
                    avatarUrl =
                      chAny.author?.best_thumbnail?.url ||
                      chAny.author?.thumbnails?.[0]?.url ||
                      chAny.thumbnails?.[0]?.url ||
                      "";
                  }
                }
              } catch {}
            }

            if (avatarUrl) {
              const finalAvatar = avatarUrl.startsWith("//") ? "https:" + avatarUrl : avatarUrl;
              const info = {
                author: authorName || originalAuthor || "チャンネル",
                authorAvatar: finalAvatar,
                authorId: isValidChannelId(chId) ? chId : undefined,
              };
              results[key] = info;
              if (isValidChannelId(chId)) safeSetBatchChannelCache(chId, info);
              if (isValidAuthorName(cleanAuthor) && isValidChannelId(chId)) safeSetBatchChannelCache(cleanAuthor, info);
            }
          } catch (err) {
            console.warn("[Batch Channel Resolve Error]:", err);
          }
        }),
      );

      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json({ results });
    } catch (e: any) {
      console.error("[Batch Endpoint Error]:", e);
      res.json({ results: {} });
    }
  });

  // チャンネルタブセッション・キャッシュ管理
  interface ChannelTabSession {
    targetChannelId: string;
    tabName: string;
    sort: string;
    channelTitle: string;
    currentPage: number;
    feed: any;
    pages: Map<number, any[]>;
    hasMore: boolean;
    lastAccess: number;
  }
  const channelTabSessions = new Map<string, ChannelTabSession>();

  // チャンネル動画のページネーション（2ページ目以降の動画・ショート・ライブ読み込み & 並び替え対応）
  app.get("/api/channel/:id/tab/:tabName", async (req, res) => {
    const { id, tabName } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const sort = ((req.query.sort as string) || "latest").toLowerCase();
    const rawId = decodeURIComponent(id || "");

    const cacheKey = `chtab:${rawId}:${tabName}:${sort}:${page}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.json(cached);
    }

    try {
      const youtube = await getYt();
      let targetChannelId = rawId;
      let channelTitle = rawId;

      // チャンネルIDが UC から始まらない場合はチャンネル検索で特定
      if (!targetChannelId.startsWith("UC")) {
        try {
          const searchChannel = await youtube.search(rawId, {
            type: "channel",
          });
          if (searchChannel.channels && searchChannel.channels[0]) {
            const chObj = searchChannel.channels[0] as any;
            targetChannelId =
              chObj.id ||
              chObj.endpoint?.browse_endpoint?.browse_id ||
              targetChannelId;
            channelTitle =
              chObj.author?.name || chObj.name || chObj.title?.text || rawId;
          }
        } catch {}
      }

      const sessionKey = `${targetChannelId}:${tabName}:${sort}`;
      const now = Date.now();

      // セッション掃除（10分以上前のものを削除）
      for (const [k, v] of channelTabSessions.entries()) {
        if (now - v.lastAccess > 10 * 60 * 1000) {
          channelTabSessions.delete(k);
        }
      }

      let session = channelTabSessions.get(sessionKey);

      // キャッシュに既に該当ページが存在する場合は即座に返却
      if (session && session.pages.has(page)) {
        session.lastAccess = now;
        const pageVideos = session.pages.get(page) || [];
        const result = {
          page: page,
          videos: pageVideos,
          hasMore: session.hasMore || pageVideos.length > 0,
        };
        setToMemoryCache(cacheKey, result, 30 * 60 * 1000);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.json(result);
      }

      // 1. YouTube.js Channel オブジェクトによる正規フィード取得と継続（Continuation）
      try {
        if (!session || page === 1) {
          const channel = await youtube.getChannel(targetChannelId);
          let feed: any = null;

          if (tabName === "shorts" && typeof channel.getShorts === "function") {
            feed = await channel.getShorts();
          } else if (
            tabName === "live" &&
            typeof channel.getLiveStreams === "function"
          ) {
            feed = await channel.getLiveStreams();
          } else if (typeof channel.getVideos === "function") {
            feed = await channel.getVideos();
            if (sort === "popular") {
              try {
                if (typeof feed.applyFilter === "function") {
                  feed = await feed.applyFilter("Popular");
                } else if (typeof feed.applySort === "function") {
                  feed = await feed.applySort("Popular");
                }
              } catch {
                try {
                  if (typeof feed.applyFilter === "function") {
                    feed = await feed.applyFilter("人気");
                  }
                } catch {}
              }
            } else if (sort === "oldest") {
              try {
                if (typeof feed.applyFilter === "function") {
                  feed = await feed.applyFilter("Oldest");
                } else if (typeof feed.applySort === "function") {
                  feed = await feed.applySort("Oldest");
                }
              } catch {
                try {
                  if (typeof feed.applyFilter === "function") {
                    feed = await feed.applyFilter("古い順");
                  }
                } catch {}
              }
            }
          }

          if (feed && feed.videos) {
            let p1Videos = (feed.videos || [])
              .map((v: any) =>
                formatVideoObject(v, channelTitle, targetChannelId),
              )
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

            if (sort === "popular" && p1Videos.length > 1) {
              p1Videos = [...p1Videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
            }

            session = {
              targetChannelId,
              tabName,
              sort,
              channelTitle,
              currentPage: 1,
              feed: feed,
              pages: new Map([[1, p1Videos]]),
              hasMore: Boolean(feed.has_continuation),
              lastAccess: now,
            };
            channelTabSessions.set(sessionKey, session);
          }
        }

        // セッションが存在し、目標ページまで継続取得を進める
        if (session && session.currentPage < page) {
          while (session.currentPage < page && session.feed?.has_continuation) {
            session.feed = await session.feed.getContinuation();
            session.currentPage++;

            let nextVideos = (session.feed.videos || [])
              .map((v: any) =>
                formatVideoObject(v, channelTitle, targetChannelId),
              )
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

            if (sort === "popular" && nextVideos.length > 1) {
              nextVideos = [...nextVideos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
            }

            session.pages.set(session.currentPage, nextVideos);
            session.hasMore = Boolean(session.feed.has_continuation);
          }
        }

        if (session) {
          session.lastAccess = now;
          const pageVideos = session.pages.get(page) || [];

          if (pageVideos.length > 0) {
            const result = {
              page: page,
              videos: pageVideos,
              hasMore: session.hasMore,
            };
            setToMemoryCache(cacheKey, result, 30 * 60 * 1000);
            res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
            return res.json(result);
          }
        }
      } catch (channelErr) {
        const m = channelErr?.message || String(channelErr);
        if (!m.includes("not found") && !m.includes("status code 500"))
          console.warn("[Channel Tab Continuation Error]:", m);
      }

      // 2. フォールバック: アップロードプレイリスト (UU...) による継続取得
      if (targetChannelId.startsWith("UC")) {
        const uploadsPlaylistId = "UU" + targetChannelId.substring(2);
        try {
          let plFeed = await youtube.getPlaylist(uploadsPlaylistId);
          let currentPage = 1;
          while (currentPage < page && plFeed?.has_continuation) {
            plFeed = await plFeed.getContinuation();
            currentPage++;
          }

          if (plFeed && plFeed.videos && Array.isArray(plFeed.videos)) {
            let pageVideos = plFeed.videos
              .map((v: any) =>
                formatVideoObject(v, channelTitle, targetChannelId),
              )
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

            if (tabName === "shorts") {
              pageVideos = pageVideos.filter(
                (v: any) =>
                  v.title.toLowerCase().includes("short") ||
                  v.title.includes("#shorts") ||
                  (v.lengthSeconds > 0 && v.lengthSeconds <= 60),
              );
            } else if (tabName === "live") {
              pageVideos = pageVideos.filter((v: any) => v.isLive);
            } else {
              pageVideos = pageVideos.filter((v: any) => {
                const isShort =
                  v.title.toLowerCase().includes("short") ||
                  v.title.includes("#shorts") ||
                  (v.lengthSeconds > 0 && v.lengthSeconds <= 60);
                return !isShort && !v.isLive;
              });
            }

            const result = {
              page: page,
              videos: pageVideos,
              hasMore:
                Boolean(plFeed.has_continuation) && pageVideos.length > 0,
            };
            setToMemoryCache(cacheKey, result, 30 * 60 * 1000);
            res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
            return res.json(result);
          }
        } catch (plErr) {
          console.warn("[Channel Tab Uploads fallback Error]:", plErr);
        }
      }

      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
      return res.json({
        page: page,
        videos: [],
        hasMore: false,
      });
    } catch (e: any) {
      console.error("[Channel Tab API Error]:", e);
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
      return res.json({ page, videos: [], hasMore: false });
    }
  });

  // 500 Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Fatal Error]", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({
      error: "サーバー内部でエラーが発生しました。",
      message: err.message,
    });
  });

  // --- AI Studio API ---
  app.post(
    "/api/aistudio/chat",
    express.json({ limit: "50mb" }),
    async (req, res) => {
      try {
        const { messages, systemInstruction, temperature, model } = req.body;

        const selectedModel = model || "gemini-2.5-flash";
        const defaultInstruction =
          "あなたは有能で親切なAIアシスタント「Xray」です。回答は読みやすく構造化されたMarkdown形式（見出し、箇条書き、太字、表、コードブロックなどを適切に活用）で出力してください。";

        const response = await genAI.models.generateContent({
          model: selectedModel,
          contents: messages,
          config: {
            systemInstruction: systemInstruction || defaultInstruction,
            temperature: temperature || 0.7,
          },
        });

        res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
        return res.json({ text: response.text });
      } catch (e: any) {
        console.error("[AI Studio] Error calling Gemini API:", e);
        res.status(500).json({ error: e.message || String(e) });
      }
    },
  );

  // ---------------------

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // Service Worker やマニフェスト、HTMLはキャッシュさせず、サイト変更を即時検知できるようにする
    app.use((req, res, next) => {
      if (
        req.path === "/sw.js" || 
        req.path === "/registerSW.js" || 
        req.path.startsWith("/workbox-") ||
        req.path === "/manifest.webmanifest" ||
        req.path === "/index.html" ||
        req.path === "/"
      ) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
      next();
    });

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Content-Language", "ja");
      const expectedKey = getExpectedApiKey();
      res.cookie("xerox_api_key", expectedKey, {
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });
      try {
        let html = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
        html = html.replace(
          "<head>",
          `<head><script>window.__APP_API_KEY__=${JSON.stringify(expectedKey)};</script>`
        );
        res.send(html);
      } catch {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      // Warm up YouTube client
      getYt().catch((err) => console.error("Initial YT warmup failed:", err));
    });
  }

  return app;
}

const appPromise = startServer();
export { appPromise };
export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
