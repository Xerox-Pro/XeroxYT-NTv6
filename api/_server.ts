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
    const maxAttempts = 2;

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
        await new Promise((r) => setTimeout(r, 1000));
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

async function fetchInvidiousSearch(query: string) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const resp = await axios.get(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        {
          timeout: 3000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );
      if (Array.isArray(resp.data) && resp.data.length > 0) {
        return resp.data.map((v: any) => ({
          videoId: v.videoId,
          title: v.title || "動画",
          author: v.author || "チャンネル",
          authorId: v.authorId || "",
          authorAvatar: v.authorThumbnails?.[v.authorThumbnails.length - 1]?.url || "",
          viewCount: v.viewCount || 0,
          publishedText: v.publishedText || "",
          lengthSeconds: v.lengthSeconds || 0,
          videoThumbnails: [
            {
              url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
              width: 480,
              height: 360,
            },
          ],
          type: "video",
        }));
      }
    } catch (e) {
      // try next instance
    }
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

  return 0;
}

function isUnwantedVideo(v: any) {
  if (!v) return true;
  const videoId = v.id || v.videoId || v.content_id || "";
  if (videoId === "dQw4w9WgXcQ" || videoId.includes("dQw4w9WgXcQ"))
    return true;

  const title = (v.title?.text || v.title || "").toLowerCase();
  const author = (v.author?.name || v.author || "").toLowerCase();
  const text = title + " " + author;

  if (
    text.includes("never gonna give you up") ||
    text.includes("rick astley")
  ) {
    return true;
  }

  const unwanted = [
    "作業用",
    "bgm",
    "睡眠用",
    "勉強用",
    "healing",
    "relaxing",
    "study music",
  ];

  return unwanted.some((kw) => text.includes(kw));
}

