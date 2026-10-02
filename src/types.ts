export interface VideoThumbnail {
  url: string;
  width?: number;
  height?: number;
  quality?: string;
}

export interface Video {
  videoId?: string;
  playlistId?: string;
  type?: 'video' | 'playlist' | 'mix';
  title: string;
  author: string;
  authorId?: string;
  authorAvatar?: string;
  multipleChannelIds?: string[];
  viewCount: number;
  publishedText: string;
  lengthSeconds: number;
  videoThumbnails: VideoThumbnail[];
  description?: string;
  tags?: string[];
  hashtags?: string[];
  subCount?: number;
  likeCount?: number;
  recommendedVideos?: Video[];
  isLive?: boolean;
  liveViewerCount?: number;
  isPremiere?: boolean;
  isUpcoming?: boolean;
  isPlayerOnly?: boolean;
}

export interface CommunityPost {
  id: string;
  author: string;
  authorAvatar?: string;
  publishedTime: string;
  text: string;
  images?: string[];
  likeCount: number;
  commentCount: number;
  votePoll?: {
    question: string;
    options: { text: string; votesPercent: number }[];
    totalVotes: number;
  };
}

export interface ReleaseItem {
  id: string;
  title: string;
  thumbnail: string;
  releaseDate: string;
  trackCount: number;
  type: 'Album' | 'Single' | 'EP';
}

export interface ShortVideo {
  videoId: string;
  title: string;
  author: string;
  authorId?: string;
  authorAvatar?: string;
  viewCount?: number;
  likeCount?: string | number;
  commentCount?: string | number;
}

export interface Comment {
  id: string;
  author: string;
  authorId?: string;
  authorAvatar?: string;
  text: string;
  publishedTime: string;
  likeCount: string | number;
}

export interface Playlist {
  id: string;
  title: string;
  thumbnail: string;
  videoCount: number;
  updatedAt?: string;
}

export interface Channel {
  id: string;
  title: string;
  description: string;
  avatar?: string;
  banner?: string;
  subCountText?: string;
  videosCountText?: string;
  featuredVideo?: Video;
  videos: Video[];
  shortVideos?: Video[];
  playlists?: Playlist[];
  releases?: ReleaseItem[];
  liveVideos?: Video[];
  communityPosts?: CommunityPost[];
}

export interface ChannelSubscription {
  id: string;
  title: string;
  avatar?: string;
}

export interface UserPlaylist {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  videos: Video[];
}

export interface WatchHistoryItem {
  videoId: string;
  title: string;
  author: string;
  authorAvatar?: string;
  thumbnailUrl?: string;
  lengthSeconds?: number;
  viewCount?: number;
  timestamp: number;
  type: 'video' | 'short';
}

export interface UserInfo {
  name: string;
  email: string;
  picture?: string;
  avatar?: string;
  sub?: string;
  handle?: string;
  subscriberCount?: string;
  videoCount?: string;
  bannerUrl?: string;
}

export interface SearchChannel {
  id: string;
  title: string;
  handle?: string;
  avatar?: string;
  subscribers?: string;
  videoCount?: string;
  description?: string;
  isVerified?: boolean;
}

export interface DailyUsageLimits {
  videos: {
    used: number;
    limit: number;
    remaining: number;
  };
  searches: {
    used: number;
    limit: number;
    remaining: number;
  };
  total: {
    used: number;
    limit: number;
    remaining: number;
  };
  resetAt: string;
  resetSeconds: number;
  isLimited: boolean;
  limitedType: 'video' | 'search' | 'total' | 'burst' | null;
}

