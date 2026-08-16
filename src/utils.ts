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

export async function fetchJSON(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
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
      throw new Error(errorMessage);
    }

    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('サーバーから不正なレスポンスが返されました（JSONではありません）');
    }

    return await res.json();
  } catch (err: any) {
    if (err.message.includes('Unexpected token')) {
      throw new Error('サーバーからの応答を解析できませんでした。');
    }
    throw err;
  }
}

