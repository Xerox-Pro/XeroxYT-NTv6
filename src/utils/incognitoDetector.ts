import { detectIncognito } from 'detectincognitojs';

export interface IncognitoDetectionResult {
  isPrivate: boolean;
  browserName?: string;
  reason?: string;
}

/**
 * Checks storage quota in Chromium-based browsers.
 * In Chrome/Chromium desktop, incognito mode storage quota is typically <= 120MB,
 * while in regular mode it is usually many Gigabytes.
 */
async function checkStorageQuota(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const isChromium = !!(window as any).chrome || /Chrome|Chromium|Edg/.test(navigator.userAgent);
      
      // If quota is unusually low (<= 130MB in Chromium), likely incognito
      if (isChromium && quota > 0 && quota < 140 * 1024 * 1024) {
        return true;
      }
    }
  } catch {
    // Quota estimate failed, ignore
  }

  return false;
}

/**
 * Comprehensive detection for incognito / private browsing mode.
 * Combines detectincognitojs with quota and storage heuristics.
 */
export async function checkIsIncognito(): Promise<IncognitoDetectionResult> {
  if (typeof window === 'undefined') {
    return { isPrivate: false };
  }

  // 1. Check for manual test query parameter (?test_incognito=1 or ?incognito=true)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test_incognito') === '1' || urlParams.get('incognito') === 'true') {
      return {
        isPrivate: true,
        browserName: 'Test Mode',
        reason: 'URLテストパラメータ（test_incognito=1）による強制検知',
      };
    }
  } catch {
    // URL parsing failed
  }

  // 2. Primary detection via detectincognitojs
  try {
    const result = await detectIncognito();
    if (result && result.isPrivate) {
      return {
        isPrivate: true,
        browserName: result.browserName,
        reason: `${result.browserName || 'ブラウザ'}のシークレット/プライベートモードを検出しました`,
      };
    }
  } catch (err) {
    console.warn('[IncognitoDetector] detectIncognito failed, using fallback:', err);
  }

  // 3. Fallback: Storage quota heuristic for Chromium
  try {
    const isQuotaRestricted = await checkStorageQuota();
    if (isQuotaRestricted) {
      return {
        isPrivate: true,
        browserName: 'Chromium',
        reason: 'ストレージクォータ制限によるシークレットモード検出',
      };
    }
  } catch {
    // Ignore fallback errors
  }

  return { isPrivate: false };
}

/**
 * Executes incognito detection with a safety timeout so normal browsing is never blocked.
 */
export async function checkIsIncognitoWithTimeout(timeoutMs = 1500): Promise<IncognitoDetectionResult> {
  const timeoutPromise = new Promise<IncognitoDetectionResult>((resolve) => {
    setTimeout(() => resolve({ isPrivate: false }), timeoutMs);
  });

  return Promise.race([checkIsIncognito(), timeoutPromise]);
}
