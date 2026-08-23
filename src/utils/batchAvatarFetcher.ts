type BatchRequestItem = {
  key: string;
  channelId?: string;
  videoId?: string;
  author?: string;
};

export type BatchResponseItem = {
  author?: string;
  authorAvatar?: string;
  authorId?: string;
};

class BatchAvatarFetcher {
  private queue: Map<string, BatchRequestItem> = new Map();
  private callbacks: Map<string, Set<(data: BatchResponseItem) => void>> = new Map();
  private timer: any = null;
  private cache: Map<string, BatchResponseItem> = new Map();

  public register(
    item: BatchRequestItem,
    callback: (data: BatchResponseItem) => void
  ) {
    if (!item.key) return;

    if (this.cache.has(item.key)) {
      callback(this.cache.get(item.key)!);
      return;
    }

    if (!this.callbacks.has(item.key)) {
      this.callbacks.set(item.key, new Set());
    }
    this.callbacks.get(item.key)!.add(callback);

    this.queue.set(item.key, item);

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 120);
    }
  }

  private async flush() {
    this.timer = null;
    const itemsToFetch = Array.from(this.queue.values()).slice(0, 30);
    if (itemsToFetch.length === 0) return;

    itemsToFetch.forEach(it => this.queue.delete(it.key));

    try {
      const response = await fetch('/api/channels/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToFetch })
      });
      const data = await response.json();
      const results: Record<string, BatchResponseItem> = data.results || {};

      for (const [key, info] of Object.entries(results)) {
        if (info && (info.authorAvatar || info.author)) {
          // Normalize protocol-relative avatar URLs like //yt3.ggpht.com/...
          if (info.authorAvatar && info.authorAvatar.startsWith('//')) {
            info.authorAvatar = 'https:' + info.authorAvatar;
          }
          this.cache.set(key, info);
          const cbs = this.callbacks.get(key);
          if (cbs) {
            cbs.forEach(cb => cb(info));
            this.callbacks.delete(key);
          }
        }
      }
    } catch (err) {
      console.warn('[BatchAvatarFetcher Error]:', err);
    }

    if (this.queue.size > 0) {
      this.timer = setTimeout(() => this.flush(), 120);
    }
  }
}

export const batchAvatarFetcher = new BatchAvatarFetcher();
