/**
 * Detects Incognito / Private Browsing across modern browsers
 * (Chrome, Safari, Firefox, Edge, Brave, Opera)
 */
export async function isPrivateMode(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // In Google AI Studio preview or development iframes, do not falsely flag as private browsing
  const isInIframe = window.self !== window.top;
  if (isInIframe) {
    return false;
  }

  // 1. Check window flag from inline script in index.html if already detected
  if ((window as any).__is_private_browsing__) {
    return true;
  }

  // 2. Storage Quota check (Chrome, Chromium, Edge, Opera, Samsung Internet)
  // In incognito mode, Chromium limits quota to ~120MB (125829120 bytes)
  // while standard top-level browsing provides gigabytes (tens or hundreds of GB).
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { quota } = await navigator.storage.estimate();
      if (quota && quota < 130 * 1024 * 1024) {
        return true;
      }
    }
  } catch (e) {}

  // 3. FileSystem API (Blink/Chromium older versions)
  try {
    if ('webkitRequestFileSystem' in window) {
      const isPrivate = await new Promise<boolean>((resolve) => {
        (window as any).webkitRequestFileSystem(
          (window as any).TEMPORARY,
          100,
          () => resolve(false),
          () => resolve(true)
        );
      });
      if (isPrivate) return true;
    }
  } catch (e) {}

  // 4. Firefox Private Browsing detection via IndexedDB
  try {
    if (navigator.userAgent.includes('Firefox')) {
      const db = window.indexedDB.open('test_firefox_pbm');
      const isPrivate = await new Promise<boolean>((resolve) => {
        db.onerror = () => resolve(true);
        db.onsuccess = () => resolve(false);
      });
      if (isPrivate) return true;
    }
  } catch (e) {}

  // 5. Safari Private Browsing detection
  try {
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    if (isSafari) {
      // Test localStorage quota error
      const testKey = '__pvt_test_safari__';
      try {
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
      } catch (e) {
        return true;
      }
    }
  } catch (e) {}

  return false;
}
