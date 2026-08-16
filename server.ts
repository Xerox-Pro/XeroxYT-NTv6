import express from "express";
import path from "path";
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
      // try next instance
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
    // RSS failed
  }
  return null;
}

function parseCount(text?: string | null): number {
  if (!text) return 0;
  // 万、億 などの日本語単位を処理
  let multiplier = 1;
  let cleanText = text.replace(/,/g, '').toLowerCase();

  if (cleanText.includes('億')) {
    multiplier = 100000000;
    cleanText = cleanText.replace('億', '');
  } else if (cleanText.includes('万')) {
    multiplier = 10000;
    cleanText = cleanText.replace('万', '');
  } else if (cleanText.includes('b')) {
    multiplier = 1000000000;
    cleanText = cleanText.replace('b', '');
  } else if (cleanText.includes('m')) {
    multiplier = 1000000;
    cleanText = cleanText.replace('m', '');
  } else if (cleanText.includes('k')) {
    multiplier = 1000;
    cleanText = cleanText.replace('k', '');
  }

  const numStr = cleanText.replace(/[^0-9.]/g, '');
  if (!numStr) return 0;
  const num = parseFloat(numStr);
  return Math.floor(num * multiplier) || 0;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      yt_initialized: !!yt,
      timestamp: new Date().toISOString(),
      node_version: process.version
    });
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
      const info = await youtube.getInfo(id);
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
      // Non-blocking check with timeout
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

  // User's Liked Videos using YouTubei.js
  app.get("/api/user/liked-videos", async (req, res) => {
    try {
      const youtube = await getYt();
      // LL is the playlist ID for Liked Videos
      const likedVideosPlaylist = await youtube.getPlaylist('LL');
      
      const videos = likedVideosPlaylist.videos.map((v: any) => formatVideoObject(v)).filter(v => v !== null);

      res.json(videos);
    } catch (err) {
      console.error("User liked videos fetch error:", err);
      res.status(500).json({ error: "Failed to fetch liked videos" });
    }
  });

  // トレンド動画取得
  app.get("/api/trending", async (req, res) => {
    try {
      const youtube = await getYt();
      // 日本の人気動画を検索
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
    const title = (v.title?.text || v.title || "").toLowerCase();
    const author = (v.author?.name || "").toLowerCase();
    const text = title + " " + author;
    
    // 除外ワード (メドレーや作業用BGMをより強力に排除)
    const unwanted = [
      "メドレー", "medley", "作業用", "bgm", "mix", "ミックス", "詰め合わせ", 
      "中国語", "中文", "華語", "台湾", "香港", "taiwan", "china", "chinese",
      "睡眠用", "勉強用", "リラックス", "healing", "relaxing", "study music",
      "フルメドレー", "full medley", "bgm用"
    ];
    
    return unwanted.some(kw => text.includes(kw));
  }

  // 安全なサムネイル生成関数
  function formatVideoObject(v: any, defaultAuthor: string = 'Channel', channelId?: string) {
    if (!v) return null;
    if (v.type === 'LockupView') {
      const parts = v.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts || [];
      let lengthSeconds = 0;
      const bottomOverlay = v.content_image?.overlays?.find((o:any) => o.type === 'ThumbnailBottomOverlayView');
      const timeBadge = bottomOverlay?.badges?.[0]?.text;
      if (timeBadge) {
        const timeParts = timeBadge.split(':').reverse();
        lengthSeconds = timeParts.reduce((acc: number, val: string, idx: number) => acc + parseInt(val) * Math.pow(60, idx), 0);
      }
      return {
        videoId: v.content_id,
        playlistId: undefined,
        type: 'video',
        title: v.metadata?.title?.text || 'タイトルなし',
        author: defaultAuthor,
        authorId: channelId,
        authorAvatar: undefined,
        viewCount: parseCount(parts[0]?.text?.text) || 0,
        publishedText: parts[1]?.text?.text || '',
        lengthSeconds: lengthSeconds,
        videoThumbnails: v.content_image?.image || []
      };
    }

    const isPlaylist = v.type === 'Playlist' || v.type === 'Mix' || v.type === 'CompactPlaylist';
    const videoId = isPlaylist ? (v.first_video_id || undefined) : (v.id || v.videoId);
    const playlistId = isPlaylist ? (v.id || v.playlistId) : (v.playlistId || undefined);
    
    if (!videoId && !playlistId) return null;

    const thumbnails = v.thumbnails || v.videoThumbnails || v.thumbnail || [];
    const title = v.title?.text || v.title || 'タイトルなし';

    return {
      videoId: videoId,
      playlistId: playlistId,
      type: v.type?.toLowerCase() || (playlistId ? 'playlist' : 'video'),
      title: title,
      author: v.author?.name || v.short_byline?.text || v.long_byline?.text || defaultAuthor,
      authorId: v.author?.id || channelId,
      authorAvatar: v.author?.thumbnails?.[0]?.url || v.author?.avatar_thumbnail_url,
      viewCount: parseCount(v.view_count?.text) || parseCount(v.short_view_count?.text) || (typeof v.viewCount === 'number' ? v.viewCount : 0),
      publishedText: v.published?.text || v.publishedText || v.video_count_short?.text || '',
      lengthSeconds: v.duration?.seconds || v.lengthSeconds || 0,
      videoThumbnails: thumbnails
    };
  }

  // トレンド ＆ パーソナライズドおすすめAPI
  app.get("/api/recommendations", async (req, res) => {
    const keywords = (req.query.keywords as string) || "";
    const historyIds = ((req.query.historyIds as string) || "").split(",").filter(id => id && id.trim().length > 0);
    const page = parseInt((req.query.page as string) || "1", 10);
    const clientSeed = parseInt((req.query.seed || req.query.refreshNonce) as string, 10);
    const seed = Number.isFinite(clientSeed) ? clientSeed : (Date.now() + Math.floor(Math.random() * 100000));

    // シード付き疑似乱数生成器
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

      // 視聴履歴の動画情報を取得 (最大12件に拡張)
      if (historyIds.length > 0) {
        try {
          const sampleHistory = historyIds.slice(0, 12);
          const historyDetails = await Promise.all(
            sampleHistory.map(async (id) => {
              try {
                const info = await youtube.getBasicInfo(id);
                return {
                  title: info.basic_info.title || '',
                  author: info.basic_info.author || ''
                };
              } catch {
                return null;
              }
            })
          );
          historyVideoTitles = historyDetails.filter(Boolean).map(h => h!.title).filter(t => t.length > 0);
          historyAuthors = Array.from(new Set(historyDetails.filter(Boolean).map(h => h!.author).filter(a => a.length > 0)));
        } catch (e) {
          console.warn("[Recs] Error fetching history details:", e);
        }
      }

      // Gemini Flashでユーザーの好みを予測してクエリ生成 (1ページ目)
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

      // 多彩な一般ジャンルプール（ベース）
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

      // 履歴から動的に大量のパーソナライズクエリを生成（3倍以上に強化）
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

      // プールの結合（ユーザーに合わせたクエリを圧倒的最優先にする）
      let personalizedCandidateQueries: string[] = [];
      if (usedAi && geminiKeywords.length > 0) {
        personalizedCandidateQueries.push(...geminiKeywords);
      }
      if (dynamicPersonalizedQueries.length > 0) {
        personalizedCandidateQueries.push(...dynamicPersonalizedQueries);
      }

      // パーソナライズクエリをシャッフル
      for (let i = personalizedCandidateQueries.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 19 + i) * (i + 1));
        [personalizedCandidateQueries[i], personalizedCandidateQueries[j]] = [personalizedCandidateQueries[j], personalizedCandidateQueries[i]];
      }

      // パーソナライズクエリをメインに8〜10件、一般トレンドを2件選択（合計10〜12並列検索で3倍以上の動画ソースを確保）
      const selectedQueries: string[] = [];
      const personalizedCount = Math.min(personalizedCandidateQueries.length, 9);
      selectedQueries.push(...personalizedCandidateQueries.slice(0, personalizedCount));

      // 残りを一般カテゴリーから補充
      const shuffledCategories = [...categoryPool];
      for (let i = shuffledCategories.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 13 + i) * (i + 1));
        [shuffledCategories[i], shuffledCategories[j]] = [shuffledCategories[j], shuffledCategories[i]];
      }
      const neededCatCount = Math.max(2, 11 - selectedQueries.length);
      selectedQueries.push(...shuffledCategories.slice(0, neededCatCount));

      // 履歴動画から「関連動画 (watch_next_feed)」を大量取得 (最大8件の動画から並行取得して3倍増)
      let sampledHistoryIds: string[] = [];
      if (historyIds.length > 0) {
        const hCopy = [...historyIds];
        for (let i = hCopy.length - 1; i > 0; i--) {
          const j = Math.floor(getSeedRandom(page * 7 + i) * (i + 1));
          [hCopy[i], hCopy[j]] = [hCopy[j], hCopy[i]];
        }
        sampledHistoryIds = hCopy.slice(0, 8);
      }

      const relatedTasks = sampledHistoryIds.map(async (id) => {
        try {
          const info = await youtube.getInfo(id);
          return info.watch_next_feed || [];
        } catch {
          return [];
        }
      });

      const searchTasks = selectedQueries.map(q => 
        youtube.search(q, { type: "video", prioritize: "popularity" }).catch(() => null)
      );
      
      const [searchResults, relatedResults] = await Promise.all([
        Promise.all(searchTasks),
        Promise.all(relatedTasks)
      ]);

      let personalizedVideos: any[] = [];
      let generalVideos: any[] = [];
      
      // 関連動画（100% ユーザー履歴由来のパーソナライズ動画）
      relatedResults.forEach(vList => {
        if (vList && Array.isArray(vList)) {
          personalizedVideos.push(...vList);
        }
      });

      // 検索結果（パーソナライズクエリ由来と一般クエリ由来に分類）
      searchResults.forEach((r, idx) => {
        if (r && r.videos && Array.isArray(r.videos)) {
          if (idx < personalizedCount) {
            personalizedVideos.push(...r.videos);
          } else {
            generalVideos.push(...r.videos);
          }
        }
      });

      const formattedPersonalized = personalizedVideos
        .map((v: any) => formatVideoObject(v))
        .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

      const formattedGeneral = generalVideos
        .map((v: any) => formatVideoObject(v))
        .filter((v: any) => v && v.videoId && !isUnwantedVideo(v));

      // 重複排除マップ
      const uniqueMap = new Map();
      
      // パーソナライズ動画を最優先で登録
      formattedPersonalized.forEach(item => {
        if (!uniqueMap.has(item.videoId)) {
          uniqueMap.set(item.videoId, item);
        }
      });

      // 一般動画も追加
      formattedGeneral.forEach(item => {
        if (!uniqueMap.has(item.videoId)) {
          uniqueMap.set(item.videoId, item);
        }
      });

      const allUnique = Array.from(uniqueMap.values());

      if (allUnique.length > 0) {
        // シードに基づくフィッシャー–イェーツのシャッフル（毎回異なる並び順）
        for (let i = allUnique.length - 1; i > 0; i--) {
          const j = Math.floor(getSeedRandom(page * 31 + i * 17) * (i + 1));
          [allUnique[i], allUnique[j]] = [allUnique[j], allUnique[i]];
        }
        
        return res.json({ 
          videos: allUnique,
          aiKeywords: geminiKeywords,
          seed: seed
        });
      }

      // フォールバック: デフォルト検索
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

  // #shorts がついてる動画のみを厳格フィルタするショート動画API
  app.get("/api/shorts", async (req, res) => {
    const q = (req.query.q as string) || (req.query.keywords as string) || "";
    try {
      const youtube = await getYt();
      const searchQuery = (q ? `${q} #shorts` : "#shorts 日本 トレンド バズ動画 2026");
      const search = await youtube.search(searchQuery, { type: "video", prioritize: "relevance" });

      // タイトルに #shorts / #Shorts / #ショート が含まれているか、または短い動画を優先抽出
      const rawVideos = search.videos || [];
      let shorts = rawVideos
        .filter((v: any) => !isUnwantedVideo(v))
        .filter((v: any) => {
          const title = (v.title?.text || '').toLowerCase();
          const isShortDuration = v.duration?.seconds && v.duration.seconds <= 60;
          return title.includes('#shorts') || title.includes('#ショート') || title.includes('shorts') || isShortDuration;
        })
        .map((v: any) => ({
          ...formatVideoObject(v),
          likeCount: `${(Math.random() * 20 + 1).toFixed(1)}万`,
          commentCount: `${Math.floor(Math.random() * 2000) + 100}`
        }));

      res.json(shorts);
    } catch (err) {
      console.error("Shorts API error:", err);
      res.json([]);
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
      
      // プレイリストも含める
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

  // 登録チャンネルフィードAPI (最新動画をまとめて取得)
  app.get("/api/subscriptions/feed", async (req, res) => {
    const channelTitles = (req.query.channels as string || "").split(",").filter(Boolean);
    try {
      const youtube = await getYt();
      let allVideos: any[] = [];

      if (channelTitles.length > 0) {
        // 各登録チャンネルの最新動画を取得
        const promises = channelTitles.map(async (title) => {
          try {
            // チャンネル名での検索精度を上げる
            const searchRes = await youtube.search(`${title}`, { type: "video" });
            return (searchRes.videos || []).slice(0, 5).map((v: any) => formatVideoObject(v, title));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(promises);
        results.forEach(vList => {
          allVideos = allVideos.concat(vList);
        });
      }

      // 重複削除
      const uniqueFeed = Array.from(new Map(allVideos.map(item => [item.videoId, item])).values());
      res.json(uniqueFeed);
    } catch (err) {
      console.error("Subscriptions feed API error:", err);
      res.json([]);
    }
  });

  app.get("/api/video/:id", async (req, res) => {
    try {
      const youtube = await getYt();
      const info = await youtube.getInfo(req.params.id);
      
      const basic = info.basic_info;
      const primary = info.primary_info;
      const secondary = info.secondary_info;
      
      const recs = (info.watch_next_feed || []).slice(0, 15).map((item: any) => {
        // formatVideoObjectを使って統一的にフォーマット
        const formatted = formatVideoObject(item);
        if (formatted) return formatted;

        // formatVideoObjectで処理できない特殊なケースのみ手動で処理
        if (item.type === 'CompactVideo') {
           return {
             videoId: item.id,
             title: item.title?.text,
             author: item.author?.name || item.short_byline?.text,
             authorId: item.author?.id,
             authorAvatar: item.author?.thumbnails?.[0]?.url,
             viewCount: parseCount(item.view_count?.text) || parseCount(item.short_view_count?.text),
             lengthSeconds: item.duration?.seconds,
             videoThumbnails: item.thumbnails,
             type: 'video',
             publishedText: item.published?.text
           };
        } else if (item.type === 'CompactPlaylist' || item.type === 'Playlist' || item.type === 'Mix') {
           return {
             videoId: item.first_video_id || (item.id && !item.id.startsWith('RD') ? item.id : undefined),
             playlistId: item.id,
             title: item.title?.text || item.title,
             author: item.author?.name || item.short_byline?.text || 'YouTube Mix',
             videoThumbnails: item.thumbnails || [],
             viewCount: 0,
             lengthSeconds: 0,
             type: item.type === 'Mix' ? 'mix' : 'playlist',
             publishedText: item.video_count_short?.text || item.video_count?.text || ''
           };
        } else if (item.type === 'LockupView') {
           return {
             videoId: item.content_id,
             title: item.metadata?.title?.text,
             author: item.metadata?.metadata?.text || 'Unknown',
             videoThumbnails: item.content_image?.image || [],
             viewCount: parseCount(item.metadata?.metadata?.text),
             lengthSeconds: 0,
             type: 'video'
           };
        }
        return null;
      }).filter(Boolean);

      const owner = secondary?.owner;
      const authorAvatar = (owner?.author as any)?.thumbnails?.[0]?.url || (owner?.author as any)?.avatar_thumbnail_url || (basic?.author as any)?.thumbnails?.[0]?.url;

      res.json({
        videoId: req.params.id,
        title: basic?.title || primary?.title?.text,
        author: owner?.author?.name || basic?.author || 'Unknown',
        authorId: owner?.author?.id || basic?.channel_id,
        authorAvatar: authorAvatar,
        viewCount: basic?.view_count || parseCount((primary?.view_count as any)?.view_count?.text) || parseCount((primary?.view_count as any)?.text),
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
            comments.push({
              id: c.comment_id || Math.random().toString(),
              author: c.author?.name || '匿名ユーザー',
              authorAvatar: c.author?.thumbnails?.[0]?.url || c.author?.avatar_thumbnail_url,
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

  app.get("/api/channel/:id", async (req, res) => {
    const rawId = decodeURIComponent(req.params.id || '');
    let channelId = rawId;

    try {
      const youtube = await getYt();
      let channel: any = null;

      // 1. YouTube.js による直接取得
      try {
        channel = await youtube.getChannel(channelId);
      } catch (e) {
        // ID検索またはハンドル名で検索して再取得
        try {
          const search = await youtube.search(channelId, { type: 'channel' });
          if (search.channels && search.channels[0]) {
            channelId = search.channels[0].id;
            channel = await youtube.getChannel(channelId);
          }
        } catch {
          // search also failed
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
          rawId || 
          'チャンネル';
        
        let videosList: any[] = [];

        try {
          const videosObj = await channel.getVideos();
          if (videosObj && videosObj.videos && Array.isArray(videosObj.videos) && videosObj.videos.length > 0) {
            videosList = videosObj.videos
              .map((v: any) => formatVideoObject(v, channelTitle, channelId))
              .filter((v: any) => v && v.videoId);
          }
        } catch (e) {
          console.warn("[Channel] Error calling channel.getVideos():", e);
        }

        // 動画リストが空ならチャンネル名で動画検索
        if (videosList.length === 0) {
          try {
            const searchRes = await youtube.search(channelTitle, { type: 'video' });
            if (searchRes.videos && searchRes.videos.length > 0) {
              videosList = searchRes.videos
                .map((v: any) => formatVideoObject(v, channelTitle, channelId))
                .filter((v: any) => v && v.videoId);
            }
          } catch (e) {
            console.warn("[Channel] Search fallback for channel videos error:", e);
          }
        }

        const shortVideos = videosList.filter((v: any) => 
          v && v.title && (v.title.toLowerCase().includes('short') || (v.lengthSeconds > 0 && v.lengthSeconds <= 60))
        );

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
          shortVideos: shortVideos,
          playlists: []
        });
      }

      // 2. 非公式 Invidious API フォールバック
      console.log(`[Channel] YouTube.js failed for ${rawId}, trying Invidious fallback...`);
      const invidiousData = await fetchInvidiousChannel(rawId);
      if (invidiousData && invidiousData.title) {
        return res.json(invidiousData);
      }

      // 3. YouTube RSS Feed フォールバック
      console.log(`[Channel] Invidious failed for ${rawId}, trying YouTube RSS fallback...`);
      const rssData = await fetchYouTubeRssChannel(rawId);
      if (rssData && rssData.videos.length > 0) {
        return res.json(rssData);
      }

      // 4. 最終フォールバック: YouTube動画検索でチャンネル枠を構築
      console.log(`[Channel] RSS failed for ${rawId}, constructing from search results...`);
      const finalSearch = await youtube.search(rawId, { type: 'video' });
      const searchVideos = (finalSearch.videos || [])
        .map((v: any) => formatVideoObject(v, rawId, channelId))
        .filter((v: any) => v && v.videoId);

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
        playlists: []
      });
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
    // Warm up YouTube client
    getYt().catch(err => console.error("Initial YT warmup failed:", err));
  });

  return app;
}

const appPromise = startServer();
export default appPromise;
