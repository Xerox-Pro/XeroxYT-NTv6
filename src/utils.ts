import { get, set } from 'idb-keyval';

export function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function formatNumberJP(num: number): string {
  if (!num) return '0';
  if (num >= 100000000) return (num / 100000000).toFixed(1).replace('.0', '') + '億';
  if (num >= 10000) return (num / 10000).toFixed(1).replace('.0', '') + '万';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CACHE_TTL_DEFAULT = 30 * 60 * 1000; // 30 minutes

// エンドポイント別のキャッシュ保持時間 (ms)
function getCacheTTL(url: string): number {
  if (url.includes('/api/recommendations')) return 5 * 60 * 1000; // 5 minutes
  if (url.includes('/api/trending')) return 15 * 60 * 1000; // 15 minutes
  if (url.includes('/api/search') || url.includes('/api/suggestions')) return 10 * 60 * 1000; // 10 minutes
  if (url.includes('/api/video/') || url.includes('/api/channel/')) return 30 * 60 * 1000; // 30 minutes
  return CACHE_TTL_DEFAULT;
}

function hasValidContent(data: any): boolean {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (Array.isArray(data.videos)) return data.videos.length > 0;
  return true;
}

export async function fetchJSON(url: string, options?: RequestInit) {
  try {
    const isGet = !options || !options.method || options.method === 'GET';
    const isApiCall = url.startsWith('/api/') || url.startsWith('/stream') || url.startsWith('/edu');
    const isTimeSensitive = 
      url.includes('/sync/') || 
      url.includes('/auth/') || 
      url.includes('/stream') || 
      url.includes('/download-proxy');
    
    // Check IndexedDB cache for GET requests
    if (isGet && isApiCall && !isTimeSensitive) {
      try {
        const cached = await get(url);
        const ttl = getCacheTTL(url);
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < ttl) && hasValidContent(cached.data)) {
          return cached.data;
        }
      } catch (e) {
        console.warn('Cache read error:', e);
      }
    }

    const reqOptions = { ...options };
    const finalHeaders = new Headers(reqOptions.headers || {});
    const ytCreds = localStorage.getItem('xerox_youtube_credentials');
    if (ytCreds && !finalHeaders.has('x-youtube-credentials')) {
      finalHeaders.set('x-youtube-credentials', ytCreds);
    }
    reqOptions.headers = finalHeaders;

    const res = await fetch(url, reqOptions);
    const contentType = res.headers.get('content-type');
    
    if (!res.ok) {
      let errorMessage = `サーバーエラー (${res.status}): ${url} へのリクエストに失敗しました`;
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json().catch(() => ({}));
        errorMessage = errorData.error || errorData.message || errorMessage;
      } else {
        const text = await res.text().catch(() => '');
        if (text.includes('A server error')) {
          errorMessage = 'サーバーが混み合っているか、タイムアウトしました。しばらく待ってから再試行してください。';
        } else if (text) {
          errorMessage += `\n詳細: ${text.substring(0, 100)}`;
        }
      }

      if (res.status === 401 && url.startsWith('/api/user/')) {
        console.warn('[Auth] Session expired or unauthorized. Clearing stored credentials.');
        localStorage.removeItem('xerox_youtube_credentials');
        localStorage.removeItem('xerox_user_info');
      }

      throw new Error(errorMessage);
    }

    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('サーバーから不正なレスポンスが返されました（JSONではありません）');
    }

    const data = await res.json();
    
    // Save to IndexedDB cache (only if valid content)
    if (isGet && isApiCall && !isTimeSensitive && hasValidContent(data)) {
      try {
        await set(url, { timestamp: Date.now(), data });
      } catch (e) {
        console.warn('Cache write error:', e);
      }
    }

    return data;
  } catch (err: any) {
    if (err.message && err.message.includes('Unexpected token')) {
      throw new Error('サーバーからの応答を解析できませんでした。');
    }
    
    // Fallback to cache if network fails and cache exists (Offline mode)
    const isGet = !options || !options.method || options.method === 'GET';
    if (isGet) {
       try {
         const cached = await get(url);
         if (cached && hasValidContent(cached.data)) {
           return cached.data;
         }
       } catch (e) {
         // ignore
       }
    }
    throw err;
  }
}

export type DetectedYouTubeType = 'video' | 'short' | 'channel';

export interface YouTubeUrlParseResult {
  type: DetectedYouTubeType;
  id: string;
  playlistId?: string;
  originalUrl: string;
  label: string;
  description: string;
}

/**
 * YouTubeの動画、ショート、チャンネル等のURLやIDを検知・解析する関数
 */
