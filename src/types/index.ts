export type { ViewState, StageView, PanelView } from './viewState';

// TypeScript type definitions for russAbbot

/**
 * Session Tracking Types
 * Used for tracking user actions during each session
 */
export interface SessionMetrics {
  postsViewed: number;
  likes: number;
  unlikes: number;
  reposts: number;
  unreposts: number;
  replies: number;
  linksOpened: number;
  unfollows: number;
}

/**
 * Minimal post data stored when user likes a post
 * Used for award nomination feature to select "best post" from session
 */
export interface LikedPost {
  uri: string;
  cid: string;
  authorDisplayName: string;
  authorHandle: string;
  textPreview: string;  // First 100 chars of post text
  likedAt: string;      // ISO timestamp when liked
}

export interface Session {
  id: string;              // UUID
  startTime: string;       // ISO timestamp
  endTime?: string;        // ISO timestamp (set on end)
  metrics: SessionMetrics;
  likedPosts?: LikedPost[]; // Posts liked during this session (for award nomination)
}

/**
 * Settings Types
 * All user-configurable settings stored in localStorage
 */
export interface FeedSettings {
  chorusEnabled: boolean;
  algoFeed: string | null;  // AT URI or null for "Chronological"
  atmosphereEnabled: boolean;  // Show Atmosphere Report (chorus members' PDS activity)
  coverPhotoEnabled: boolean;  // Show author's cover/banner photo behind post card
  coverPhotoPosition: 'top' | 'bottom' | 'tile';  // Pin cover photo to top, bottom, or tile to fill screen
  postTextSize: 'small' | 'medium' | 'large';  // Scale text in PostCard
}

export interface CredibleExitSettings {
  postsBeforePrompt: number;
  prompt: string;
}

export interface LLMSettings {
  explanationPrompt: string;
}

export interface MusicSettings {
  enabled: boolean;                 // default false
  /** Per-phase track selection. Null = no track for that phase. */
  beginning: string | null;
  middle: string | null;
  end: string | null;
  /** @deprecated — migrated to per-phase fields. Kept for one-time migration only. */
  selectedTrackUri?: string | null;
}

export interface Settings {
  feed: FeedSettings;
  credibleExit: CredibleExitSettings;
  llm: LLMSettings;
  music: MusicSettings;
  credibleExitEnabled: boolean;
  tutorial: boolean;  // Show tutorial cards in Beginning flow (default true)
}

/**
 * Like Chorus Types
 * Users who have recently interacted with the authenticated user
 */

/**
 * How a chorus member entered the chorus (what interaction triggered it)
 * Used for color-coding avatars in the UI
 */
export type ChorusInteractionType = 'like' | 'follow' | 'repost' | 'quote' | 'reply' | 'mention';

export interface ChorusMember {
  did: string;           // Unique identifier
  handle: string;        // e.g., "alice.bsky.social"
  displayName?: string;  // e.g., "Alice"
  avatar?: string;       // Avatar URL
  enteredAt: number;     // Timestamp when member entered chorus (for FIFO eviction)
  interactionType?: ChorusInteractionType;  // How member entered (for avatar color-coding)
}

/**
 * Authentication Types
 * Session and user profile data for ATProtocol auth
 */
export interface AuthSession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  pdsUrl: string;
}

export interface UserProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

/**
 * Feed Types
 * Post and feed state management
 */
export interface PostAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  banner?: string;         // Profile cover/banner image URL
  isFollowing?: boolean;   // True if authenticated user follows this author
  followUri?: string;      // AT URI of follow record (needed for unfollow)
}

export interface PostEmbed {
  type: 'images' | 'video' | 'external' | 'record' | 'recordWithMedia';
  images?: PostImage[];
  video?: PostVideo;
  external?: PostExternal;
  record?: QuotedPost;
}

export interface PostImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: { width: number; height: number };
}

export interface PostVideo {
  playlist: string;  // HLS playlist URL
  thumbnail?: string;
  aspectRatio?: { width: number; height: number };
}

export interface PostExternal {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
}

