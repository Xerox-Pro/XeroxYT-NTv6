let playerApiPromise: Promise<any> | null = null;

export function loadPlayerApi(): Promise<any> {
  const win = window as any;
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (playerApiPromise) return playerApiPromise;
  playerApiPromise = new Promise((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error('Player API timed out')), 15000);
    win.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (typeof previous === 'function') previous();
      resolve(win.YT);
    };
    const script = document.createElement('script');
    script.src = '/api/youtube-player/iframe-api';
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error('Player API unavailable')); };
    document.head.appendChild(script);
  }).catch(error => { playerApiPromise = null; throw error; });
  return playerApiPromise;
}

