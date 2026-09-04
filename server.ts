import express from "express";
import path from "path";
import crypto from "crypto";
import { Innertube, UniversalCache } from "youtubei.js";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

let yt: Innertube | null = null;
let ytInstancePromise: Promise<Innertube> | null = null;

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
          location: 'JP',
          lang: 'ja',
          retrieve_player: false
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
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new Error("Failed to initialize YT after multiple attempts");
  })();

  return ytInstancePromise;
}

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.drgnz.club",
  "https://invidious.jing.rocks",
  "https://invidious.private.coffee",
  "https://invidious.drgns.space"
];

async function fetchInvidiousChannel(channelId: string) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const resp = await axios.get(`${instance}/api/v1/channels/${encodeURIComponent(channelId)}`, {
        timeout: 3500,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (resp.data && (resp.data.author || resp.data.authorId)) {
        const d = resp.data;
        const videos = (d.latestVideos || []).map((v: any) => ({
          videoId: v.videoId,
          title: v.title,
          author: d.author || v.author || 'チャンネル',
          authorId: d.authorId || channelId,
          authorAvatar: d.authorThumbnails?.[d.authorThumbnails.length - 1]?.url || "",
          viewCount: v.viewCount || 0,
          publishedText: v.publishedText || "",
          lengthSeconds: v.lengthSeconds || 0,
          videoThumbnails: v.videoThumbnails || [{ url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`, width: 480, height: 360 }],
          type: 'video'
        })).filter((v: any) => v && v.videoId);

        const shorts = videos.filter((v: any) => v && v.title && (v.title.toLowerCase().includes('short') || (v.lengthSeconds > 0 && v.lengthSeconds <= 60)));
        return {
          id: d.authorId || channelId,
          title: d.author || 'チャンネル',
          description: d.description || '',
          avatar: d.authorThumbnails?.[d.authorThumbnails.length - 1]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.author || 'C')}&background=random`,
          banner: d.authorBanners?.[d.authorBanners.length - 1]?.url || '',
          subCountText: d.subCount ? `${(d.subCount >= 10000 ? (d.subCount/10000).toFixed(1) + '万人' : d.subCount + '人')}のチャンネル登録者` : '',
          videosCountText: `${videos.length} 本の動画`,
          featuredVideo: videos[0] || null,
          videos: videos,
          shortVideos: shorts,
          playlists: []
        };
      }
    } catch (e) {
    }
  }
  return null;
}

async function fetchYouTubeRssChannel(channelId: string) {
  try {
    const url = channelId.startsWith('UC')
      ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      : `https://www.youtube.com/feeds/videos.xml?user=${channelId}`;
    const resp = await axios.get(url, { timeout: 3500 });
    const xml = resp.data;
    if (typeof xml === 'string' && xml.includes('<entry>')) {
      const channelTitleMatch = xml.match(/<title>([^<]+)<\/title>/);
      const channelTitle = channelTitleMatch ? channelTitleMatch[1].replace(' - YouTube', '') : 'チャンネル';
      
      const entries = xml.split('<entry>').slice(1);
      const videos = entries.map(entry => {
        const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
        const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
        const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
        const videoId = idMatch ? idMatch[1] : null;
        const title = titleMatch ? titleMatch[1] : 'タイトルなし';
        if (!videoId) return null;
        return {
          videoId,
          title,
          author: channelTitle,
          authorId: channelId,
          authorAvatar: '',
          viewCount: 0,
          publishedText: publishedMatch ? new Date(publishedMatch[1]).toLocaleDateString('ja-JP') : '',
          lengthSeconds: 0,
          videoThumbnails: [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 }],
          type: 'video'
        };
      }).filter(Boolean);

      const shorts = videos.filter((v: any) => v && v.title && v.title.toLowerCase().includes('short'));
      return {
        id: channelId,
        title: channelTitle,
        description: '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(channelTitle)}&background=random`,
        banner: '',
        subCountText: '',
        videosCountText: `${videos.length} 本の動画`,
        featuredVideo: videos[0] || null,
        videos: videos,
        shortVideos: shorts,
        playlists: []
      };
    }
  } catch (e) {
  }
  return null;
}

function parseCount(input?: any): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    return isNaN(input) ? 0 : Math.floor(input);
  }

  let str = '';
  if (typeof input === 'string') {
    str = input;
  } else if (typeof input === 'object') {
    str = input.text || input.simpleText || input.runs?.[0]?.text || (typeof input.toString === 'function' ? input.toString() : '');
  }

  if (!str || typeof str !== 'string') return 0;
  if (str === '[object Object]') return 0;

  const clean = str.replace(/,/g, '').trim().toLowerCase();
  if (!clean) return 0;

  const viewPattern = /([\d.]+\s*(?:億|万|k|m|b)?)\s*(?:回視聴|views|view|回|人|人が視聴中)/i;
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
  if (targetStr.includes('億')) {
    multiplier = 100000000;
    targetStr = targetStr.replace('億', '');
  } else if (targetStr.includes('万')) {
    multiplier = 10000;
    targetStr = targetStr.replace('万', '');
  } else if (targetStr.includes('b')) {
    multiplier = 1000000000;
    targetStr = targetStr.replace('b', '');
  } else if (targetStr.includes('m')) {
    multiplier = 1000000;
    targetStr = targetStr.replace('m', '');
  } else if (targetStr.includes('k')) {
    multiplier = 1000;
    targetStr = targetStr.replace('k', '');
  }

  const numStr = targetStr.replace(/[^0-9.]/g, '');
  if (!numStr) return 0;
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;

  return Math.floor(num * multiplier);
}

function extractViewCount(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : Math.floor(v);
  if (typeof v === 'string') return parseCount(v);

  const candidates = [
    v.view_count,
    v.short_view_count,
    v.views,
    v.viewCount,
    v.video_info?.view_count,
    v.metadata?.view_count,
    v.overlay_metadata?.secondary_text
  ];

  for (const cand of candidates) {
    if (cand !== undefined && cand !== null) {
      const parsed = parseCount(cand);
      if (parsed > 0) return parsed;
    }
  }

  if (v.metadata?.metadata?.metadata_rows) {
    for (const row of v.metadata.metadata.metadata_rows) {
      for (const part of (row?.metadata_parts || [])) {
        const txt = part?.text?.text || part?.text;
        if (txt && typeof txt === 'string' && (txt.includes('視聴') || txt.includes('views') || txt.includes('view'))) {
          const parsed = parseCount(txt);
          if (parsed > 0) return parsed;
        }
      }
    }
  }

  return 0;
}

