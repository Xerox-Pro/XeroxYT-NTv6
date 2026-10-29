import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

type Source = { url: string; size: number; itag: number; mime: string };
type DownloadInfo = { title: string; video: Source & { height: number }; audio: Source };
const CHUNK = 1024 * 1024 * 2;
const MAX_MEDIA = 350 * 1024 * 1024;

async function readSource(source: Source, progress: (loaded: number) => void): Promise<Uint8Array> {
  if (!Number.isSafeInteger(source.size) || source.size <= 0) throw new Error('ファイルサイズを確認できません。');
  const data = new Uint8Array(source.size);
  for (let offset = 0; offset < source.size; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, source.size) - 1;
    const response = await fetch(`/api/download-media?url=${encodeURIComponent(source.url)}`, { headers: { Range: `bytes=${offset}-${end}` }, credentials: 'same-origin' });
    if (response.status !== 206) throw new Error(`動画データの取得に失敗しました（${response.status}）。`);
    const range = response.headers.get('content-range');
    if (range !== `bytes ${offset}-${end}/${source.size}`) throw new Error('動画データの範囲を確認できませんでした。');
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length !== end - offset + 1) throw new Error('動画データが途中で切れました。');
    data.set(buffer, offset); progress(buffer.length);
  }
  return data;
}

export async function downloadVideo(videoId: string, update: (message: string) => void): Promise<void> {
  update('動画の情報を取得中…');
  const response = await fetch(`/api/download-formats/${encodeURIComponent(videoId)}`, { credentials: 'same-origin' });
  const info: DownloadInfo & { error?: string } = await response.json();
  if (!response.ok) throw new Error(info.error || '動画情報を取得できませんでした。');
  const total = info.video.size + info.audio.size;
  if (total > MAX_MEDIA) throw new Error('この動画は端末内での結合に必要な容量が大きすぎます。');
  let done = 0;
  const progress = (bytes: number) => { done += bytes; update(`映像と音声を取得中… ${Math.min(100, Math.floor(done / total * 100))}%`); };
  const video = await readSource(info.video, progress);
  const audio = await readSource(info.audio, progress);
  update(`${info.video.height}pの映像と音声を端末内で結合中…`);
  const ffmpeg = new FFmpeg();
  try {
    await ffmpeg.load({ coreURL, wasmURL });
    await ffmpeg.writeFile('video.mp4', video);
    await ffmpeg.writeFile('audio.m4a', audio);
    const code = await ffmpeg.exec(['-i', 'video.mp4', '-i', 'audio.m4a', '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', 'result.mp4']);
    if (code !== 0) throw new Error('映像と音声を結合できませんでした。');
    const result = await ffmpeg.readFile('result.mp4');
    if (typeof result === 'string') throw new Error('完成した動画を読み込めませんでした。');
    const blob = new Blob([result as BlobPart], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(info.title || videoId).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120)}.mp4`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    update(`ダウンロードを開始しました（${info.video.height}p）。`);
  } finally { ffmpeg.terminate(); }
}