function formatVideoObject(v: any, fallbackAuthor?: string, fallbackChannelId?: string): any {
  if (!v) return null;
  const isPlaylist = v.type === "Playlist" || v.type === "Mix" || v.type === "CompactPlaylist";
  const videoId = isPlaylist ? v.first_video_id || undefined : v.id || v.videoId;
  const playlistId = isPlaylist ? v.id || v.playlistId : v.playlistId || undefined;

  if (!videoId && !playlistId) return null;

  const title = v.title?.text || (typeof v.title === "string" ? v.title : "") || "タイトルなし";
  const author = v.author?.name || v.author?.text || (typeof v.author === "string" ? v.author : "") || fallbackAuthor || "チャンネル";
  const authorId = v.author?.id || v.channel_id || fallbackChannelId;
  const authorAvatar = v.author?.thumbnails?.[0]?.url || v.channel_thumbnail?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=random`;

  const thumbnails = v.thumbnails || v.videoThumbnails || [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 }];

  return {
    videoId,
    playlistId,
    type: v.type?.toLowerCase() || (playlistId ? "playlist" : "video"),
    title,
    author,
    authorId,
    authorAvatar,
    viewCount: extractViewCount(v),
    publishedText: v.published?.text || v.publishedText || "",
    lengthSeconds: v.duration?.seconds || v.lengthSeconds || 0,
    videoThumbnails: thumbnails,
    isLive: Boolean(v.is_live),
    isPremiere: Boolean(v.is_premiere),
  };
}

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

  return {
    id,
    title,
    handle: ch.subscriber_count?.text?.startsWith("@") ? ch.subscriber_count.text : "",
    avatar,
    subscribers: ch.subscriber_count?.text || "",
    videoCount: ch.video_count?.text || "",
    description: ch.description_snippet?.text || ch.description?.text || "",
    isVerified: Boolean(ch.author?.is_verified),
  };
}

// Memory Cache
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

// Curated Fallback Japanese Videos Pool
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
  }
];

const CURATED_FALLBACK_SHORTS = [
  {
    videoId: "y4v6c3z2k8A",
    title: "天才的に美味しすぎる簡単おやつ #shorts",
    author: "バズレシピ",
    authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_m4K5_j8X3=s176-c-k-c0x00ffffff-no-rj",
    thumbnailUrl: "https://i.ytimg.com/vi/y4v6c3z2k8A/hqdefault.jpg",
    viewText: "120万回視聴",
    viewCount: 1200000,
    type: "short"
  },
  {
    videoId: "p8v2k3n9m1B",
    title: "猫の神対応がかわいすぎた #shorts",
    author: "もちまる日記",
    authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_n8J3_j4K2L5xM8=s176-c-k-c0x00ffffff-no-rj",
    thumbnailUrl: "https://i.ytimg.com/vi/p8v2k3n9m1B/hqdefault.jpg",
    viewText: "240万回視聴",
    viewCount: 2400000,
    type: "short"
  },
  {
    videoId: "k3n9m1Bp8v2",
    title: "プロゲーム実況者の神プレー集 #shorts",
    author: "ドズル社",
    authorAvatar: "https://yt3.googleusercontent.com/ytc/AIdro_n4K3w7M2_j5K9D8x1sL2k3J5P8Q=s176-c-k-c0x00ffffff-no-rj",
    thumbnailUrl: "https://i.ytimg.com/vi/k3n9m1Bp8v2/hqdefault.jpg",
    viewText: "85万回視聴",
    viewCount: 850000,
    type: "short"
  }
];

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  // CORS and Headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  // Config Endpoint
  app.get("/api/config", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ apiKey: "xerox_api_key_2026", appName: "XeroxYT" });
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Search Suggestions API
  app.get("/api/suggestions", async (req, res) => {
    const q = (req.query.q as string) || "";
    if (!q.trim()) return res.json([]);

    const cacheKey = `sug:${q.trim().toLowerCase()}`;
    const cached = getFromMemoryCache<string[]>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&oe=utf-8&hl=ja&q=${encodeURIComponent(q.trim())}`;
      const response = await axios.get(url, {
        timeout: 2500,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const suggestions = Array.isArray(response.data?.[1]) ? response.data[1] : [];
      setToMemoryCache(cacheKey, suggestions, 60 * 60 * 1000);
      return res.json(suggestions);
    } catch {
      return res.json([]);
    }
  });

  // Main Search API (Strict Non-Blocking)
  app.get("/api/search", async (req, res) => {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const filterType = (req.query.type as string) || "all";

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
      const youtube = await withTimeout(getYt(), 2500, null as any);
      let videos: any[] = [];
      let channels: any[] = [];

      if (youtube) {
        const searchPromises: Promise<any>[] = [];
        if (filterType !== "channel") {
          searchPromises.push(
            withTimeout(youtube.search(searchQuery, { type: "video" }), 3000, null)
          );
        } else {
          searchPromises.push(Promise.resolve(null));
        }

        if (filterType !== "video" && page === 1) {
          searchPromises.push(
            withTimeout(youtube.search(q, { type: "channel" }), 2500, null)
          );
        } else {
          searchPromises.push(Promise.resolve(null));
        }

        const [videoSearch, channelSearch] = await Promise.all(searchPromises);

        if (videoSearch) {
          const rawVids = videoSearch.videos || videoSearch.results || [];
          videos = rawVids.map((v: any) => formatVideoObject(v)).filter(Boolean);
        }

        if (channelSearch) {
          const rawChs = channelSearch.channels || channelSearch.results || [];
          channels = rawChs.map((c: any) => formatSearchChannel(c)).filter(Boolean);
        }
      }

      // Fallback via Invidious if YouTube.js search failed/timed out
      if (videos.length === 0 && filterType !== "channel") {
        const invidiousVids = await fetchInvidiousSearch(q);
        if (invidiousVids && invidiousVids.length > 0) {
          videos = invidiousVids;
        }
      }

      const result = { videos, channels };
      if (videos.length > 0 || channels.length > 0) {
        setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
      }
      res.setHeader("Cache-Control", "public, s-maxage=1200, stale-while-revalidate=86400");
      return res.json(result);
    } catch (err) {
      console.warn("Search API fallback triggered:", err);
      return res.json({ videos: [], channels: [] });
    }
  });

  // Home Recommendations API
  app.get("/api/recommendations", async (req, res) => {
    const keywords = (req.query.keywords as string) || "";
    const historyIds = ((req.query.historyIds as string) || "").split(",").filter(Boolean);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const seed = Date.now();

    const cacheKey = `recs:p${page}:${keywords.slice(0, 30)}:${historyIds.slice(0, 2).join(",")}`;
    const cachedData = getFromMemoryCache<any>(cacheKey);
    if (cachedData) {
      res.setHeader("Cache-Control", "public, s-maxage=1200, stale-while-revalidate=86400");
      return res.json(cachedData);
    }

    try {
      const youtube = await withTimeout(getYt(), 2500, null as any);
      let videos: any[] = [];
      let geminiKeywords: string[] = [];

      if (youtube) {
        // 1. History watch next feed
        const sampled = historyIds.slice(0, 2);
        if (sampled.length > 0) {
          const relTasks = sampled.map((id) =>
            withTimeout(youtube.getBasicInfo(id), 1800, null as any)
          );
          const rels = await Promise.all(relTasks);
          rels.forEach((r) => {
            if (r?.watch_next_feed) {
              videos.push(...r.watch_next_feed);
            }
          });
        }

        // 2. Search queries
        const defaultCats = ["日本 トレンド 人気動画 2026", "YouTube Music 日本 話題の曲", "人気 ゲーム実況 最新"];
        const searchTasks = defaultCats.slice(0, 2).map((cat) =>
          withTimeout(youtube.search(cat, { type: "video" }), 2000, null as any)
        );
        const sRes = await Promise.all(searchTasks);
        sRes.forEach((r) => {
          if (r?.videos) videos.push(...r.videos);
        });
      }

      let formatted = videos.map((v) => formatVideoObject(v)).filter((v) => v && !isUnwantedVideo(v));
      const unique = Array.from(new Map(formatted.map((v) => [v.videoId, v])).values());

      let finalVideos = unique.length > 0 ? unique : CURATED_FALLBACK_VIDEOS;
      const payload = { videos: finalVideos, aiKeywords: geminiKeywords, seed };

      setToMemoryCache(cacheKey, payload, 15 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=1200, stale-while-revalidate=86400");
      return res.json(payload);
    } catch {
      return res.json({ videos: CURATED_FALLBACK_VIDEOS, aiKeywords: [], seed });
    }
  });

  // Shorts Recommendations & Filtered Recommendations API
  // ユーザーの好み(履歴、キーワード、ハッシュタグ)をShorts用に最適転用
  app.all(["/api/shorts/recommendations", "/api/shorts/feed"], express.json({ limit: "5mb" }), async (req, res) => {
    try {
      const body = req.body || {};
      const query = req.query || {};
      const page = Math.max(1, parseInt((query.page as string) || (body.page as string) || "1", 10));
      const limit = Math.max(5, Math.min(30, parseInt((query.limit as string) || (body.limit as string) || "12", 10)));
      const keywords = (query.keywords as string) || (body.keywords as string) || "";

      let historyItems: any[] = [];
      if (Array.isArray(body.history)) {
        historyItems = body.history;
      } else if (typeof query.history === "string") {
        historyItems = query.history.split(",").map((id: string) => ({ videoId: id.trim() }));
      }

      const validHistory = historyItems.filter((h) => h && h.videoId).slice(0, 5);
      const cacheKey = `shorts:recs:p${page}:${keywords.slice(0, 30)}:${validHistory.map((h) => h.videoId).join(",")}`;
      const cachedShorts = getFromMemoryCache<any>(cacheKey);
      if (cachedShorts) {
        res.setHeader("Cache-Control", "public, s-maxage=1200, stale-while-revalidate=86400");
        return res.json(cachedShorts);
      }

      const youtube = await withTimeout(getYt(), 2500, null as any);
      const allShorts: any[] = [];
      const seenIds = new Set<string>();

      if (youtube) {
        // 1. 履歴動画の関連ショート情報から抽出
        if (validHistory.length > 0) {
          await Promise.all(
            validHistory.slice(0, 3).map(async (hist) => {
              try {
                const info = await withTimeout(youtube.getInfo(hist.videoId), 2000, null as any);
                if (info && Array.isArray(info.watch_next_feed)) {
                  for (const feedItem of info.watch_next_feed) {
                    const subItems = feedItem?.contents || feedItem?.items || (Array.isArray(feedItem) ? feedItem : []);
                    for (const sub of subItems) {
                      if (sub && (sub.type === "ShortsLockupView" || sub.type === "ReelItem")) {
                        const vId = sub.on_tap_endpoint?.payload?.videoId || sub.id || sub.videoId;
                        if (vId && !seenIds.has(vId)) {
                          seenIds.add(vId);
                          allShorts.push({
                            videoId: vId,
                            title: sub.overlay_metadata?.primary_text?.text || sub.title?.text || "ショート動画",
                            author: sub.author?.name || hist.author || "クリエイター",
                            authorId: sub.author?.id || hist.authorId,
                            authorAvatar: sub.author?.thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.author?.name || "C")}&background=random`,
                            thumbnailUrl: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                            viewText: sub.overlay_metadata?.secondary_text?.text || "おすすめ",
                            viewCount: 0,
                            type: "short",
                          });
                        }
                      }
                    }
                  }
                }
              } catch {}
            })
          );
        }

        // 2. 検索クエリ + #shorts パラメーターでパーソナライズサンプリング
        const searchKeywords = [
          keywords ? `${keywords} #shorts` : null,
          "#shorts バズ おすすめ 2026",
          "#shorts 面白い 人気",
          "#shorts 日本 トレンド",
        ].filter(Boolean) as string[];

        const searchTasks = searchKeywords.slice(0, 2).map((qStr) =>
          withTimeout(youtube.search(qStr, { type: "video" }), 2500, null as any)
        );

        const sResults = await Promise.all(searchTasks);
        sResults.forEach((sRes) => {
          if (sRes && Array.isArray(sRes.videos)) {
            for (const v of sRes.videos) {
              if (v && v.id && !seenIds.has(v.id)) {
                const isShort = (v.duration?.seconds && v.duration.seconds <= 90) ||
                  (typeof v.title?.text === "string" && v.title.text.toLowerCase().includes("short")) ||
                  !v.duration?.seconds;
                if (isShort) {
                  seenIds.add(v.id);
                  allShorts.push({
                    videoId: v.id,
                    title: v.title?.text || v.title || "おすすめショート",
                    author: v.author?.name || v.author?.text || "クリエイター",
                    authorId: v.author?.id,
                    authorAvatar: v.author?.thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.author?.name || "P")}&background=random`,
                    thumbnailUrl: v.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
                    viewText: v.views?.text || "おすすめ",
                    viewCount: extractViewCount(v),
                    type: "short",
                  });
                }
              }
            }
          }
        });
      }

      // 空の場合のフォールバック
      let finalShorts = allShorts.length > 0 ? allShorts : CURATED_FALLBACK_SHORTS;
      const startIndex = (page - 1) * limit;
      const paginated = finalShorts.slice(startIndex, startIndex + limit);

      const resultPayload = {
        shorts: paginated.length > 0 ? paginated : finalShorts,
        page,
        total: finalShorts.length,
        hasMore: true,
      };

      setToMemoryCache(cacheKey, resultPayload, 15 * 60 * 1000);
      res.setHeader("Cache-Control", "public, s-maxage=1200, stale-while-revalidate=86400");
      return res.json(resultPayload);
    } catch (err) {
      console.warn("Shorts recommendations fallback triggered:", err);
      return res.json({ shorts: CURATED_FALLBACK_SHORTS, page: 1, total: 3, hasMore: false });
    }
  });

  // Video Details API
  app.get("/api/video/:id", async (req, res) => {
    const videoId = req.params.id;
    const cacheKey = `video:${videoId}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const youtube = await withTimeout(getYt(), 2500, null as any);
      if (!youtube) {
        return res.status(404).json({ error: "Video not found" });
      }

      const info = await withTimeout(youtube.getBasicInfo(videoId), 3000, null as any);
      if (!info || !info.basic_info) {
        return res.status(404).json({ error: "Video not found" });
      }

      const basic = info.basic_info;
      const recs = (info.watch_next_feed || [])
        .slice(0, 15)
        .map((item: any) => formatVideoObject(item))
        .filter(Boolean);

      const videoData = {
        videoId: videoId,
        title: basic.title || "動画",
        author: basic.author || "Unknown",
        authorId: basic.channel_id,
        authorAvatar: basic.author_thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(basic.author || "U")}&background=random`,
        viewCount: extractViewCount(basic.view_count) || extractViewCount(basic),
        likeCount: basic.like_count || 0,
        publishedText: basic.published || "",
        description: basic.short_description || "",
        videoThumbnails: basic.thumbnail || [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }],
        recommendedVideos: recs,
      };

      setToMemoryCache(cacheKey, videoData, 30 * 60 * 1000);
      return res.json(videoData);
    } catch {
      return res.status(404).json({ error: "Video not found" });
    }
  });

  // Video Related API
  app.get("/api/video/:id/related", async (req, res) => {
    const videoId = req.params.id;
    const cacheKey = `related:${videoId}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const youtube = await withTimeout(getYt(), 2500, null as any);
      let videos: any[] = [];
      if (youtube) {
        const info = await withTimeout(youtube.getBasicInfo(videoId), 2500, null as any);
        if (info && Array.isArray(info.watch_next_feed)) {
          videos = info.watch_next_feed.map((item: any) => formatVideoObject(item)).filter(Boolean);
        }
      }

      if (videos.length === 0) {
        videos = CURATED_FALLBACK_VIDEOS;
      }

      const result = { page: 1, videos, hasMore: false };
      setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
      return res.json(result);
    } catch {
      return res.json({ page: 1, videos: CURATED_FALLBACK_VIDEOS, hasMore: false });
    }
  });

  // Video Comments API
  app.get("/api/video/:id/comments", async (req, res) => {
    const videoId = req.params.id;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const cacheKey = `comments:${videoId}:${page}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const youtube = await withTimeout(getYt(), 2500, null as any);
      let comments: any[] = [];
      if (youtube) {
        const cData = await withTimeout(youtube.getComments(videoId), 2500, null as any);
        if (cData && Array.isArray(cData.contents)) {
          comments = cData.contents.map((item: any) => {
            const c = item.comment || item;
            return {
              id: c.comment_id || c.id || Math.random().toString(),
              author: c.author?.name || "ユーザー",
              authorAvatar: c.author?.thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=U&background=random`,
              text: c.content?.text || c.text || "",
              publishedTime: c.published_time || "最近",
              likeCount: c.like_count || "0",
            };
          }).filter((c: any) => c.text);
        }
      }

      const result = { page, comments, hasMore: false };
      if (comments.length > 0) {
        setToMemoryCache(cacheKey, result, 15 * 60 * 1000);
      }
      return res.json(result);
    } catch {
      return res.json({ page, comments: [], hasMore: false });
    }
  });

  // Channels Batch API
  app.post("/api/channels/batch", async (req, res) => {
    return res.json({ results: {} });
  });

  app.get("/api/channels/batch", async (req, res) => {
    return res.json({ results: {} });
  });

  // Channel API
  app.get("/api/channel/:id", async (req, res) => {
    const channelId = req.params.id;
    const cacheKey = `channel:${channelId}`;
    const cached = getFromMemoryCache<any>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const youtube = await withTimeout(getYt(), 2500, null as any);
      let channelData: any = null;

      if (youtube) {
        const ch = await withTimeout(youtube.getChannel(channelId), 2500, null as any);
        if (ch) {
          const vids = (ch.videos || []).map((v: any) => formatVideoObject(v, ch.title, channelId)).filter(Boolean);
          channelData = {
            id: channelId,
            title: ch.title || "チャンネル",
            description: ch.metadata?.description || "",
            avatar: ch.metadata?.avatar?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ch.title || "C")}&background=random`,
            subCountText: ch.subscriber_count?.text || "",
            videosCountText: `${vids.length} 本の動画`,
            videos: vids,
            shortVideos: vids.filter((v: any) => v.title.toLowerCase().includes("short")),
          };
        }
      }

      if (!channelData) {
        channelData = {
          id: channelId,
          title: "チャンネル",
          avatar: `https://ui-avatars.com/api/?name=C&background=random`,
          videos: CURATED_FALLBACK_VIDEOS,
          shortVideos: CURATED_FALLBACK_SHORTS,
        };
      }

      setToMemoryCache(cacheKey, channelData, 15 * 60 * 1000);
      return res.json(channelData);
    } catch {
      return res.json({
        id: channelId,
        title: "チャンネル",
        avatar: `https://ui-avatars.com/api/?name=C&background=random`,
        videos: [],
        shortVideos: [],
      });
    }
  });

  // Fallback Catch All for Static Files
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
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
