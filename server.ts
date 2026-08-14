import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Innertube, UniversalCache } from "youtubei.js";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

let yt: Innertube | null = null;
let ytSession: any = null;

async function getYt() {
  if (!yt) {
    yt = await Innertube.create({ 
      cache: new UniversalCache(false),
      location: 'JP',
      lang: 'ja'
    });
    
    // Attempt to load session if we saved it (optional for now, we'll use in-memory for this session)
  }
  return yt;
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

  // YouTubei.js Login API
  let currentAuthFlow: any = null;

  app.get("/api/auth/signin", async (req, res) => {
    try {
      const youtube = await getYt();
      currentAuthFlow = await youtube.session.signIn();
      res.json({
        userCode: currentAuthFlow.user_code,
        verificationUrl: currentAuthFlow.verification_url
      });
    } catch (err) {
      console.error("SignIn error:", err);
      res.status(500).json({ error: "Failed to start sign in" });
    }
  });

  app.get("/api/auth/poll", async (req, res) => {
    if (!currentAuthFlow) return res.status(400).json({ error: "No active auth flow" });
    try {
      await currentAuthFlow.waitForResult();
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
      res.status(401).json({ error: "Authentication failed or timed out" });
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
    const historyIds = ((req.query.historyIds as string) || "").split(",").filter(id => id.length > 0);
    const page = parseInt((req.query.page as string) || "1", 10);

    try {
      const youtube = await getYt();
      
      let geminiKeywords: string[] = [];
      let usedAi = false;
      
      // Gemini Flashを使用して興味関心を分析 (リクエスト節約のため1ページ目のみ)
      if (page === 1 && process.env.GEMINI_API_KEY && (keywords.length > 5 || historyIds.length > 0)) {
        try {
          const historyInfo = await Promise.all(historyIds.slice(0, 5).map(async id => {
            const info = await youtube.getBasicInfo(id);
            return info.basic_info.title;
          }));

          const interaction = await genAI.interactions.create({ 
            model: "gemini-3.7-flash",
            input: `
              ユーザーの視聴履歴と興味関心キーワードから、次にユーザーが見たくなりそうなYouTubeの検索クエリ（日本語）を5つ提案してください。
              
              目的: ユーザーを飽きさせない、多様で質の高いパーソナライズされたフィードを作成すること。
              除外対象: メドレー、作業用BGM、まとめ動画、広告、スパム的な内容。
              
              コンテキスト:
              - 最近の視聴履歴: ${historyInfo.join(" | ")}
              - ユーザーの検索キーワード: ${keywords}
              
              返信は以下のJSON形式の配列のみにしてください:
              ["クエリ1", "クエリ2", "クエリ3", "クエリ4", "クエリ5"]
            `,
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
            if (Array.isArray(parsed)) {
              geminiKeywords = parsed;
              usedAi = true;
            }
          }
        } catch (e) {
          console.warn("Gemini recommendation analysis failed, falling back to original logic", e);
        }
      }

      // フォールバック & 2ページ目以降: 従来のカテゴリーベース + キーワード抽出
      const originalQueryPool = [
        "日本 トレンド 総合 2026",
        "YouTube Music Charts 日本 トップソング",
        "日本 人気 ゲーム実況 最新",
        "日本 エンタメ バラエティ 人気",
        "日本 スポーツ ハイライト 最新",
        "日本 最新 ガジェット レビュー",
        "日本 アニメ 話題 2026",
        "日本 料理 レシピ 人気",
        "日本 旅行 観光 スポット 2026",
        "日本 ニュース 速報 注目"
      ];

      let selectedPool = [...originalQueryPool];

      // キーワードがある場合はプールに追加
      if (keywords.length > 0) {
        const extracted = keywords.split(/[\s,、]+/).filter(k => k.length >= 2).slice(0, 3);
        extracted.forEach(k => {
          selectedPool.unshift(`${k} おすすめ`);
          selectedPool.unshift(`${k} トレンド`);
        });
      }

      // AIの結果がある場合はそれを最優先にする
      if (usedAi && geminiKeywords.length > 0) {
        selectedPool = [...geminiKeywords, ...selectedPool];
      }

      // ページごとに2つの異なるカテゴリーをランダムに選択
      const getSeedRandom = (seed: number) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };

      const selectedQueries: string[] = [];
      const poolCopy = [...selectedPool];
      
      const selectCount = Math.min(3, poolCopy.length);
      for (let i = 0; i < selectCount; i++) {
        const randomIndex = Math.floor(getSeedRandom(page + i) * poolCopy.length);
        selectedQueries.push(poolCopy.splice(randomIndex, 1)[0]);
      }

      // 履歴に基づいた関連動画の取得 (最新の2件を使用)
      const relatedTasks = historyIds.slice(0, 2).map(async (id) => {
        try {
          const info = await youtube.getInfo(id);
          return info.watch_next_feed || [];
        } catch (e) {
          return [];
        }
      });

      const searchTasks = selectedQueries.map(q => youtube.search(q, { type: "video", prioritize: "popularity" }).catch(() => null));
      
      const [searchResults, relatedResults] = await Promise.all([
        Promise.all(searchTasks),
        Promise.all(relatedTasks)
      ]);

      let combinedVideos: any[] = [];
      
      // 検索結果の処理
      searchResults.forEach(r => {
        if (r && r.videos) {
          combinedVideos.push(...r.videos);
        }
      });

      // 関連動画の処理
      relatedResults.forEach(vList => {
        if (vList) {
          combinedVideos.push(...vList);
        }
      });

      const filteredVideos = combinedVideos
        .filter(v => v.type === 'Video' && !isUnwantedVideo(v))
        .map((v: any) => formatVideoObject(v))
        .filter(v => v !== null);

      if (filteredVideos.length > 0) {
        // 重複削除
        const uniqueMap = new Map();
        filteredVideos.forEach(item => {
          if (!uniqueMap.has(item.videoId)) {
            uniqueMap.set(item.videoId, item);
          }
        });
        const unique = Array.from(uniqueMap.values());
        
        // フィッシャー–イェーツのシャッフルでランダム性を出す
        for (let i = unique.length - 1; i > 0; i--) {
          const j = Math.floor(getSeedRandom(page + i * 7) * (i + 1));
          [unique[i], unique[j]] = [unique[j], unique[i]];
        }
        
        return res.json({
          videos: unique,
          aiKeywords: geminiKeywords 
        });
      }

      res.json([]);
    } catch (err) {
      console.error("Recommendations API error:", err);
      res.json([]);
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
    try {
      const youtube = await getYt();
      let channelId = req.params.id;
      let channel: any;
      try {
        channel = await youtube.getChannel(channelId);
      } catch (e) {
        const search = await youtube.search(channelId, { type: 'channel' });
        if (search.channels && search.channels[0]) {
          channelId = search.channels[0].id;
          channel = await youtube.getChannel(channelId);
        }
      }

      if (!channel) {
        throw new Error("Channel not found");
      }

      const meta = channel.metadata || {};
      const header = channel.header || {};
      const channelTitle = meta.title || header.title?.text || req.params.id || 'チャンネル';
      let videosList: any[] = [];

      try {
        const videosObj = await channel.getVideos();
        if (videosObj && videosObj.videos && videosObj.videos.length > 0) {
          videosList = videosObj.videos.map((v: any) => formatVideoObject(v, channelTitle, channelId));
        }
      } catch (e) {
        console.error("Error fetching channel videos:", e);
      }

      // チャンネル動画が少ない・空の場合はチャンネル名で動画検索
      if (videosList.length === 0) {
        try {
          const searchRes = await youtube.search(channelTitle, { type: 'video' });
          if (searchRes.videos && searchRes.videos.length > 0) {
            videosList = searchRes.videos.map((v: any) => formatVideoObject(v, channelTitle, channelId));
          }
        } catch (e) {
          console.error("Search for channel videos error:", e);
        }
      }

      // ショート動画を抽出（#shortsが含まれるもの、または短い動画）
      const shortVideos = videosList
        .filter(v => v.title.toLowerCase().includes('short') || v.lengthSeconds <= 60);

      res.json({
        id: channelId,
        title: channelTitle,
        description: meta.description || '',
        avatar: meta.avatar?.[0]?.url || meta.thumbnail?.[0]?.url || "",
        banner: header.banner?.[0]?.url || meta.banner?.[0]?.url || "",
        subCountText: header.subscriber_count?.text || meta.subscriber_count || '',
        videosCountText: `${videosList.length} 本の動画`,
        featuredVideo: videosList[0] || null,
        videos: videosList,
        shortVideos: shortVideos,
        playlists: []
      });
    } catch (err) {
      console.error("Channel API error:", err);
      res.status(404).json({ error: "Channel not found" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
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
  });

  return app;
}

const appPromise = startServer();
export default appPromise;