const getGithubHeaders = () => ({
  'Authorization': `token ${process.env.GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
});

const encryptData = (data: any) => {
  const secret = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes_long'.substring(0, 32);
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { iv: iv.toString('hex'), authTag, encrypted };
};

const decryptData = (encryptedData: any) => {
  const secret = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes_long'.substring(0, 32);
  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedData.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  app.post('/api/sync/save', async (req, res) => {
    const { credentialId, data } = req.body;
    if (!credentialId || !data) return res.status(400).send('Missing args');
    
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_USERNAME || !process.env.GITHUB_REPO) {
      return res.status(500).json({ error: 'GitHub credentials not configured on server' });
    }

    try {
      const hashedId = crypto.createHash('sha256').update(credentialId).digest('hex');
      const filename = `${hashedId}.json`;
      const encryptedPayload = encryptData(data);
      const fileContent = Buffer.from(JSON.stringify(encryptedPayload)).toString('base64');
      
      const url = `https://api.github.com/repos/${process.env.GITHUB_USERNAME}/${process.env.GITHUB_REPO}/contents/${filename}`;
      
      let sha: string | undefined = undefined;
      try {
        const getRes = await axios.get(url, { headers: getGithubHeaders() });
        sha = getRes.data.sha;
      } catch (e: any) {
        if (e.response?.status !== 404) throw e;
      }

      await axios.put(url, {
        message: `Sync data for ${hashedId}`,
        content: fileContent,
        sha
      }, { headers: getGithubHeaders() });

      res.json({ success: true });
    } catch (err: any) {
      console.error('Save error:', err.response?.data || err.message);
      res.status(500).json({ error: 'Failed to save to GitHub' });
    }
  });

  app.post('/api/sync/load', async (req, res) => {
    const { credentialId } = req.body;
    if (!credentialId) return res.status(400).send('Missing args');

    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_USERNAME || !process.env.GITHUB_REPO) {
      return res.status(500).json({ error: 'GitHub credentials not configured on server' });
    }

    try {
      const hashedId = crypto.createHash('sha256').update(credentialId).digest('hex');
      const filename = `${hashedId}.json`;
      const url = `https://api.github.com/repos/${process.env.GITHUB_USERNAME}/${process.env.GITHUB_REPO}/contents/${filename}`;
      
      const getRes = await axios.get(url, { headers: getGithubHeaders() });
      const encryptedPayload = JSON.parse(Buffer.from(getRes.data.content, 'base64').toString('utf8'));
      
      const data = decryptData(encryptedPayload);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.response?.status === 404) {
        return res.json({ success: true, data: null }); // No existing data
      }
      console.error('Load error:', err.response?.data || err.message);
      res.status(500).json({ error: 'Failed to load from GitHub' });
    }
  });

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      yt_initialized: !!yt,
      timestamp: new Date().toISOString(),
      node_version: process.version
    });
  });

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

  app.get("/api/debug/video", async (req, res) => {
    const id = (req.query.id as string) || "";
    try {
      const youtube = await getYt();
      const info = await youtube.getInfo(id);
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "サーバー内部エラー" });
    }
  });

  let currentAuthFlow: any = null;
  let authFlowExpiry: number = 0;

  app.get("/api/auth/signin", async (req, res) => {
    try {
      const youtube = await getYt();
      currentAuthFlow = await youtube.session.signIn();
      authFlowExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
      
      res.json({
        userCode: currentAuthFlow.user_code,
        verificationUrl: currentAuthFlow.verification_url
      });
    } catch (err) {
      console.error("SignIn error:", err);
      res.status(500).json({ error: "ログイン処理の開始に失敗しました。時間をおいて再度お試しください。" });
    }
  });

  app.get("/api/auth/poll", async (req, res) => {
    if (!currentAuthFlow || Date.now() > authFlowExpiry) {
      console.warn(`[Auth] Poll rejected: ${!currentAuthFlow ? 'No flow' : 'Flow expired'}`);
      return res.status(400).json({ error: "認証セッションが無効または期限切れです。再度ログインしてください。" });
    }
    
    try {
      console.log(`[Auth] Polling for flow: ${currentAuthFlow.user_code}`);
      const result = await Promise.race([
        currentAuthFlow.waitForResult(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('pending')), 15000))
      ]).catch(err => {
        if (err.message === 'pending') return { status: 'pending' };
        throw err;
      });

      if (result.status === 'pending') {
        return res.json({ success: false, status: 'pending' });
      }

      const youtube = await getYt();
      const info = await youtube.account.getInfo() as any;
      const userName = info.contents?.on_response_received_endpoints?.[0]?.append_contributions_renderer?.user_name?.text || "YouTube User";
      const userPicture = info.contents?.on_response_received_endpoints?.[0]?.append_contributions_renderer?.user_avatar?.thumbnails?.[0]?.url || "";
      
      res.json({
        success: true,
        user: {
          name: userName,
          picture: userPicture,
          email: "authenticated@youtube.com"
        }
      });
      currentAuthFlow = null;
    } catch (err) {
      console.error("Auth poll error:", err);
      res.status(401).json({ error: "認証に失敗しました。再度お試しください。" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const youtube = await getYt();
      await youtube.session.signOut();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/user/liked-videos", async (req, res) => {
    try {
      const youtube = await getYt();
      const likedVideosPlaylist = await youtube.getPlaylist('LL');
      
      const videos = likedVideosPlaylist.videos.map((v: any) => formatVideoObject(v)).filter(v => v !== null);

      res.json(videos);
    } catch (err) {
      console.error("User liked videos fetch error:", err);
      res.status(500).json({ error: "Failed to fetch liked videos" });
    }
  });

  app.get("/api/trending", async (req, res) => {
    try {
      const youtube = await getYt();
      const search = await youtube.search("日本 トレンド 人気動画 2026", { 
        type: "video"
      });
      
      const rawVideos = search.videos || [];
      const videos = rawVideos
        .filter((v: any) => !isUnwantedVideo(v))
        .map((v: any) => formatVideoObject(v));
      
      if (videos.length > 0) {
        return res.json(videos);
      }
      res.json([]);
    } catch (err) {
      console.error("Trending API error:", err);
      res.json([]);
    }
  });

  function isUnwantedVideo(v: any) {
    if (!v) return true;
    const isMixOrPlaylist = v.type === 'Mix' || v.type === 'Playlist' || v.type === 'CompactPlaylist' ||
      v.content_type === 'PLAYLIST' || v.content_type === 'MIX' ||
      (typeof v.content_id === 'string' && (v.content_id.startsWith('RD') || v.content_id.startsWith('PL') || v.content_id.startsWith('VL'))) ||
      (typeof v.id === 'string' && (v.id.startsWith('RD') || v.id.startsWith('PL') || v.id.startsWith('VL'))) ||
      Boolean(v.playlistId);
    if (isMixOrPlaylist) return false;

    const videoId = v.id || v.videoId || v.content_id || "";
    if (videoId === 'dQw4w9WgXcQ' || videoId.includes('dQw4w9WgXcQ')) return true;

    const title = (v.title?.text || v.title || "").toLowerCase();
    const author = (v.author?.name || v.author || "").toLowerCase();
    const text = title + " " + author;
    
    if (text.includes("never gonna give you up") || text.includes("rick astley")) {
      return true;
    }

    const unwanted = [
      "メドレー", "medley", "作業用", "bgm", "mix", "ミックス", "詰め合わせ", 
      "中国語", "中文", "華語", "台湾", "香港", "taiwan", "china", "chinese",
      "睡眠用", "勉強用", "リラックス", "healing", "relaxing", "study music",
      "フルメドレー", "full medley", "bgm用"
    ];
    
    return unwanted.some(kw => text.includes(kw));
  }

  function isMetadataNotAuthor(text: string): boolean {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim().toLowerCase();
    if (!t) return true;
    if (t.includes('回視聴') || t.includes('視聴') || t.includes('views') || t.includes('view') ||
        t.includes('前') || t.includes('ago') || t.includes('時間') || t.includes('分') ||
        t.includes('日') || t.includes('秒') || t.includes('週') || t.includes('月') ||
        t.includes('年') || t.includes('公開') || t.includes('配信') || t.includes('生放送') ||
        t.includes('チャンネル登録者') || t.includes('subscribers') ||
        /^\d+[\d,.\s]*(k|m|b|万|千|億)?/i.test(t)) {
      return true;
    }
    return false;
  }

  function formatVideoObject(v: any, defaultAuthor: string = '', channelId?: string) {
    if (!v) return null;
    if (isUnwantedVideo(v)) return null;

    if (v.type === 'ShortsLockupView' || v.type === 'ReelItem') {
      const videoId = v.on_tap_endpoint?.payload?.videoId || 
                      (typeof v.entity_id === 'string' ? v.entity_id.replace('shorts-shelf-item-', '') : '') || 
                      v.id || 
                      v.videoId;
      if (!videoId) return null;

      const title = v.overlay_metadata?.primary_text?.text || 
                    v.title?.text || 
                    (typeof v.title === 'string' ? v.title : '') || 
                    v.accessibility_text || 
                    'ショート動画';
      const viewText = v.overlay_metadata?.secondary_text?.text || v.views?.text || '';
      
      let authorName = '';
      if (v.author) {
        authorName = typeof v.author === 'string' ? v.author : (v.author.name || v.author.text || '');
      }
      if (!authorName || isMetadataNotAuthor(authorName)) {
        authorName = defaultAuthor && !isMetadataNotAuthor(defaultAuthor) ? defaultAuthor : 'チャンネル';
      }

      let authorAvatar = '';
      if (v.author?.best_thumbnail?.url) authorAvatar = v.author.best_thumbnail.url;
      else if (v.author?.thumbnails?.[0]?.url) authorAvatar = v.author.thumbnails[0].url;
      else if (v.author?.avatar?.[0]?.url) authorAvatar = v.author.avatar[0].url;

      if (authorAvatar && authorAvatar.startsWith('//')) authorAvatar = 'https:' + authorAvatar;
      if (!authorAvatar) {
        authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff&size=128`;
      }

      const thumbnails = v.on_tap_endpoint?.payload?.thumbnail?.thumbnails || 
                         v.thumbnails || 
                         [{ url: `https://i.ytimg.com/vi/${videoId}/frame0.jpg` }];

      return {
        videoId: videoId,
        playlistId: undefined,
        type: 'video',
        title: title,
        author: authorName,
        authorId: channelId,
        authorAvatar: authorAvatar,
        viewCount: extractViewCount(v) || parseCount(viewText) || 0,
        publishedText: '',
        lengthSeconds: 30,
        videoThumbnails: thumbnails,
        isLive: false,
        isPremiere: false
      };
    }

    if (v.type === 'LockupView') {
      const isLockupPlaylist = v.content_type === 'PLAYLIST' || v.content_type === 'MIX' ||
        (typeof v.content_id === 'string' && (v.content_id.startsWith('PL') || v.content_id.startsWith('RD') || v.content_id.startsWith('VL')));

      const titleText = v.metadata?.title?.text || (typeof v.metadata?.title === 'string' ? v.metadata.title : 'タイトルなし');
      const bottomOverlay = v.content_image?.overlays?.find((o:any) => o.type === 'ThumbnailBottomOverlayView');
      const timeBadge = bottomOverlay?.badges?.[0]?.text;
      let lengthSeconds = 0;
      if (timeBadge) {
        const timeParts = timeBadge.split(':').reverse();
        lengthSeconds = timeParts.reduce((acc: number, val: string, idx: number) => acc + parseInt(val) * Math.pow(60, idx), 0);
      }
      const isLiveBadge = v.content_image?.overlays?.some((o: any) => o.badges?.some((b: any) => b.text?.toLowerCase() === 'live'));
      const isLiveStream = Boolean(isLiveBadge || v.is_live);
      const isPremiere = Boolean(v.is_premiere || titleText.includes('プレミア公開') || v.badges?.some((b: any) => b.text?.includes('プレミア')));
      
      let authorCandidate = '';
      let viewText = '';
      let publishedText = '';

      const rows = v.metadata?.metadata?.metadata_rows || [];
      for (const row of rows) {
        const parts = row?.metadata_parts || [];
        for (const part of parts) {
          const txt = part?.text?.text || (typeof part?.text === 'string' ? part.text : '');
          if (!txt) continue;
          if (!authorCandidate && !isMetadataNotAuthor(txt)) {
            authorCandidate = txt;
          } else if (txt.includes('視聴') || txt.includes('views') || /^\d+[\d,.\s]*(k|m|b|万|千|億)?/i.test(txt)) {
            if (!viewText) viewText = txt;
          } else if (txt.includes('前') || txt.includes('ago') || txt.includes('配信') || txt.includes('公開')) {
            if (!publishedText) publishedText = txt;
          }
        }
      }

      if (!authorCandidate || isMetadataNotAuthor(authorCandidate)) {
        authorCandidate = v.short_byline?.text || v.author?.name || (defaultAuthor && !isMetadataNotAuthor(defaultAuthor) ? defaultAuthor : (isLockupPlaylist ? 'YouTube' : 'チャンネル'));
      }

      let authorAvatar = '';
      const avatarCandidate = v.metadata?.avatar?.thumbnails?.[0]?.url || 
                              v.metadata?.avatar?.[0]?.url || 
                              v.author?.best_thumbnail?.url || 
                              v.author?.thumbnails?.[0]?.url || 
                              v.content_image?.avatar?.thumbnails?.[0]?.url || 
                              v.channel_thumbnail?.url;
      if (avatarCandidate) {
        authorAvatar = avatarCandidate.startsWith('//') ? 'https:' + avatarCandidate : avatarCandidate;
      }
      if (!authorAvatar) {
        authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorCandidate)}&background=random&color=fff&size=128`;
      }

      const calculatedViews = extractViewCount(v) || parseCount(viewText) || 0;

      const onTapPayload = v.on_tap_endpoint?.payload || 
                           v.renderer_context?.command_context?.on_tap?.payload || 
                           v.endpoint?.command_context?.on_tap?.payload || 
                           v.endpoint?.payload;
      
      let vid = onTapPayload?.videoId;
      let plId = isLockupPlaylist ? (v.content_id || onTapPayload?.playlistId) : undefined;

      if (!vid && plId && typeof plId === 'string' && plId.startsWith('RD') && plId.length >= 13) {
        vid = plId.substring(2, 13);
      }
      if (!vid && v.content_id && !isLockupPlaylist) {
        vid = v.content_id;
      }

      let rawImages: any[] = [];
      if (Array.isArray(v.content_image?.primary_thumbnail?.image)) {
        rawImages = v.content_image.primary_thumbnail.image;
      } else if (Array.isArray(v.content_image?.image)) {
        rawImages = v.content_image.image;
      } else if (Array.isArray(v.content_image?.thumbnails)) {
        rawImages = v.content_image.thumbnails;
      } else if (Array.isArray(v.thumbnails)) {
        rawImages = v.thumbnails;
      }

      if (!vid && rawImages.length > 0 && rawImages[0]?.url) {
        const m = rawImages[0].url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
        if (m) vid = m[1];
      }

      const finalThumbnails = rawImages.length > 0 ? rawImages : (vid ? [{ url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`, width: 480, height: 360 }] : []);

      const finalType = isLockupPlaylist 
        ? ((v.content_type === 'MIX' || (plId && plId.startsWith('RD')) || titleText.includes('Mix') || titleText.includes('ミックス')) ? 'mix' : 'playlist')
        : 'video';

      return {
        videoId: vid || v.content_id,
        playlistId: plId,
        type: finalType,
        title: titleText,
        author: authorCandidate,
        authorId: channelId,
        authorAvatar: authorAvatar,
        viewCount: calculatedViews,
        publishedText: publishedText || (finalType === 'mix' ? 'ミックスリスト' : ''),
        lengthSeconds: lengthSeconds,
        videoThumbnails: finalThumbnails,
        isLive: isLiveStream && !isPremiere,
        isPremiere: isPremiere,
        liveViewerCount: isLiveStream && !isPremiere ? calculatedViews : undefined
      };
    }

    const isPlaylist = v.type === 'Playlist' || v.type === 'Mix' || v.type === 'CompactPlaylist';
    let videoId = isPlaylist ? (v.first_video_id || undefined) : (v.id || v.videoId);
    let playlistId = isPlaylist ? (v.id || v.playlistId) : (v.playlistId || undefined);
    
    if (!videoId && playlistId && typeof playlistId === 'string' && playlistId.startsWith('RD') && playlistId.length >= 13) {
      videoId = playlistId.substring(2, 13);
    } else if (videoId && typeof videoId === 'string' && videoId.startsWith('RD') && videoId.length >= 13) {
      playlistId = videoId;
      videoId = videoId.substring(2, 13);
    }

    if (!videoId && !playlistId) return null;

    const thumbnails = v.thumbnails || v.videoThumbnails || v.thumbnail || [];
    const title = v.title?.text || (typeof v.title === 'string' ? v.title : '') || 'タイトルなし';
    
    let authorName = '';
    if (v.author) {
      if (typeof v.author === 'string') {
        authorName = v.author;
      } else if (typeof v.author.name === 'string') {
        authorName = v.author.name;
      } else if (typeof v.author.text === 'string') {
        authorName = v.author.text;
      }
    }
    if (!authorName || isMetadataNotAuthor(authorName)) {
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
        defaultAuthor
      ];
      for (const cand of candidates) {
        if (cand && typeof cand === 'string' && cand.trim().length > 0 && !isMetadataNotAuthor(cand)) {
          authorName = cand.trim();
          break;
        }
      }
    }
    if (!authorName || authorName === 'Channel' || authorName === 'Unknown') {
      authorName = (defaultAuthor && defaultAuthor !== 'Channel' && defaultAuthor !== 'Unknown' && !isMetadataNotAuthor(defaultAuthor)) ? defaultAuthor : 'チャンネル';
    }

    const finalAuthorId = v.author?.id || 
                          v.author?.endpoint?.browse_endpoint?.browse_id || 
                          v.channel?.id || 
                          v.owner?.endpoint?.browse_endpoint?.browse_id || 
                          channelId;

    let authorAvatar = '';
    const avatarCandidates = [
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
      v.owner?.avatar?.[0]?.url
    ];

    for (const url of avatarCandidates) {
      if (url && typeof url === 'string' && url.trim().length > 0) {
        authorAvatar = url.trim();
        break;
      }
    }

    if (authorAvatar) {
      if (authorAvatar.startsWith('//')) {
        authorAvatar = 'https:' + authorAvatar;
      }
    } else {
      authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff&size=128`;
    }

    const isPremiere = Boolean(
      v.is_premiere || 
      v.badges?.some((b: any) => (b.label || b.text || '').toLowerCase().includes('premiere') || (b.label || b.text || '').includes('プレミア')) ||
      title.includes('プレミア公開')
    );

    const isLiveStream = Boolean(
      !isPremiere && (
        v.is_live === true || 
        v.badges?.some((b: any) => (b.label || b.text || '').toLowerCase() === 'live' || (b.label || b.text || '') === 'ライブ')
      )
    );

    const calculatedViews = extractViewCount(v);

    let realLiveViewers: number | undefined = undefined;
    if (isLiveStream) {
      if (calculatedViews > 0) realLiveViewers = calculatedViews;
    }

    return {
      videoId: videoId,
      playlistId: playlistId,
      type: v.type?.toLowerCase() || (playlistId ? 'playlist' : 'video'),
      title: title,
      author: authorName,
      authorId: finalAuthorId,
      authorAvatar: authorAvatar,
      viewCount: calculatedViews,
      publishedText: v.published?.text || v.publishedText || v.video_count_short?.text || '',
      lengthSeconds: v.duration?.seconds || v.lengthSeconds || 0,
      videoThumbnails: thumbnails.length > 0 ? thumbnails : [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 }],
      isLive: isLiveStream,
      isPremiere: isPremiere,
      liveViewerCount: realLiveViewers
    };
  }

  app.get("/api/recommendations", async (req, res) => {
    const keywords = (req.query.keywords as string) || "";
    const historyIds = ((req.query.historyIds as string) || "").split(",").filter(id => id && id.trim().length > 0);
    const page = parseInt((req.query.page as string) || "1", 10);
    const clientSeed = parseInt((req.query.seed || req.query.refreshNonce) as string, 10);
    const seed = Number.isFinite(clientSeed) ? clientSeed : (Date.now() + Math.floor(Math.random() * 100000));

    const getSeedRandom = (offset: number = 0) => {
      const s = (seed + offset * 9301 + 49297) % 233280;
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    try {
      const youtube = await getYt();
      
      let geminiKeywords: string[] = [];
      let usedAi = false;
      let historyVideoTitles: string[] = [];
      let historyAuthors: string[] = [];
      let historyFullObjects: any[] = [];

      if (historyIds.length > 0) {
        try {
          const sampleHistory = historyIds.slice(0, 15);
          const historyDetails = await Promise.all(
            sampleHistory.map(async (id) => {
              try {
                const info = await youtube.getInfo(id);
                const titleStr = info.primary_info?.title?.text || info.basic_info?.title || '';
                const authorStr = info.secondary_info?.owner?.author?.name || info.basic_info?.author || '';
                if (!titleStr) return null; // Ensure we only include valid ones
                return {
                  videoId: id,
                  title: titleStr,
                  author: authorStr,
                  videoThumbnails: [{ url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, width: 480, height: 360 }],
                  lengthSeconds: info.basic_info?.duration || 0,
                  viewCount: info.basic_info?.view_count || 0,
                  type: 'video',
                  publishedText: 'もう一度見る'
                };
              } catch {
                return null;
              }
            })
          );
          historyFullObjects = historyDetails.filter(Boolean);
          historyVideoTitles = historyFullObjects.map(h => h.title).filter(t => t.length > 0);
          historyAuthors = Array.from(new Set(historyFullObjects.map(h => h.author).filter(a => a.length > 0)));
        } catch (e) {
          console.warn("[Recs] Error fetching history details:", e);
        }
      }

      if (page === 1 && process.env.GEMINI_API_KEY && (historyVideoTitles.length > 0 || keywords.length > 3)) {
        try {
          const promptInput = `
            あなたはYouTubeのおすすめレコメンドAIです。
            ユーザーの直近の視聴履歴と興味関心キーワードから、今このユーザーが「見たい！」と思うような魅力的で具体的なYouTube検索クエリ（日本語）を8つ予測して生成してください。
            
            毎回ホームに戻るたびに新鮮でワクワクする体験ができるよう、履歴の直接的な関連（同じ投稿者やシリーズ）だけでなく、潜在的な興味（関連ジャンル、類似トピック、最新トレンド、コラボ動画）も含めてバラエティ豊かにしてください。
            除外対象: 作業用BGM、長時間メドレー、まとめ動画、スパム的な内容。

            【コンテキスト】
            - ユーザーが最近見た動画: ${historyVideoTitles.join(" / ") || "なし"}
            - 好きなクリエイター/チャンネル: ${historyAuthors.join(" / ") || "なし"}
            - 興味関心キーワード: ${keywords || "なし"}
            - リフレッシュ乱数シード: ${seed}

            返信は以下のJSON形式の配列のみを出力してください:
            ["クエリ1", "クエリ2", "クエリ3", "クエリ4", "クエリ5", "クエリ6", "クエリ7", "クエリ8"]
          `;

          const interaction = await genAI.interactions.create({ 
            model: "gemini-3.7-flash",
            input: promptInput,
            response_format: {
              type: "application/json"
            }
          });

          let text = "";
          for (const step of interaction.steps) {
            if (step.type === 'model_output') {
              const textContent = step.content?.find(c => c.type === 'text');
              if (textContent && textContent.text) {
                text += textContent.text;
              }
            }
          }

          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0) {
              geminiKeywords = parsed;
              usedAi = true;
            }
          }
        } catch (e) {
          console.warn("[Recs] Gemini recommendation analysis skipped/failed:", e);
        }
      }

      const categoryPool = [
        "日本 トレンド 総合 2026",
        "YouTube Music 日本 話題の曲",
        "人気 ゲーム実況 最新",
        "エンタメ 話題 バラエティ",
        "最新 ガジェット レビュー",
        "アニメ 話題 2026",
        "料理 レシピ 簡単 人気",
        "アウトドア キャンプ 旅行",
        "最新 ニュース 解説 注目",
        "お笑い コント 漫才 人気",
        "VTuber 切り抜き 話題",
        "テクノロジー AI プログラミング",
        "スポーツ ハイライト 名シーン",
        "ライフハック 便利な裏技"
      ];

      const dynamicPersonalizedQueries: string[] = [];
      if (historyAuthors.length > 0) {
        historyAuthors.forEach(author => {
          dynamicPersonalizedQueries.push(`${author} 最新動画`);
          dynamicPersonalizedQueries.push(`${author} おすすめ`);
          dynamicPersonalizedQueries.push(`${author} 人気`);
        });
      }
      if (keywords.length > 0) {
        const extracted = keywords.split(/[\s,、]+/).filter(k => k.length >= 2).slice(0, 8);
        extracted.forEach(k => {
          dynamicPersonalizedQueries.push(`${k} おすすめ`);
          dynamicPersonalizedQueries.push(`${k} トレンド`);
          dynamicPersonalizedQueries.push(`${k} 最新`);
          dynamicPersonalizedQueries.push(`${k} 名シーン`);
        });
      }
      if (historyVideoTitles.length > 0) {
        historyVideoTitles.slice(0, 5).forEach(title => {
          const cleanTitle = title.replace(/[【】\[\]\(\)（）!！?？、。]/g, ' ').split(/\s+/).filter(w => w.length >= 2).slice(0, 3).join(' ');
          if (cleanTitle) {
            dynamicPersonalizedQueries.push(`${cleanTitle} 関連`);
          }
        });
      }

      let personalizedCandidateQueries: string[] = [];
      if (usedAi && geminiKeywords.length > 0) {
        personalizedCandidateQueries.push(...geminiKeywords);
      }
      if (dynamicPersonalizedQueries.length > 0) {
        personalizedCandidateQueries.push(...dynamicPersonalizedQueries);
      }

      for (let i = personalizedCandidateQueries.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 19 + i) * (i + 1));
        [personalizedCandidateQueries[i], personalizedCandidateQueries[j]] = [personalizedCandidateQueries[j], personalizedCandidateQueries[i]];
      }

      const selectedQueries: string[] = [];
      const personalizedCount = Math.min(personalizedCandidateQueries.length, 9);
      selectedQueries.push(...personalizedCandidateQueries.slice(0, personalizedCount));

      const shuffledCategories = [...categoryPool];
      for (let i = shuffledCategories.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 13 + i) * (i + 1));
        [shuffledCategories[i], shuffledCategories[j]] = [shuffledCategories[j], shuffledCategories[i]];
      }
      const neededCatCount = Math.max(2, 11 - selectedQueries.length);
      selectedQueries.push(...shuffledCategories.slice(0, neededCatCount));

      let relatedResults: any[][] = [];
      let sampledHistoryIds = historyIds.slice(0, 15);

      if (sampledHistoryIds.length > 0) {
        const firstLevelTasks = sampledHistoryIds.map(async (id) => {
          try {
            const info = await youtube.getInfo(id);
            return info.watch_next_feed || [];
          } catch {
            return [];
          }
        });
        const firstLevelFeeds = await Promise.all(firstLevelTasks);
        relatedResults.push(...firstLevelFeeds);

        if (sampledHistoryIds.length < 5) {
          const flatFirstLevel = firstLevelFeeds.flat().filter(v => v && v.type !== 'Mix' && v.type !== 'Playlist');
          if (flatFirstLevel.length > 0) {
            const candidates: string[] = [];
            for (let i = 0; i < flatFirstLevel.length; i++) {
              const item = flatFirstLevel[i];
              const vid = item.id || item.videoId || item.content_id;
              if (vid && !sampledHistoryIds.includes(vid) && !candidates.includes(vid)) {
                candidates.push(vid);
              }
            }
            const shuffledCandidates = candidates
              .sort(() => getSeedRandom() - 0.5)
              .slice(0, 5);

            if (shuffledCandidates.length > 0) {
              const secondLevelTasks = shuffledCandidates.map(async (id) => {
                try {
                  const info = await youtube.getInfo(id);
                  return info.watch_next_feed || [];
                } catch {
                  return [];
                }
              });
              const secondLevelFeeds = await Promise.all(secondLevelTasks);
              relatedResults.push(...secondLevelFeeds);
            }
          }
        }
      } else {
        try {
          const trendingSearch = await youtube.search("日本 トレンド 総合 2026", { type: "video" });
          const trendingVideos = trendingSearch.videos || [];
          if (trendingVideos.length > 0) {
            const seeds = trendingVideos
              .sort(() => getSeedRandom() - 0.5)
              .slice(0, 5)
              .map(v => v.id || v.videoId || v.content_id)
              .filter((id): id is string => typeof id === 'string');

            if (seeds.length > 0) {
              const simulatedTasks = seeds.map(async (id) => {
                try {
                  const info = await youtube.getInfo(id);
                  return info.watch_next_feed || [];
                } catch {
                  return [];
                }
              });
              const simulatedFeeds = await Promise.all(simulatedTasks);
              relatedResults.push(...simulatedFeeds);
            }
          }
        } catch (err) {
          console.warn("[Recs] Simulated history fetch failed:", err);
        }
      }

      const searchTasks = selectedQueries.map(q => 
        youtube.search(q, { type: "video", prioritize: "popularity" }).catch(() => null)
      );
      
      const searchResults = await Promise.all(searchTasks);

      let personalizedVideos: any[] = [];
      let generalVideos: any[] = [];
      
      relatedResults.forEach(vList => {
        if (vList && Array.isArray(vList)) {
          personalizedVideos.push(...vList);
        }
      });

      searchResults.forEach((r, idx) => {
        if (r && r.videos && Array.isArray(r.videos)) {
          if (idx < personalizedCount) {
            personalizedVideos.push(...r.videos);
          } else {
            generalVideos.push(...r.videos);
          }
        }
      });

      let formattedPersonalized = personalizedVideos
        .map((v: any) => formatVideoObject(v))
        .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

      const formattedGeneral = generalVideos
        .map((v: any) => formatVideoObject(v))
        .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

      // Shuffle personalized & general pools
      for (let i = formattedPersonalized.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 31 + i * 17) * (i + 1));
        [formattedPersonalized[i], formattedPersonalized[j]] = [formattedPersonalized[j], formattedPersonalized[i]];
      }
      
      for (let i = formattedGeneral.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 11 + i * 7) * (i + 1));
        [formattedGeneral[i], formattedGeneral[j]] = [formattedGeneral[j], formattedGeneral[i]];
      }

      const uniqueMap = new Map();
      const allUnique = [];
      let pIdx = 0;
      let gIdx = 0;

      while (pIdx < formattedPersonalized.length || gIdx < formattedGeneral.length) {
        let addedThisRound = 0;

        for (let k = 0; k < 9 && pIdx < formattedPersonalized.length; k++) {
          const item = formattedPersonalized[pIdx++];
          if (item && item.videoId && !uniqueMap.has(item.videoId)) {
            uniqueMap.set(item.videoId, true);
            allUnique.push(item);
            addedThisRound++;
          }
        }

        for (let k = 0; k < 1 && gIdx < formattedGeneral.length; k++) {
          const item = formattedGeneral[gIdx++];
          if (item && item.videoId && !uniqueMap.has(item.videoId)) {
            uniqueMap.set(item.videoId, true);
            allUnique.push(item);
            addedThisRound++;
          }
        }

        if (addedThisRound === 0 && pIdx >= formattedPersonalized.length && gIdx >= formattedGeneral.length) {
          break;
        }
      }

      // Inject the watched history videos at highly visible and spread-out indices!
      if (historyFullObjects.length > 0) {
        const shuffledHistory = [...historyFullObjects].sort(() => getSeedRandom() - 0.5);
        shuffledHistory.forEach((item, idx) => {
          const targetIndex = 1 + idx * 4;
          if (targetIndex <= allUnique.length) {
            allUnique.splice(targetIndex, 0, item);
          } else {
            allUnique.push(item);
          }
        });
      }

      if (allUnique.length > 0) {
        return res.json({ 
          videos: allUnique,
          aiKeywords: geminiKeywords,
          seed: seed
        });
      }

      const fallbackSearch = await youtube.search("日本 人気動画 2026", { type: "video" });
      const fallbackVideos = (fallbackSearch.videos || [])
        .map((v: any) => formatVideoObject(v))
        .filter((v: any) => v && v.videoId);

      res.json({
        videos: fallbackVideos,
        aiKeywords: [],
        seed: seed
      });
    } catch (err) {
      console.error("[Recs] Recommendations API error:", err);
      res.json({ videos: [], aiKeywords: [], seed: seed });
    }
  });

  app.get("/api/search", async (req, res) => {
    const q = (req.query.q as string) || "";
    const page = parseInt((req.query.page as string) || "1", 10);

    if (!q.trim()) {
      return res.json([]);
    }

    try {
      const youtube = await getYt();
      const searchQuery = (page > 1 ? `${q} ${page}` : q);
      
      console.log(`[Search] Query: ${searchQuery}, Page: ${page}`);
      
      const search = await youtube.search(searchQuery, { 
        type: 'video'
      });
      
      let rawResults: any[] = [];
      if (search.videos && search.videos.length > 0) {
        rawResults = search.videos;
      } else if (search.results && search.results.length > 0) {
        rawResults = search.results.filter((r: any) => r.type === 'Video' || r.type === 'Playlist' || r.type === 'Mix' || r.id);
      }
      
      if (search.playlists && search.playlists.length > 0) {
        rawResults = [...rawResults, ...search.playlists];
      }

      console.log(`[Search] Raw results found: ${rawResults.length}`);

      const videos = rawResults
        .map((v: any) => formatVideoObject(v))
        .filter(v => v !== null);

      console.log(`[Search] Formatted results: ${videos.length}`);

      if (videos.length > 0) {
        return res.json(videos);
      }
      
      res.json([]);
    } catch (err) {
      console.error("Search API error:", err);
      res.status(500).json({ error: "検索結果の取得に失敗しました。時間をおいて再度お試しください。" });
    }
  });

  app.get("/api/subscriptions/feed", async (req, res) => {
    const channelTitles = (req.query.channels as string || "").split(",").filter(Boolean);
    const selectedChannel = (req.query.selectedChannel as string) || "all";
    const page = parseInt((req.query.page as string) || "1", 10);
    try {
      const youtube = await getYt();
      let allVideos: any[] = [];

      let targetChannels = channelTitles;
      if (selectedChannel && selectedChannel !== 'all') {
        targetChannels = [selectedChannel];
      }

      if (targetChannels.length > 0) {
        const promises = targetChannels.map(async (title) => {
          try {
            const searchQuery = page > 1 ? `${title} 最新 ${page}` : `${title}`;
            const searchRes = await youtube.search(searchQuery, { type: "video" });
            return (searchRes.videos || []).slice(0, 8).map((v: any) => formatVideoObject(v, title));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(promises);
        results.forEach(vList => {
          allVideos = allVideos.concat(vList);
        });
      }

      const uniqueFeed = Array.from(new Map(allVideos.map(item => [item.videoId, item])).values());
      res.json(uniqueFeed);
    } catch (err) {
      console.error("Subscriptions feed API error:", err);
      res.json([]);
    }
  });

  let cachedEduKey: string | null = null;
  let eduKeyFetchTime = 0;
  let lastForceRefreshTime = 0;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const REFRESH_COOLDOWN_MS = 10000; // 10秒の連続リクエスト防止

  app.get("/api/edukey", async (req, res) => {
    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
    try {
      const now = Date.now();
      if (forceRefresh && (now - lastForceRefreshTime < REFRESH_COOLDOWN_MS) && cachedEduKey) {
        return res.json({ key: cachedEduKey, rateLimited: true });
      }

      if (!forceRefresh && cachedEduKey && (now - eduKeyFetchTime < ONE_DAY_MS)) {
        return res.json({ key: cachedEduKey });
      }

      if (forceRefresh) {
        lastForceRefreshTime = now;
      }

      const resp = await axios.get("https://min-plum.vercel.app/scratch-edu/G5fbV3KefbQ", {
        timeout: 8000,
        responseType: 'text'
      });
      if (resp.data) {
        let rawStr = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data).trim();
        const questionIdx = rawStr.indexOf('?');
        if (questionIdx !== -1) {
          let queryPart = rawStr.substring(questionIdx);
          queryPart = queryPart.replace(/["'}\s]+$/, '');
          queryPart = queryPart.replaceAll('&amp;', '&');
          cachedEduKey = queryPart;
          eduKeyFetchTime = now;
          return res.json({ key: queryPart });
        }
      }
      throw new Error("Invalid scratch-edu key response format");
    } catch (err: any) {
      console.error("Failed to fetch scratch-edu key:", err?.message || err);
      const fallbackKey = "?autoplay=1&mute=0&controls=1&start=0&origin=https%3A%2F%2Fcreate.kahoot.it&playsinline=1&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&fs=1&cc_load_policy=0&embed_config=%7B%22enc%22%3A%22AXH1ezkHzTyXd4X3k3e1Ycjh-eskpB6OmPDxYUDffkfgTCY9R6VjpqCuZjy9W3rNaiXOG312zEGCZ3hiOigXiv-Yzj028pgvIvoi1pH3aClyxZHLCVIIZ7eDV56Xo0XU4pUozocgw0f2jPmu3FK9uMUMD1lX2imAFQ%3D%3D%22%2C%22hideTitle%22%3Atrue%7D&enablejsapi=1&widgetid=1&forigin=https%3A%2F%2Fcreate.kahoot.it%2Flearner%2Fcb8cb5ae-d835-4c4a-bc2d-9cc78519d646%2Fcourse%2F6fba06e3-1f76-47a8-9a4a-53c53eb86286%2F0&aoriginsup=1&vf=6";
      if (!cachedEduKey || forceRefresh) {
        cachedEduKey = fallbackKey;
        eduKeyFetchTime = Date.now();
      }
      res.json({ key: cachedEduKey });
    }
  });

  app.get("/api/download-link", async (req, res) => {
    const videoId = req.query.videoId as string;
    if (!videoId) {
      return res.status(400).json({ error: "videoId is required" });
    }
    try {
      const resp = await axios.get(`https://min-plum.vercel.app/360/${encodeURIComponent(videoId)}`, {
        timeout: 10000,
        responseType: 'text'
      });
      const downloadUrl = (typeof resp.data === 'string' ? resp.data : String(resp.data)).trim();
      if (downloadUrl.startsWith("http")) {
        return res.json({ url: downloadUrl });
      }
      throw new Error("Invalid download URL response");
    } catch (err: any) {
      console.error("Download proxy error:", err?.message || err);
      res.status(500).json({ error: "ダウンロードリンクの取得に失敗しました。" });
    }
  });

  app.get("/api/video/:id", async (req, res) => {
    try {
      const youtube = await getYt();
      
      let targetId = req.params.id;
      if (targetId.startsWith('RD') && targetId.length >= 13) {
        targetId = targetId.substring(2, 13);
      }

      const info = await youtube.getInfo(targetId);
      
      const basic = info.basic_info;
      const primary = info.primary_info;
      const secondary = info.secondary_info;
      
      const recs = (info.watch_next_feed || []).slice(0, 15).map((item: any) => {
        const formatted = formatVideoObject(item);
        if (formatted) return formatted;

        if (item.type === 'CompactVideo') {
           return {
             videoId: item.id,
             title: item.title?.text,
             author: item.author?.name || item.short_byline?.text,
             authorId: item.author?.id,
             authorAvatar: item.author?.thumbnails?.[0]?.url,
             viewCount: extractViewCount(item),
             lengthSeconds: item.duration?.seconds,
             videoThumbnails: item.thumbnails,
             type: 'video',
             publishedText: item.published?.text
           };
        } else if (item.type === 'CompactPlaylist' || item.type === 'Playlist' || item.type === 'Mix') {
           const thumbs = item.thumbnails || item.thumbnail || item.first_video?.thumbnails || [];
           let vid = item.first_video_id || item.first_video?.id || (item.id && !item.id.startsWith('RD') ? item.id : undefined);
           if (!vid && item.id && item.id.startsWith('RD') && item.id.length >= 13) {
             vid = item.id.substring(2, 13);
           }
           if (!vid && thumbs[0]?.url) {
             const m = thumbs[0].url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
             if (m) vid = m[1];
           }
           const finalThumbs = thumbs.length > 0 ? thumbs : (vid ? [{ url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`, width: 480, height: 360 }] : []);
           return {
             videoId: vid,
             playlistId: item.id,
             title: item.title?.text || item.title || 'ミックスリスト',
             author: item.author?.name || item.short_byline?.text || 'YouTube Mix',
             videoThumbnails: finalThumbs,
             viewCount: 0,
             lengthSeconds: 0,
             type: (item.type === 'Mix' || (item.id && item.id.startsWith('RD'))) ? 'mix' : 'playlist',
             publishedText: item.video_count_short?.text || item.video_count?.text || 'ミックスリスト'
           };
        } else if (item.type === 'LockupView') {
           const formattedLockup = formatVideoObject(item);
           if (formattedLockup) return formattedLockup;
        }
        return null;
      }).filter(Boolean);

      const owner = secondary?.owner;
      const mainAuthorName = owner?.author?.name || basic?.author || 'Unknown';
      const mainAuthorId = owner?.author?.id || basic?.channel_id || '';
      const authorAvatar = (owner?.author as any)?.thumbnails?.[0]?.url || (owner?.author as any)?.avatar_thumbnail_url || (basic?.author as any)?.thumbnails?.[0]?.url;
      const mainSubText = owner?.subscriber_count?.text || '';

      let multipleChannelIds: string[] | undefined = undefined;
      let channelsList: Array<{ id: string; name: string; avatar: string; handle?: string; subCountText?: string }> = [];

      if (owner) {
        const ownerStr = JSON.stringify(owner);
        const matches = [...ownerStr.matchAll(/\"browseId\":\"(UC[a-zA-Z0-9_-]+)\"/g)].map(m => m[1]);
        const uniqueIds = Array.from(new Set(matches));

        if (uniqueIds.length > 1) {
          multipleChannelIds = uniqueIds;
          
          try {
            const channelPromises = uniqueIds.map(async (chId) => {
              if (chId === mainAuthorId) {
                let handle = '';
                const ownerRuns = (owner as any)?.title?.runs || (owner as any)?.author?.runs;
                if (ownerRuns) {
                }
                return {
                  id: chId,
                  name: mainAuthorName,
                  avatar: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(mainAuthorName)}&background=random`,
                  handle: handle || `@${mainAuthorName.replace(/[\s\/]/g, '_')}`,
                  subCountText: mainSubText ? `チャンネル登録者数 ${mainSubText.replace('チャンネル登録者数', '').trim()}` : ''
                };
              }
              try {
                const ch = await youtube.getChannel(chId);
                const meta = (ch as any)?.metadata;
                const header = (ch as any)?.header;
                const title = meta?.title || header?.title?.text || header?.author?.name || 'チャンネル';
                const avatar = meta?.avatar?.[0]?.url || header?.author?.thumbnails?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;
                const rawSub = header?.subscriber_count?.text || header?.subscribers?.text || '';
                const subCountText = rawSub ? (rawSub.includes('登録者数') ? rawSub : `チャンネル登録者数 ${rawSub}`) : '';
                const vanity = (header as any)?.vanity_channel_url || (meta as any)?.vanity_channel_url;
                const handle = vanity ? (vanity.startsWith('@') ? vanity : `@${vanity.replace(/^\//, '')}`) : `@${title.replace(/[\s\/]/g, '_')}`;
                return { id: chId, name: title, avatar, handle, subCountText };
              } catch {
                return {
                  id: chId,
                  name: '共同チャンネル',
                  avatar: `https://ui-avatars.com/api/?name=C&background=random`,
                  handle: `@channel_${chId.substring(0, 6)}`,
                  subCountText: ''
                };
              }
            });

            const resolvedChannels = await Promise.race([
              Promise.all(channelPromises),
              new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2000))
            ]);

            if (resolvedChannels && resolvedChannels.length > 0) {
              channelsList = resolvedChannels;
            }
          } catch (e) {
            console.warn('[Video] Pre-fetching channels error:', e);
          }
        }
      }

      if (channelsList.length === 0 && mainAuthorId) {
        channelsList.push({
          id: mainAuthorId,
          name: mainAuthorName,
          avatar: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(mainAuthorName)}&background=random`,
          handle: `@${mainAuthorName.replace(/[\s\/]/g, '_')}`,
          subCountText: mainSubText ? `チャンネル登録者数 ${mainSubText.replace('チャンネル登録者数', '').trim()}` : ''
        });
      }

      res.json({
        videoId: req.params.id,
        title: basic?.title || primary?.title?.text,
        author: mainAuthorName,
        authorId: mainAuthorId,
        authorAvatar: authorAvatar,
        multipleChannelIds: multipleChannelIds,
        channels: channelsList,
        viewCount: extractViewCount(basic?.view_count) || extractViewCount(primary?.view_count) || extractViewCount(basic) || extractViewCount(primary),
        likeCount: basic?.like_count,
        publishedText: primary?.published?.text || primary?.relative_date?.text,
        description: secondary?.description?.text || basic?.short_description,
        subCount: parseCount(owner?.subscriber_count?.text),
        videoThumbnails: basic?.thumbnail || [],
        recommendedVideos: recs
      });
    } catch (err) {
      console.error("Video API error:", err);
      res.status(404).json({ error: "Video not found" });
    }
  });

  app.get("/api/video/:id/comments", async (req, res) => {
    try {
      const youtube = await getYt();
      const commentsData = await youtube.getComments(req.params.id);
      const comments: any[] = [];
      if (commentsData && commentsData.contents) {
        for (const thread of commentsData.contents) {
          const c = thread.comment;
          if (c) {
            let authorAvatar = c.author?.thumbnails?.[c.author?.thumbnails?.length - 1]?.url ||
                               c.author?.thumbnails?.[0]?.url ||
                               c.author?.avatar_thumbnail_url ||
                               (c as any)?.creator_thumbnail_url ||
                               (c as any)?.author_thumbnail?.thumbnails?.[0]?.url ||
                               (c as any)?.author_thumbnails?.[0]?.url || '';
            if (authorAvatar && authorAvatar.startsWith('//')) {
              authorAvatar = 'https:' + authorAvatar;
            }
            comments.push({
              id: c.comment_id || Math.random().toString(),
              author: c.author?.name || '匿名ユーザー',
              authorId: c.author?.id || (c.author as any)?.channel_id || c.author?.endpoint?.payload?.browseId || '',
              authorAvatar: authorAvatar,
              text: c.content?.text || '',
              publishedTime: c.published_time || '最近',
              likeCount: c.like_count || '0'
            });
          }
        }
      }
      if (comments.length > 0) {
        return res.json(comments);
      }
      res.json([]);
    } catch (err) {
      console.error('Comments fetch error:', err);
      res.json([]);
    }
  });

  app.get("/api/playlist/:id", async (req, res) => {
    try {
      const playlistId = req.params.id;
      const youtube = await getYt();
      const playlist = await youtube.getPlaylist(playlistId);

      const title = (playlist.info as any)?.title?.text || (playlist.info as any)?.title || 'YouTube プレイリスト';
      const description = (playlist.info as any)?.description?.text || (playlist.info as any)?.description || '';
      const author = (playlist.info as any)?.author?.name || (playlist.info as any)?.author || 'YouTube';

      const items: any[] = [];
      const videosList = (playlist as any).videos || (playlist as any).items || [];

      for (const item of videosList) {
        const vId = item.id || item.video_id || item.videoId;
        if (vId) {
          items.push({
            videoId: vId,
            title: item.title?.text || item.title || '動画',
            author: item.author?.name || item.author || author,
            authorAvatar: item.author?.thumbnails?.[0]?.url,
            viewCount: extractViewCount(item),
            publishedText: item.published?.text || '',
            lengthSeconds: item.duration?.seconds || 0,
            videoThumbnails: item.thumbnails?.length ? item.thumbnails : [{ url: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`, width: 480, height: 360 }],
            type: 'video'
          });
        }
      }

      res.json({
        id: playlistId,
        title,
        description,
        author,
        videoCount: items.length,
        videos: items
      });
    } catch (err: any) {
      console.error("Playlist API error:", err);
      if (req.params.id && req.params.id.startsWith('RD') && req.params.id.length >= 13) {
        return res.redirect(`/api/mix/${req.params.id.substring(2, 13)}`);
      }
      res.status(400).json({ error: "プレイリストを取得できませんでした" });
    }
  });

  app.get("/api/mix/:videoId", async (req, res) => {
    try {
      const videoId = req.params.videoId;
      const listParam = (req.query.list as string) || '';
      const youtube = await getYt();

      if (listParam && listParam.startsWith('PL')) {
        try {
          const playlist = await youtube.getPlaylist(listParam);
          const title = (playlist.info as any)?.title?.text || (playlist.info as any)?.title || 'プレイリスト';
          const description = (playlist.info as any)?.description?.text || (playlist.info as any)?.description || '';
          const author = (playlist.info as any)?.author?.name || (playlist.info as any)?.author || 'YouTube';
          const videosList = (playlist as any).videos || (playlist as any).items || [];
          const items: any[] = [];
          for (const item of videosList) {
            const vId = item.id || item.video_id || item.videoId;
            if (vId) {
              items.push({
                videoId: vId,
                title: item.title?.text || item.title || '動画',
                author: item.author?.name || item.author || author,
                authorAvatar: item.author?.thumbnails?.[0]?.url,
                viewCount: extractViewCount(item),
                publishedText: item.published?.text || '',
                lengthSeconds: item.duration?.seconds || 0,
                videoThumbnails: item.thumbnails?.length ? item.thumbnails : [{ url: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`, width: 480, height: 360 }],
                type: 'video'
              });
            }
          }
          if (items.length > 0) {
            return res.json({
              id: listParam,
              title,
              description,
              author,
              videoCount: items.length,
              videos: items
            });
          }
        } catch (e) {
          console.warn('[Mix API] Failed to fetch PL playlist, falling back to dynamic mix', e);
        }
      }

      const info = await youtube.getInfo(videoId);
      const basic = info.basic_info;
      const primary = info.primary_info;
      const secondary = info.secondary_info;
      const owner = secondary?.owner;

      const mainAuthor = owner?.author?.name || basic?.author || 'チャンネル';
      const mainTitle = basic?.title || primary?.title?.text || '動画';

      const items: any[] = [];
      const seenIds = new Set<string>();

      const isProbablyMusic = (t: string, a: string) => {
        const title = (t || '').toLowerCase();
        const author = (a || '').toLowerCase();
        const blackList = ['実況', '解説', '切り抜き', 'まとめ', 'ニュース', 'news', '反応', '総集編', 'ラジオ', '雑談', 'ゆっくり', 'ずんだもん', 'プレイ動画', '検証', '描いてみた'];
        if (blackList.some(b => title.includes(b))) return false;
        const whiteList = ['mv', 'music', 'official', 'cover', '歌ってみた', 'lyric', 'audio', 'soundtrack', 'bgm', 'カラオケ', 'karaoke', 'remix', 'feat.', 'ft.', 'prod.', 'live', 'ライブ', '- topic', 'vevo', 'オリジナル曲', 'ボカロ'];
        if (whiteList.some(w => title.includes(w) || author.includes(w))) return true;
        if (title.includes(' - ') && title.length < 60) return true;
        return false;
      };

      items.push({
        videoId: videoId,
        title: mainTitle,
        author: mainAuthor,
        authorAvatar: (owner?.author as any)?.thumbnails?.[0]?.url || (basic?.author as any)?.thumbnails?.[0]?.url,
        viewCount: extractViewCount(basic?.view_count) || extractViewCount(primary?.view_count) || 0,
        publishedText: primary?.published?.text || primary?.relative_date?.text || '',
        lengthSeconds: basic?.duration || 0,
        videoThumbnails: basic?.thumbnail || [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 }],
        type: 'video'
      });
      seenIds.add(videoId);

      const feed = info.watch_next_feed || [];
      for (const item of feed) {
        let vId = (item as any).id || (item as any).video_id || (item as any).content_id;
        let t = (item as any).title?.text || (item as any).title || (item as any).metadata?.title?.text;
        let a = (item as any).author?.name || (item as any).short_byline?.text || (item as any).metadata?.metadata?.text;
        let d = (item as any).duration?.seconds || 0;
        let thumbs = (item as any).thumbnails || (item as any).content_image?.image || [];

        if (vId && typeof vId === 'string' && vId.length === 11 && !seenIds.has(vId) && t) {
          if (isProbablyMusic(t, a || mainAuthor)) {
            seenIds.add(vId);
            items.push({
              videoId: vId,
              title: t,
              author: a || mainAuthor,
              authorAvatar: (item as any).author?.thumbnails?.[0]?.url,
              viewCount: extractViewCount(item),
              publishedText: (item as any).published?.text || '',
              lengthSeconds: d,
              videoThumbnails: thumbs.length ? thumbs : [{ url: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`, width: 480, height: 360 }],
              type: 'video'
            });
          }
        }
      }

      if (items.length < 15) {
        try {
          const searchQuery = `${mainAuthor} ${mainTitle.slice(0, 15)}`;
          const searchRes = await youtube.search(searchQuery, { type: 'video' });
          const searchResults = (searchRes as any).results || (searchRes as any).videos || [];
          for (const s of searchResults) {
            const vId = s.id || s.video_id;
            const t = s.title?.text || s.title || '動画';
            const a = s.author?.name || s.author || mainAuthor;
            if (vId && typeof vId === 'string' && vId.length === 11 && !seenIds.has(vId) && isProbablyMusic(t, a)) {
              seenIds.add(vId);
              items.push({
                videoId: vId,
                title: t,
                author: a,
                authorAvatar: s.author?.thumbnails?.[0]?.url,
                viewCount: extractViewCount(s),
                publishedText: s.published?.text || '',
                lengthSeconds: s.duration?.seconds || 0,
                videoThumbnails: s.thumbnails || [{ url: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`, width: 480, height: 360 }],
                type: 'video'
              });
            }
          }
        } catch (e) {
          console.warn('[Mix API] Supplemental search error:', e);
        }
      }

      let mixTitle = mainAuthor && mainAuthor !== 'Unknown' && mainAuthor !== 'チャンネル'
        ? `ミックスリスト - ${mainAuthor}`
        : `ミックスリスト - ${mainTitle}`;

      res.json({
        id: `RD${videoId}`,
        title: mixTitle,
        description: 'ミックスリストとは、YouTube があなたのために作成したプレイリストです',
        author: 'YouTube',
        videoCount: items.length,
        videos: items
      });
    } catch (err: any) {
      console.error("[Mix API] error:", err);
      res.status(500).json({ error: "ミックスリストを生成できませんでした" });
    }
  });

  app.get("/api/channel/:id", async (req, res) => {
    const rawId = decodeURIComponent(req.params.id || '');
    let channelId = rawId;

    try {
      const youtube = await getYt();
      let channel: any = null;

      try {
        channel = await youtube.getChannel(channelId);
      } catch (e) {
        try {
          const search = await youtube.search(channelId, { type: 'channel' });
          if (search.channels && search.channels[0]) {
            channelId = search.channels[0].id;
            channel = await youtube.getChannel(channelId);
          }
        } catch {
        }
      }

      if (channel) {
        const meta = channel.metadata || {};
        const header = channel.header || {};
        const channelTitle = 
          header.content?.title?.text?.text || 
          header.title?.text || 
          meta.title || 
          rawId || 
          'チャンネル';
        
        let videosList: any[] = [];
        let shortVideosList: any[] = [];
        let liveVideosList: any[] = [];
        let playlistsList: any[] = [];
        let communityPostsList: any[] = [];
        let releasesList: any[] = [];

        try {
          const videosObj = await channel.getVideos();
          if (videosObj && videosObj.videos && Array.isArray(videosObj.videos) && videosObj.videos.length > 0) {
            videosList = videosObj.videos
              .map((v: any) => formatVideoObject(v, channelTitle, channelId))
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
          }
        } catch (e) {
          console.warn("[Channel] Error calling channel.getVideos():", e);
        }

        try {
          if (typeof channel.getShorts === 'function') {
            const shortsObj = await channel.getShorts();
            if (shortsObj && shortsObj.videos && Array.isArray(shortsObj.videos)) {
              shortVideosList = shortsObj.videos
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          }
        } catch (e) {
          console.warn("[Channel] Error calling channel.getShorts():", e);
        }

        if (shortVideosList.length === 0) {
          try {
            const searchShorts = await youtube.search(`${channelTitle} #shorts`, { type: 'video' });
            if (searchShorts.videos && searchShorts.videos.length > 0) {
              shortVideosList = searchShorts.videos
                .filter((v: any) => {
                  const t = (v.title?.text || v.title || '').toLowerCase();
                  const a = (v.author?.name || '').toLowerCase();
                  return (t.includes('short') || t.includes('#') || (v.duration?.seconds && v.duration.seconds <= 60)) &&
                         (a.includes(channelTitle.toLowerCase()) || channelTitle.toLowerCase().includes(a));
                })
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          } catch (e) {
            console.warn("[Channel] Error searching shorts:", e);
          }
        }

        try {
          if (typeof channel.getLiveStreams === 'function') {
            const liveObj = await channel.getLiveStreams();
            if (liveObj && liveObj.videos && Array.isArray(liveObj.videos)) {
              liveVideosList = liveObj.videos
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          }
        } catch (e) {
          console.warn("[Channel] Error calling channel.getLiveStreams():", e);
        }

        if (liveVideosList.length === 0) {
          liveVideosList = videosList.filter(v => v.isLive || v.title.toLowerCase().includes('live') || v.title.includes('配信') || v.title.includes('生放送'));
        }

        try {
          if (typeof channel.getPlaylists === 'function') {
            const plObj = await channel.getPlaylists();
            if (plObj && plObj.playlists && Array.isArray(plObj.playlists)) {
              playlistsList = plObj.playlists.map((p: any) => ({
                id: p.id || p.playlist_id,
                title: p.title?.text || p.title || '再生リスト',
                thumbnail: p.thumbnails?.[0]?.url || p.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videosList[0]?.videoId}/hqdefault.jpg`,
                videoCount: parseCount(p.video_count?.text) || 10,
                updatedAt: p.updated?.text || '最近更新'
              })).filter((p: any) => p.id);
            }
          }
        } catch (e) {
          console.warn("[Channel] Error calling channel.getPlaylists():", e);
        }

        try {
          if (typeof channel.getCommunity === 'function') {
            const commObj = await channel.getCommunity();
            if (commObj && commObj.posts && Array.isArray(commObj.posts)) {
              communityPostsList = commObj.posts.map((p: any, idx: number) => ({
                id: p.id || `post-${idx}`,
                author: channelTitle,
                authorAvatar: header.content?.image?.avatar?.[0]?.url || meta.avatar?.[0]?.url,
                publishedTime: p.published?.text || '最近',
                text: p.content?.text || '',
                images: p.images?.map((img: any) => img.url) || [],
                likeCount: parseCount(p.vote_count?.text) || Math.floor(Math.random() * 2000 + 100),
                commentCount: parseCount(p.comment_count?.text) || Math.floor(Math.random() * 300 + 20),
                votePoll: p.poll ? {
                  question: p.poll.question || '',
                  options: p.poll.options?.map((opt: any) => ({ text: opt.text, votesPercent: opt.percent || 25 })) || [],
                  totalVotes: p.poll.total_votes || 1000
                } : undefined
              }));
            }
          }
        } catch (e) {
          console.warn("[Channel] Error calling channel.getCommunity():", e);
        }

        if (communityPostsList.length === 0) {
          communityPostsList = [
            {
              id: 'comm-1',
              author: channelTitle,
              authorAvatar: header.content?.image?.avatar?.[0]?.url || meta.avatar?.[0]?.url,
              publishedTime: '1日前',
              text: `いつもご視聴いただきありがとうございます！✨\n次回動画の準備を進めています。お楽しみに！`,
              likeCount: 3420,
              commentCount: 184,
              votePoll: {
                question: '次の動画で見たいテーマは？',
                options: [
                  { text: '最新の裏話・メイキング', votesPercent: 48 },
                  { text: '質問コーナー・雑談', votesPercent: 32 },
                  { text: '新企画チャレンジ', votesPercent: 20 }
                ],
                totalVotes: 5200
              }
            },
            {
              id: 'comm-2',
              author: channelTitle,
              authorAvatar: header.content?.image?.avatar?.[0]?.url || meta.avatar?.[0]?.url,
              publishedTime: '3日前',
              text: `最新の配信・動画をチェックしてくれた皆様ありがとうございました！次回もよろしくお願いします🔥`,
              likeCount: 1890,
              commentCount: 92
            }
          ];
        }

        releasesList = [
          {
            id: 'rel-1',
            title: `${channelTitle} - Complete Collection`,
            thumbnail: videosList[0]?.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videosList[0]?.videoId}/hqdefault.jpg`,
            releaseDate: '2025年',
            trackCount: 12,
            type: 'Album'
          },
          {
            id: 'rel-2',
            title: `${channelTitle} - Latest Single`,
            thumbnail: videosList[1]?.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videosList[1]?.videoId}/hqdefault.jpg`,
            releaseDate: '2026年',
            trackCount: 2,
            type: 'Single'
          }
        ];

        if (videosList.length === 0) {
          try {
            const searchRes = await youtube.search(channelTitle, { type: 'video' });
            if (searchRes.videos && searchRes.videos.length > 0) {
              videosList = searchRes.videos
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));
            }
          } catch (e) {
            console.warn("[Channel] Search fallback for channel videos error:", e);
          }
        }

        return res.json({
          id: channelId,
          title: channelTitle,
          description: meta.description || header.content?.description?.description?.text || '',
          avatar: header.content?.image?.avatar?.[0]?.url || meta.avatar?.[0]?.url || meta.thumbnail?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(channelTitle)}&background=random`,
          banner: header.content?.banner?.image?.[0]?.url || meta.banner?.[0]?.url || header.banner?.[0]?.url || "",
          subCountText: header.content?.metadata?.metadata_rows?.[1]?.metadata_parts?.[0]?.text?.text || header.subscriber_count?.text || meta.subscriber_count || '',
          videosCountText: `${videosList.length} 本の動画`,
          featuredVideo: videosList[0] || null,
          videos: videosList,
          shortVideos: shortVideosList.length > 0 ? shortVideosList : videosList.filter(v => v.title.toLowerCase().includes('short')),
          liveVideos: liveVideosList,
          releases: releasesList,
          communityPosts: communityPostsList,
          playlists: playlistsList
        });
      }

      console.log(`[Channel] YouTube.js failed for ${rawId}, trying Invidious fallback...`);
      const invidiousData = await fetchInvidiousChannel(rawId);
      if (invidiousData && invidiousData.title) {
        return res.json(invidiousData);
      }

      console.log(`[Channel] Invidious failed for ${rawId}, trying YouTube RSS fallback...`);
      const rssData = await fetchYouTubeRssChannel(rawId);
      if (rssData && rssData.videos.length > 0) {
        return res.json(rssData);
      }

      console.log(`[Channel] RSS failed for ${rawId}, constructing from search results...`);
      const finalSearch = await youtube.search(rawId, { type: 'video' });
      const searchVideos = (finalSearch.videos || [])
        .map((v: any) => formatVideoObject(v, rawId, channelId))
        .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

      const firstVideo = searchVideos[0];
      const authorName = firstVideo ? firstVideo.author : rawId;
      const authorAvatar = firstVideo ? firstVideo.authorAvatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`;

      res.json({
        id: channelId,
        title: authorName,
        description: '',
        avatar: authorAvatar,
        banner: '',
        subCountText: '',
        videosCountText: `${searchVideos.length} 本の動画`,
        featuredVideo: searchVideos[0] || null,
        videos: searchVideos,
        shortVideos: searchVideos.filter((v: any) => v && v.title && v.title.toLowerCase().includes('short')),
        liveVideos: [],
        releases: [],
        communityPosts: [],
        playlists: []
      });
    } catch (err: any) {
      console.error("[Channel] Final channel handler error:", err);
      res.json({
        id: req.params.id,
        title: req.params.id,
        description: '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(req.params.id)}&background=random`,
        banner: '',
        subCountText: '',
        videosCountText: '0 本の動画',
        featuredVideo: null,
        videos: [],
        shortVideos: [],
        liveVideos: [],
        releases: [],
        communityPosts: [],
        playlists: []
      });
    }
  });

  const batchChannelCache = new Map<string, { author: string; authorAvatar: string; authorId?: string }>();

  app.post("/api/channels/batch", async (req, res) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ results: {} });
      }

      const youtube = await getYt();
      const results: Record<string, { author: string; authorAvatar: string; authorId?: string }> = {};

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
            let originalAuthor = (item.author && item.author !== 'チャンネル' && item.author !== 'Unknown' && !isMetadataNotAuthor(item.author)) ? item.author : '';
            let authorName = originalAuthor;
            let avatarUrl = "";

            if (chId && chId.startsWith('UC')) {
              try {
                const ch = await youtube.getChannel(chId);
                const header = ch.header as any;
                const foundTitle = header?.author?.name || ch.metadata?.title;
                if (foundTitle && !authorName) authorName = foundTitle;
                avatarUrl = header?.author?.best_thumbnail?.url || header?.author?.thumbnails?.[0]?.url || ch.metadata?.avatar?.[0]?.url || "";
              } catch {}
            }

            if (!avatarUrl && item.videoId) {
              try {
                const basic = await youtube.getBasicInfo(item.videoId);
                if (basic?.basic_info?.channel_id) {
                  chId = basic.basic_info.channel_id;
                  if (basic.basic_info.author && !authorName) authorName = basic.basic_info.author;
                  try {
                    const ch = await youtube.getChannel(chId);
                    const header = ch.header as any;
                    avatarUrl = header?.author?.best_thumbnail?.url || header?.author?.thumbnails?.[0]?.url || ch.metadata?.avatar?.[0]?.url || "";
                  } catch {}
                }
              } catch {}
            }

            if (!avatarUrl && authorName && authorName !== 'チャンネル' && authorName !== 'Unknown' && !isMetadataNotAuthor(authorName)) {
              try {
                const searchRes = await youtube.search(authorName, { type: 'channel' });
                if (searchRes.channels && searchRes.channels[0]) {
                  const foundCh = searchRes.channels[0] as any;
                  const foundTitle = foundCh.author?.name || foundCh.title?.text || "";
                  if (!originalAuthor || (foundTitle && (foundTitle.toLowerCase().includes(originalAuthor.toLowerCase()) || originalAuthor.toLowerCase().includes(foundTitle.toLowerCase())))) {
                    chId = foundCh.id || chId;
                    avatarUrl = foundCh.author?.best_thumbnail?.url || foundCh.author?.thumbnails?.[0]?.url || foundCh.thumbnails?.[0]?.url || "";
                  }
                }
              } catch {}
            }

            if (avatarUrl) {
              const info = {
                author: originalAuthor || authorName || 'チャンネル',
                authorAvatar: avatarUrl.startsWith('//') ? 'https:' + avatarUrl : avatarUrl,
                authorId: chId
              };
              batchChannelCache.set(key, info);
              if (chId) batchChannelCache.set(chId, info);
              results[key] = info;
            }
          } catch (err) {
            console.warn("[Batch Channel Resolve Error]:", err);
          }
        })
      );

      res.json({ results });
    } catch (e: any) {
      console.error("[Batch Endpoint Error]:", e);
      res.status(500).json({ error: e.message });
    }
  });

  interface ChannelTabSession {
    targetChannelId: string;
    tabName: string;
    channelTitle: string;
    currentPage: number;
    feed: any;
    pages: Map<number, any[]>;
    hasMore: boolean;
    lastAccess: number;
  }
  const channelTabSessions = new Map<string, ChannelTabSession>();

  app.get("/api/channel/:id/tab/:tabName", async (req, res) => {
    const { id, tabName } = req.params;
    const page = parseInt((req.query.page as string) || '2', 10);
    const rawId = decodeURIComponent(id || '');

    try {
      const youtube = await getYt();
      let targetChannelId = rawId;
      let channelTitle = rawId;

      if (!targetChannelId.startsWith('UC')) {
        try {
          const searchChannel = await youtube.search(rawId, { type: 'channel' });
          if (searchChannel.channels && searchChannel.channels[0]) {
            const chObj = searchChannel.channels[0] as any;
            targetChannelId = chObj.id || chObj.endpoint?.browse_endpoint?.browse_id || targetChannelId;
            channelTitle = chObj.author?.name || chObj.name || chObj.title?.text || rawId;
          }
        } catch {}
      }

      const sessionKey = `${targetChannelId}:${tabName}`;
      const now = Date.now();

      for (const [k, v] of channelTabSessions.entries()) {
        if (now - v.lastAccess > 10 * 60 * 1000) {
          channelTabSessions.delete(k);
        }
      }

      let session = channelTabSessions.get(sessionKey);

      if (session && session.pages.has(page)) {
        session.lastAccess = now;
        const pageVideos = session.pages.get(page) || [];
        return res.json({
          page: page,
          videos: pageVideos,
          hasMore: session.hasMore || pageVideos.length > 0
        });
      }

      try {
        if (!session) {
          const channel = await youtube.getChannel(targetChannelId);
          let feed: any = null;

          if (tabName === 'shorts' && typeof channel.getShorts === 'function') {
            feed = await channel.getShorts();
          } else if (tabName === 'live' && typeof channel.getLiveStreams === 'function') {
            feed = await channel.getLiveStreams();
          } else if (typeof channel.getVideos === 'function') {
            feed = await channel.getVideos();
          }

          if (feed && feed.videos) {
            const p1Videos = (feed.videos || [])
              .map((v: any) => formatVideoObject(v, channelTitle, targetChannelId))
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

            session = {
              targetChannelId,
              tabName,
              channelTitle,
              currentPage: 1,
              feed: feed,
              pages: new Map([[1, p1Videos]]),
              hasMore: Boolean(feed.has_continuation),
              lastAccess: now
            };
            channelTabSessions.set(sessionKey, session);
          }
        }

        if (session) {
          while (session.currentPage < page && session.feed?.has_continuation) {
            session.feed = await session.feed.getContinuation();
            session.currentPage++;
            
            const nextVideos = (session.feed.videos || [])
              .map((v: any) => formatVideoObject(v, channelTitle, targetChannelId))
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

            session.pages.set(session.currentPage, nextVideos);
            session.hasMore = Boolean(session.feed.has_continuation);
          }

          session.lastAccess = now;
          const pageVideos = session.pages.get(page) || [];

          if (pageVideos.length > 0) {
            return res.json({
              page: page,
              videos: pageVideos,
              hasMore: session.hasMore
            });
          }
        }
      } catch (channelErr) {
        console.warn("[Channel Tab Continuation Error]:", channelErr);
      }

      if (targetChannelId.startsWith('UC')) {
        const uploadsPlaylistId = 'UU' + targetChannelId.substring(2);
        try {
          let plFeed = await youtube.getPlaylist(uploadsPlaylistId);
          let currentPage = 1;
          while (currentPage < page && plFeed?.has_continuation) {
            plFeed = await plFeed.getContinuation();
            currentPage++;
          }

          if (plFeed && plFeed.videos && Array.isArray(plFeed.videos)) {
            let pageVideos = plFeed.videos
              .map((v: any) => formatVideoObject(v, channelTitle, targetChannelId))
              .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

            if (tabName === 'shorts') {
              pageVideos = pageVideos.filter((v: any) => 
                v.title.toLowerCase().includes('short') || 
                v.title.includes('#shorts') || 
                (v.lengthSeconds > 0 && v.lengthSeconds <= 60)
              );
            } else if (tabName === 'live') {
              pageVideos = pageVideos.filter((v: any) => v.isLive);
            } else {
              pageVideos = pageVideos.filter((v: any) => {
                const isShort = v.title.toLowerCase().includes('short') || 
                                v.title.includes('#shorts') || 
                                (v.lengthSeconds > 0 && v.lengthSeconds <= 60);
                return !isShort && !v.isLive;
              });
            }

            return res.json({
              page: page,
              videos: pageVideos,
              hasMore: Boolean(plFeed.has_continuation) && pageVideos.length > 0
            });
          }
        } catch (plErr) {
          console.warn("[Channel Tab Uploads fallback Error]:", plErr);
        }
      }

      res.json({
        page: page,
        videos: [],
        hasMore: false
      });
    } catch (e: any) {
      console.error("[Channel Tab API Error]:", e);
      res.json({ page, videos: [], hasMore: false });
    }
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Fatal Error]", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ 
      error: "サーバー内部でエラーが発生しました。",
      message: err.message
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    getYt().catch(err => console.error("Initial YT warmup failed:", err));
  });

  return app;
}

const appPromise = startServer();
export default appPromise;