export function parseYouTubeUrl(input: string): YouTubeUrlParseResult | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. 直接の @ハンドル (例: @HikakinTV)
  if (/^@[a-zA-Z0-9_.-]{3,}$/.test(trimmed)) {
    return {
      type: 'channel',
      id: trimmed,
      originalUrl: trimmed,
      label: `チャンネル (${trimmed})`,
      description: `チャンネル「${trimmed}」のページを開きます`
    };
  }

  // 2. 直接の UC チャンネルID (例: UCxxxxxxxxxxxxxxxxxxxxxx 24文字)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    return {
      type: 'channel',
      id: trimmed,
      originalUrl: trimmed,
      label: `チャンネル (ID: ${trimmed})`,
      description: `チャンネルID「${trimmed}」のページを開きます`
    };
  }

  // 3. 直接の 11桁 動画ID (例: dQw4w9WgXcQ)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return {
      type: 'video',
      id: trimmed,
      originalUrl: trimmed,
      label: `YouTube動画 (${trimmed})`,
      description: `動画プレイヤーを開きます`
    };
  }

  // URL形式に整える（プロトコルなしの補完）
  let urlString = trimmed;
  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
    if (
      urlString.startsWith('youtube.com/') || 
      urlString.startsWith('www.youtube.com/') ||
      urlString.startsWith('m.youtube.com/') ||
      urlString.startsWith('music.youtube.com/') ||
      urlString.startsWith('youtu.be/')
    ) {
      urlString = 'https://' + urlString;
    } else {
      return null;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const isYouTubeHost = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(hostname);
  if (!isYouTubeHost) return null;

  const pathname = parsed.pathname;
  const searchParams = parsed.searchParams;

  // A. 短縮URL: youtu.be/VIDEO_ID
  if (hostname === 'youtu.be') {
    const rawPath = pathname.replace(/^\/+/, '');
    const videoId = rawPath.split('/')[0]?.split('?')[0];
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      const list = searchParams.get('list') || undefined;
      return {
        type: 'video',
        id: videoId,
        playlistId: list,
        originalUrl: trimmed,
        label: `YouTube動画 (${videoId})`,
        description: `動画プレイヤーを開きます`
      };
    }
  }

  // B. ショート動画: /shorts/VIDEO_ID
  if (pathname.startsWith('/shorts/')) {
    const parts = pathname.split('/').filter(Boolean);
    const videoId = parts[1]?.split('?')[0]?.split('&')[0];
    if (videoId) {
      return {
        type: 'short',
        id: videoId,
        originalUrl: trimmed,
        label: `ショート動画 (${videoId})`,
        description: `ショート動画プレイヤーを開きます`
      };
    }
  }

  // C. ライブ配信: /live/VIDEO_ID
  if (pathname.startsWith('/live/')) {
    const parts = pathname.split('/').filter(Boolean);
    const videoId = parts[1]?.split('?')[0]?.split('&')[0];
    if (videoId) {
      return {
        type: 'video',
        id: videoId,
        originalUrl: trimmed,
        label: `ライブ配信 (${videoId})`,
        description: `ライブ配信プレイヤーを開きます`
      };
    }
  }

  // D. 埋め込みプレイヤー /v/: /embed/VIDEO_ID or /v/VIDEO_ID
  if (pathname.startsWith('/embed/') || pathname.startsWith('/v/')) {
    const parts = pathname.split('/').filter(Boolean);
    const videoId = parts[1]?.split('?')[0]?.split('&')[0];
    if (videoId) {
      return {
        type: 'video',
        id: videoId,
        originalUrl: trimmed,
        label: `YouTube動画 (${videoId})`,
        description: `動画プレイヤーを開きます`
      };
    }
  }

  // E. 通常動画: /watch?v=VIDEO_ID
  if (pathname === '/watch' || pathname === '/watch/') {
    const v = searchParams.get('v');
    if (v) {
      const list = searchParams.get('list') || undefined;
      return {
        type: 'video',
        id: v,
        playlistId: list,
        originalUrl: trimmed,
        label: `YouTube動画 (${v})`,
        description: `動画プレイヤーを開きます`
      };
    }
  }

  // F. チャンネル - ハンドル: /@handle (例: /@HikakinTV or /@HikakinTV/videos)
  if (pathname.startsWith('/@')) {
    const parts = pathname.split('/').filter(Boolean);
    const handle = parts[0];
    if (handle) {
      return {
        type: 'channel',
        id: handle,
        originalUrl: trimmed,
        label: `チャンネル (${handle})`,
        description: `チャンネル「${handle}」のページを開きます`
      };
    }
  }

  // G. チャンネル - ID: /channel/UC...
  if (pathname.startsWith('/channel/')) {
    const parts = pathname.split('/').filter(Boolean);
    const channelId = parts[1];
    if (channelId) {
      return {
        type: 'channel',
        id: channelId,
        originalUrl: trimmed,
        label: `チャンネル (${channelId})`,
        description: `チャンネルID「${channelId}」のページを開きます`
      };
    }
  }

  // H. チャンネル - カスタム /c/Name または /user/Name
  if (pathname.startsWith('/c/') || pathname.startsWith('/user/')) {
    const parts = pathname.split('/').filter(Boolean);
    const name = parts[1];
    if (name) {
      return {
        type: 'channel',
        id: name,
        originalUrl: trimmed,
        label: `チャンネル (${name})`,
        description: `チャンネル「${name}」のページを開きます`
      };
    }
  }

  // I. attribution_link?a=...&u=/watch?v=...
  if (pathname === '/attribution_link') {
    const u = searchParams.get('u');
    if (u) {
      try {
        const innerUrl = new URL(u, 'https://www.youtube.com');
        const v = innerUrl.searchParams.get('v');
        if (v) {
          return {
            type: 'video',
            id: v,
            originalUrl: trimmed,
            label: `YouTube動画 (${v})`,
            description: `動画プレイヤーを開きます`
          };
        }
      } catch {}
    }
  }

  return null;
}