export interface QuotedPost {
  uri: string;
  cid: string;
  author: PostAuthor;
  text: string;
  indexedAt: string;
  /** Media from the quoted post (images, video, or external link with thumb) */
  images?: PostImage[];
  video?: PostVideo;
  external?: PostExternal;
  /** Rich link facets with position info for highlighting */
  linkFacets?: RichLinkFacet[];
}

/**
 * A link facet with position info for text highlighting
 * byteStart/byteEnd are UTF-8 byte offsets from AT Proto
 */
export interface RichLinkFacet {
  url: string;
  byteStart: number;
  byteEnd: number;
}

export interface Post {
  uri: string;
  cid: string;
  author: PostAuthor;
  text: string;
  indexedAt: string;
  embed?: PostEmbed;
  // Note: No engagement counts (likeCount, repostCount, replyCount) by design
  // This prevents social comparison and supports mindful consumption
  isLiked: boolean;
  isReposted: boolean;
  likeUri?: string;      // URI of user's like record (for unlike)
  repostUri?: string;    // URI of user's repost record (for unrepost)
  /** Rich link facets with position info for highlighting */
  linkFacets?: RichLinkFacet[];
  replyParent?: {
    uri: string;
    author: PostAuthor;
  };
  /** Root post URI of the reply chain (for self-thread collapsing) */
  replyRoot?: {
    uri: string;
  };
  /** If present, this post appeared in feed because someone reposted it */
  repostReason?: {
    by: PostAuthor;
    indexedAt: string;
  };
}

/**
 * A post within a thread, with depth info for indentation
 * depth 0 = root of thread, depth 1 = reply to root, etc.
 */
export interface ThreadPost {
  post: Post;
  depth: number;
}

export interface FeedState {
  posts: Post[];
  cursors: {
    chrono?: string;
    algo?: string;
  };
  isLoading: boolean;
  error?: string;
  seenUris: Set<string>;  // For deduplication
}

/**
 * Layout Types
 * Note: ThemeMode removed in TASK-THEME-03 - app is always dark theme
 */

/**
 * Known Feed Generator URIs
 */
export const KNOWN_FEEDS = {
  FOR_YOU: 'at://did:plc:3guzzweuqraryl3rdkimjamk/app.bsky.feed.generator/for-you',
  WHATS_HOT: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
  DISCOVER: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/discover',
} as const;

/**
 * LocalStorage Keys
 */
export const STORAGE_KEYS = {
  SESSION: 'russabbot_session',
  SETTINGS: 'russabbot_settings',
  CURRENT_SESSION: 'russabbot_current_session',
  SESSIONS: 'russabbot_sessions',
  NOTIFICATIONS_SEEN_AT: 'russabbot_notifications_seen_at',
  SAVED_FEEDS: 'russabbot_saved_feeds',
} as const;

/**
 * Feed Item Types
 * Used for the unified feed that includes both Posts and PDS records
 */

/**
 * A wrapped PDS record for display in the feed
 * Includes the record itself plus metadata for display
 */
export interface PDSFeedItem {
  type: 'pds-record';
  uri: string;           // AT URI for deduplication
  indexedAt: string;     // For sorting
  record: {
    uri: string;
    cid: string;
    collection: string;
    createdAt: string;
    record: unknown;
  };
  authorHandle: string;  // Handle for display in PDSEventCard
}

/**
 * A regular post in the feed (wrapper for type discrimination)
 */
export interface PostFeedItem {
  type: 'post';
  uri: string;           // AT URI for deduplication
  indexedAt: string;     // For sorting
  post: Post;
}

/**
 * Union type for items that can appear in the feed
 * Either a regular Bluesky post or a PDS record
 */
export type FeedItem = PostFeedItem | PDSFeedItem;

/**
 * Type guard to check if a feed item is a Post
 */
export function isPostFeedItem(item: FeedItem): item is PostFeedItem {
  return item.type === 'post';
}

/**
 * Type guard to check if a feed item is a PDS record
 */
export function isPDSFeedItem(item: FeedItem): item is PDSFeedItem {
  return item.type === 'pds-record';
}

