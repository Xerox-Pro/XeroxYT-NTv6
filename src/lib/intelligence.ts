/**
 * Local Intelligence Engine
 * Analyzes user behavior and video metadata without external API calls.
 */

export interface InterestProfile {
  keywords: Record<string, number>; // Keyword -> Score
  categories: Record<string, number>; // Category ID -> Score
  interactions: { type: string, timestamp: number, data: any }[];
  lastUpdated: number;
}

const STOP_WORDS = new Set(['の', 'に', 'は', 'を', 'た', 'だ', 'で', 'と', 'が', 'も', 'な', 'い', 'です', 'ます', '。', '、', '！', '？', '(', ')', '[', ']', '【', '】', 'official', 'mv', 'music', 'video', 'ch', 'channel', '公式', '動画']);

export class LocalIntelligence {
  private profile: InterestProfile;

  constructor() {
    this.profile = this.loadProfile();
  }

  private loadProfile(): InterestProfile {
    try {
      const saved = localStorage.getItem('xerox_local_ai_profile');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load local AI profile', e);
    }
    return { keywords: {}, categories: {}, interactions: [], lastUpdated: Date.now() };
  }

  private saveProfile() {
    this.profile.lastUpdated = Date.now();
    localStorage.setItem('xerox_local_ai_profile', JSON.stringify(this.profile));
  }

  /**
   * Process a video interaction (watch, like, etc.)
   */
  processVideoInteraction(video: any, weight: number = 1.0) {
    if (!video) return;

    // Record interaction for temporal analysis
    this.profile.interactions.push({
      type: 'watch',
      timestamp: Date.now(),
      data: { videoId: video.videoId, title: video.title }
    });
    if (this.profile.interactions.length > 50) this.profile.interactions.shift();

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
   * Deep analysis of video metadata (comments, tags, related videos)
   */
  processMetadataAnalysis(videoId: string, comments: any[], relatedVideos: any[]) {
    // 1. Analyze recurring themes in comments (simplistic)
    comments.slice(0, 10).forEach(c => {
      if (c.text) {
        this.extractKeywords(c.text.toLowerCase(), 0.1); // Low weight for comments
      }
    });

    // 2. Analyze related videos (stronger signal of what's next)
    relatedVideos.slice(0, 5).forEach(rv => {
      if (rv.title) {
        this.extractKeywords(rv.title.toLowerCase(), 0.5);
      }
    });

    this.saveProfile();
  }

  /**
   * Process a search query
   */
  processSearch(query: string) {
    if (!query) return;
    this.extractKeywords(query.toLowerCase(), 2.0); // Search is a strong signal
    this.saveProfile();
  }

  private extractKeywords(text: string, weight: number) {
    // Simple split by non-alphanumeric/kanji
    const words = text.split(/[\s,，、。./()（）「」『』【】[\]!！？?|:：_-]+/)
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

    words.forEach(word => {
      // Bonus weight for shorter, potentially core keywords (2-5 chars in Japanese)
      const finalWeight = (word.length <= 5) ? weight * 1.2 : weight;
      this.profile.keywords[word] = (this.profile.keywords[word] || 0) + finalWeight;
    });

    // Limit keywords count by decay
    this.decayKeywords();
  }

  private decayKeywords() {
    const keys = Object.keys(this.profile.keywords);
    if (keys.length > 200) {
      // Sort by score and keep top 200
      const sorted = keys.sort((a, b) => this.profile.keywords[b] - this.profile.keywords[a]);
      const toRemove = sorted.slice(200);
      toRemove.forEach(k => delete this.profile.keywords[k]);
    }

    // Occasional global decay to prevent "stale" old interests from dominating forever
    if (Math.random() < 0.1) {
      keys.forEach(k => {
        this.profile.keywords[k] *= 0.95;
      });
    }
  }

  /**
   * Get top suggested queries for recommendation API
   */
  getTopSuggestedQueries(limit: number = 5): string[] {
    const sortedKeywords = Object.entries(this.profile.keywords)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit * 2);

    if (sortedKeywords.length === 0) return [];

    // Shuffle and pick
    const selected = sortedKeywords
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map(([word]) => word);

    return selected;
  }
}

export const localAI = new LocalIntelligence();
