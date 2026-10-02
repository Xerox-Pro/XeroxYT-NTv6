/**
 * Local Intelligence Engine
 * Analyzes user behavior and video metadata without external API calls.
 */

export interface InterestProfile {
  keywords: Record<string, number>; // Keyword -> Score
  categories: Record<string, number>; // Category ID -> Score
  hashtags: Record<string, number>; // Hashtag -> Score/Count
  watchTimes: Record<string, number>; // VideoId -> Watched seconds
  interactions: { type: string, timestamp: number, data: any }[];
  lastUpdated: number;
}

const STOP_WORDS = new Set(['の', 'に', 'は', 'を', 'た', 'だ', 'で', 'と', 'が', 'も', 'な', 'い', 'です', 'ます', '。', '、', '！', '？', '(', ')', '[', ']', '【', '】', 'official', 'mv', 'music', 'video', 'ch', 'channel', '公式', '動画', 'shorts', 'short']);

export class LocalIntelligence {
  private profile: InterestProfile;

  constructor() {
    this.profile = this.loadProfile();
  }

  private loadProfile(): InterestProfile {
    try {
      const saved = localStorage.getItem('xerox_local_ai_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          keywords: parsed.keywords || {},
          categories: parsed.categories || {},
          hashtags: parsed.hashtags || {},
          watchTimes: parsed.watchTimes || {},
          interactions: parsed.interactions || [],
          lastUpdated: parsed.lastUpdated || Date.now()
        };
      }
    } catch (e) {
      console.error('Failed to load local AI profile', e);
    }
    return { keywords: {}, categories: {}, hashtags: {}, watchTimes: {}, interactions: [], lastUpdated: Date.now() };
  }

  private saveProfile() {
    this.profile.lastUpdated = Date.now();
    localStorage.setItem('xerox_local_ai_profile', JSON.stringify(this.profile));
  }

  /**
   * Process a video interaction (watch, click, etc.)
   */
  processVideoInteraction(video: any, weight: number = 1.0) {
    if (!video) return;

    this.profile.interactions.push({
      type: 'watch',
      timestamp: Date.now(),
      data: { videoId: video.videoId, title: video.title }
    });
    if (this.profile.interactions.length > 50) this.profile.interactions.shift();

    // Extract hashtags from title and description
    this.extractAndSaveHashtags(video.title || '', 1);
    if (video.description) {
      this.extractAndSaveHashtags(video.description, 0.5);
    }
    if (Array.isArray(video.hashtags)) {
      video.hashtags.forEach((t: string) => {
        if (typeof t === 'string') this.extractAndSaveHashtags(t.startsWith('#') ? t : `#${t}`, 1.5);
      });
    }
    if (Array.isArray(video.tags)) {
      video.tags.forEach((t: string) => {
        if (typeof t === 'string') this.extractAndSaveHashtags(t.startsWith('#') ? t : `#${t}`, 1.0);
      });
    }

    // 1. Title analysis
    const title = (video.title || '').toLowerCase();
    this.extractKeywords(title, weight);

    // 2. Category analysis
    if (video.category) {
      this.profile.categories[video.category] = (this.profile.categories[video.category] || 0) + weight;
    }

    // 3. Channel analysis (as a keyword)
    if (video.author) {
      const author = video.author.toLowerCase().replace(/\s/g, '');
      this.profile.keywords[author] = (this.profile.keywords[author] || 0) + (weight * 1.5);
    }

    this.saveProfile();
  }

  /**
   * Track watch duration & calculate engagement score:
   * If user watched for > 30s or > 50% of video duration, boost the interest weight
   */
  processWatchDuration(video: any, secondsWatched: number) {
    if (!video || !video.videoId || secondsWatched <= 0) return;

    this.profile.watchTimes[video.videoId] = Math.max(this.profile.watchTimes[video.videoId] || 0, secondsWatched);

    let engagementMultiplier = 0.5;
    if (secondsWatched >= 120) {
      // Very long watch / deep engagement
      engagementMultiplier = 3.5;
    } else if (secondsWatched >= 60) {
      // Long watch
      engagementMultiplier = 2.5;
    } else if (secondsWatched >= 25) {
      // Moderate watch
      engagementMultiplier = 1.8;
    } else if (secondsWatched >= 10) {
      engagementMultiplier = 1.0;
    } else {
      // Skipped immediately (low interest)
      engagementMultiplier = 0.2;
    }

    // Re-boost keywords with engagement multiplier
    const title = (video.title || '').toLowerCase();
    this.extractKeywords(title, engagementMultiplier);

    if (video.author) {
      const author = video.author.toLowerCase().replace(/\s/g, '');
      this.profile.keywords[author] = (this.profile.keywords[author] || 0) + (engagementMultiplier * 1.5);
    }

    if (video.description) {
      this.extractAndSaveHashtags(video.description, engagementMultiplier);
    }

    this.saveProfile();
  }

  /**
   * Extract and memorize hashtags from titles and descriptions
   */
  extractAndSaveHashtags(text: string, weight: number = 1.0) {
    if (!text) return;
    const hashtagRegex = /#([a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]+)/g;
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      const tag = match[1].toLowerCase();
      if (tag.length >= 2 && !STOP_WORDS.has(tag)) {
        this.profile.hashtags[tag] = (this.profile.hashtags[tag] || 0) + weight;
      }
    }
  }

  /**
   * Get 5 random/top remembered hashtags for personalized recommendations & chips
   */
  getSampledHashtags(limit: number = 5): string[] {
    const tags = Object.entries(this.profile.hashtags)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20); // Top 20

    if (tags.length === 0) return [];

    // Shuffle and pick `limit` (default 5)
    const shuffled = tags.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit).map(([tag]) => `#${tag}`);
  }

  /**
   * Return map of saved hashtags with their appearance frequency weights
   */
  getHashtagsMap(): Record<string, number> {
    return { ...this.profile.hashtags };
  }

  /**
   * Deep analysis of video metadata (comments, tags, related videos)
   */
  processMetadataAnalysis(videoId: string, comments: any[], relatedVideos: any[]) {
    // 1. Analyze recurring themes in comments
    comments.slice(0, 10).forEach(c => {
      if (c.text) {
        this.extractKeywords(c.text.toLowerCase(), 0.1);
        this.extractAndSaveHashtags(c.text, 0.2);
      }
    });

    // 2. Analyze related videos
    relatedVideos.slice(0, 5).forEach(rv => {
      if (rv.title) {
        this.extractKeywords(rv.title.toLowerCase(), 0.5);
        this.extractAndSaveHashtags(rv.title, 0.3);
      }
    });

    this.saveProfile();
  }

  /**
   * Process a search query
   */
  processSearch(query: string) {
    if (!query) return;
    this.extractKeywords(query.toLowerCase(), 2.0);
    this.extractAndSaveHashtags(query, 2.0);
    this.saveProfile();
  }

  private extractKeywords(text: string, weight: number) {
    const words = text.split(/[\s,，、。./()（）「」『』【】[\]!！？?|:：_-]+/)
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

    words.forEach(word => {
      const finalWeight = (word.length <= 5) ? weight * 1.2 : weight;
      this.profile.keywords[word] = (this.profile.keywords[word] || 0) + finalWeight;
    });

    this.decayKeywords();
  }

  private decayKeywords() {
    const keys = Object.keys(this.profile.keywords);
    if (keys.length > 250) {
      const sorted = keys.sort((a, b) => this.profile.keywords[b] - this.profile.keywords[a]);
      const toRemove = sorted.slice(250);
      toRemove.forEach(k => delete this.profile.keywords[k]);
    }

    const tagKeys = Object.keys(this.profile.hashtags);
    if (tagKeys.length > 100) {
      const sortedTags = tagKeys.sort((a, b) => this.profile.hashtags[b] - this.profile.hashtags[a]);
      const toRemoveTags = sortedTags.slice(100);
      toRemoveTags.forEach(t => delete this.profile.hashtags[t]);
    }
  }

  /**
   * Get top suggested queries for recommendation API
   */
  getTopSuggestedQueries(limit: number = 8): string[] {
    const sortedKeywords = Object.entries(this.profile.keywords)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit * 2);

    if (sortedKeywords.length === 0) return [];

    const selected = sortedKeywords
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map(([word]) => word);

    return selected;
  }
}

export const localAI = new LocalIntelligence();
