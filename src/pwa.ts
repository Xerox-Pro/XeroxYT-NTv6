/**
 * PWA Auto Update Handler
 * サイトが変更された時だけ自動的に検知して最新バージョンへアップデートします。
 * ユーザーが保存したデータ（お気に入り、履歴、設定など）は保持されます。
 */

import { registerSW } from 'virtual:pwa-register';

let refreshing = false;

// サービスワーカーのコントローラーが交代（新バージョンがアクティブ化）されたら
// スムーズにリロードして最新のUI・スクリプトを反映
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[PWA] Controller changed, updating to latest version...');
      window.location.reload();
    }
  });
}

export function initPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New version of site detected. Applying update...');
      // サイト更新イベントをUIへ通知（控えめな通知表示用）
      window.dispatchEvent(new CustomEvent('pwa-updating'));
      // 即座に新しいService Workerをアクティベートして更新
      updateSW(true).catch(err => {
        console.warn('[PWA] Failed to update service worker:', err);
      });
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline usage.');
    },
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker registered at:', swUrl);
      if (!registration) return;

      // 1. 定期的にサイトの変更をチェック (10分ごと)
      const intervalMs = 10 * 60 * 1000;
      setInterval(async () => {
        if (navigator.onLine && !document.hidden) {
          try {
            console.log('[PWA] Checking for site updates...');
            await registration.update();
          } catch (e) {
            console.warn('[PWA] Periodic update check failed:', e);
          }
        }
      }, intervalMs);

      // 2. ユーザーがアプリ・タブに戻ってきた時に変更を自動チェック
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          try {
            await registration.update();
          } catch (e) {
            console.warn('[PWA] Visibility update check failed:', e);
          }
        }
      });

      // 3. オフラインから復帰した時に最新版をチェック
      window.addEventListener('online', async () => {
        try {
          await registration.update();
        } catch (e) {
          console.warn('[PWA] Online update check failed:', e);
        }
      });
    },
    onRegisterError(error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    }
  });
}
