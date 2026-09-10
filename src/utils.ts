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

