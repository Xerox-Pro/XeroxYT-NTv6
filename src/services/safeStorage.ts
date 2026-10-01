/**
 * SafeStorage: A resilient, sandbox-safe, incognito-friendly multi-tier storage adapter.
 * 
 * In sandboxed iframes (e.g. allow-scripts without allow-same-origin) or strict private/incognito mode,
 * accessing window.localStorage or window.sessionStorage can throw SecurityError or DOMException.
 * This adapter guarantees zero crashes, transparent fallback across:
 * 1. In-memory Map (guaranteed always working)
 * 2. window.localStorage (when available)
 * 3. window.sessionStorage (when available)
 * 4. document.cookie (when available)
 * 5. BroadcastChannel for cross-tab synchronization
 */

const memoryStore = new Map<string, string>();

let isLocalStorageAvailable = false;
let isSessionStorageAvailable = false;
let isCookieAvailable = false;

// Probe storage capabilities safely without uncaught exceptions
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const testKey = '__storage_probe__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    isLocalStorageAvailable = true;
  }
} catch {
  isLocalStorageAvailable = false;
}

try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const testKey = '__storage_probe__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    isSessionStorageAvailable = true;
  }
} catch {
  isSessionStorageAvailable = false;
}

try {
  if (typeof document !== 'undefined') {
    document.cookie = '__cookie_probe__=1; SameSite=Lax; path=/';
    if (document.cookie.includes('__cookie_probe__=')) {
      document.cookie = '__cookie_probe__=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      isCookieAvailable = true;
    }
  }
} catch {
  isCookieAvailable = false;
}

// BroadcastChannel for cross-tab/cross-window real-time synchronization
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('xerox_tab_sync');
  }
} catch {
  syncChannel = null;
}

function getCookie(name: string): string | null {
  if (!isCookieAvailable || typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + encodeURIComponent(name) + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, days: number = 365): void {
  if (!isCookieAvailable || typeof document === 'undefined') return;
  try {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    // Don't set cookie if value is too large (> 3KB)
    if (value.length > 3000) return;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
  } catch {
    // Ignore cookie write failure in sandbox
  }
}

function deleteCookie(name: string): void {
  if (!isCookieAvailable || typeof document === 'undefined') return;
  try {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch {}
}

export const safeStorage = {
  isSupported: isLocalStorageAvailable || isSessionStorageAvailable || isCookieAvailable,

  getItem(key: string): string | null {
    // 1. Check in-memory store
    if (memoryStore.has(key)) {
      return memoryStore.get(key) || null;
    }

    // 2. Check localStorage
    if (isLocalStorageAvailable) {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          memoryStore.set(key, val);
          return val;
        }
      } catch {}
    }

    // 3. Check sessionStorage
    if (isSessionStorageAvailable) {
      try {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) {
          memoryStore.set(key, val);
          return val;
        }
      } catch {}
    }

    // 4. Check document.cookie
    const cookieVal = getCookie(key);
    if (cookieVal !== null) {
      memoryStore.set(key, cookieVal);
      return cookieVal;
    }

    return null;
  },

  setItem(key: string, value: string): void {
    // 1. Always update memory store
    memoryStore.set(key, value);

    // 2. Try localStorage
    if (isLocalStorageAvailable) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        // QuotaExceededError or SecurityError in sandbox
      }
    }

    // 3. Try sessionStorage
    if (isSessionStorageAvailable) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {}
    }

    // 4. Try Cookie for important keys (like client_uuid)
    if (key === 'xerox_client_uuid' || key === 'xerox_user_info' || value.length < 2048) {
      setCookie(key, value);
    }

    // 5. Broadcast to other tabs/windows
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type: 'storage_change', key, value });
      } catch {}
    }
  },

  removeItem(key: string): void {
    memoryStore.delete(key);

    if (isLocalStorageAvailable) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }

    if (isSessionStorageAvailable) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {}
    }

    deleteCookie(key);

    if (syncChannel) {
      try {
        syncChannel.postMessage({ type: 'storage_remove', key });
      } catch {}
    }
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = this.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  setJSON<T>(key: string, value: T): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch {
      // In-memory fallback is handled in setItem
    }
  },

  onSync(callback: (key: string, value: string | null) => void): () => void {
    if (!syncChannel) return () => {};
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'storage_change') {
        memoryStore.set(event.data.key, event.data.value);
        callback(event.data.key, event.data.value);
      } else if (event.data?.type === 'storage_remove') {
        memoryStore.delete(event.data.key);
        callback(event.data.key, null);
      }
    };
    syncChannel.addEventListener('message', handler);
    return () => {
      syncChannel?.removeEventListener('message', handler);
    };
  }
};
