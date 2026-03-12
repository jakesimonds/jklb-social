/**
 * JKLB Network Adapter Interface
 *
 * This is the contract between the JKLB UI and any social network.
 * To port JKLB to a new network, implement this interface.
 *
 * The adapter handles all network-specific logic:
 * - Authentication (including redirect-based OAuth flows)
 * - Fetching and transforming posts into universal JKLBPost format
 * - Write actions (like, boost, reply, quote)
 * - URL generation for the "escape hatch" (native platform links)
 *
 * The UI never touches network APIs directly. Everything goes through the adapter.
 *
 * Persistence boundary:
 * - The adapter owns all network-specific persistence (tokens, sessions, credentials).
 * - The client owns UI persistence (settings, session stats, seen-post cursors).
 * - The adapter must not depend on the client for storage, and vice versa.
 */

// =============================================================================
// Universal Data Types
// =============================================================================

/** A post in the JKLB universal format. Every adapter produces these. */
export interface JKLBPost {
  /** Unique identifier. Format is network-specific but treated as opaque string. */
  id: string;

  /** The post author. */
  author: JKLBAuthor;

  /** Plain text content. Adapters must convert from HTML, reconstruct mentions, etc. */
  text: string;

  /** Links extracted from text with byte positions for rich text rendering. */
  linkFacets: JKLBLinkFacet[];

  /**
   * Mentions extracted from text with byte positions.
   * Clicking a mention should open the user's profile on the native platform (escape hatch).
   * Optional — omit if the network doesn't support inline mentions.
   */
  mentionFacets: JKLBMentionFacet[];

  /**
   * Hashtags extracted from text with byte positions.
   * Optional — omit if the network doesn't support hashtags.
   */
  hashtagFacets: JKLBHashtagFacet[];

  /** Timestamp in ISO 8601 format. Adapters must normalize to this. */
  createdAt: string;

  /** Media attachments (images, video, link previews). */
  media: JKLBMedia | null;

  /** Embedded quoted post, if any. Recursive — a quoted post is also a JKLBPost. */
  quotedPost: JKLBPost | null;

  /** If this is a reply, the parent post's ID. */
  replyParentId: string | null;

  /** If this is a repost/boost, info about who reposted it. */
  repostBy: JKLBAuthor | null;

  /** Whether the current user has liked this post. */
  isLiked: boolean;

  /** Whether the current user has boosted/reposted this post. */
  isBoosted: boolean;

  /** Full URL to view this post on its native platform (escape hatch — V key). */
  nativeUrl: string;
}

export interface JKLBAuthor {
  /** Network-specific unique identifier (DID, FID, account ID, etc.). Opaque string. */
  id: string;

  /** Display handle (e.g., "alice.bsky.social", "alice@mastodon.social", "alice"). */
  handle: string;

  /** Human-readable display name. */
  displayName: string;

  /** Avatar image URL. */
  avatarUrl: string | null;

  /** Banner/cover photo URL. Null if not available or default/missing. */
  bannerUrl: string | null;

  /** Bio/description text (plain text, not HTML). */
  bio: string | null;

  /**
   * Full URL to view this profile on its native platform (escape hatch).
   * Every network must provide this. When in doubt, link back to the source.
   */
  profileUrl: string;
}

export interface JKLBLinkFacet {
  /** The URL this link points to. */
  uri: string;

  /** Display text for this link (may differ from URI). */
  text: string;

  /** Byte start position in the post text. */
  byteStart: number;

  /** Byte end position in the post text. */
  byteEnd: number;
}

export interface JKLBMentionFacet {
  /** The mentioned user's network-specific ID (opaque string). */
  userId: string;

  /** Display text (e.g., "@alice" or "@alice@mastodon.social"). */
  text: string;

  /**
   * URL to open when clicked (escape hatch — opens profile on native platform).
   * If the network has a web view for profiles, use that.
   */
  profileUrl: string;

  /** Byte start position in the post text. */
  byteStart: number;

  /** Byte end position in the post text. */
  byteEnd: number;
}

export interface JKLBHashtagFacet {
  /** The tag text without the # prefix (e.g., "photography", not "#photography"). */
  tag: string;

  /**
   * URL to open when clicked (escape hatch — opens hashtag view on native platform).
   * If no native hashtag URL exists, omit or use a search URL.
   */
  url: string | null;

  /** Byte start position in the post text (includes the #). */
  byteStart: number;

  /** Byte end position in the post text. */
  byteEnd: number;
}

// --- Media types ---

export type JKLBMedia =
  | { type: "images"; images: JKLBImage[] }
  | { type: "video"; video: JKLBVideo }
  | { type: "link-preview"; preview: JKLBLinkPreview };

export interface JKLBImage {
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  aspectRatio: number | null; // width / height
}

export interface JKLBVideo {
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  aspectRatio: number | null;
}

export interface JKLBLinkPreview {
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
}

// --- Thread types ---

export interface JKLBThreadPost {
  post: JKLBPost;
  depth: number; // 0 = root, 1 = direct reply, etc.
  isHighlighted: boolean; // true for the post the user pressed T on
}

// --- Notification types (for Beginning flow) ---

export type JKLBNotificationType =
  | "like"
  | "boost"
  | "follow"
  | "reply"
  | "quote"
  | "mention";

export interface JKLBNotification {
  type: JKLBNotificationType;
  /** Who performed the action. */
  actor: JKLBAuthor;
  /** The post involved (your post for likes/boosts, their post for replies/quotes/mentions). */
  post: JKLBPost | null;
  /** Your original post that was replied to, quoted, etc. Null for follows. */
  targetPost: JKLBPost | null;
  /** When this notification occurred. ISO 8601. */
  createdAt: string;
}

// --- Session types ---

export interface JKLBSession {
  /** The logged-in user. */
  user: JKLBAuthor;
  /** Whether the session is currently valid. */
  isValid: boolean;
}

// --- Feed types ---

export interface JKLBFeedPage {
  posts: JKLBPost[];
  /** Opaque cursor for pagination. Null if no more pages. */
  cursor: string | null;
}

export interface JKLBFeedOption {
  /** Unique identifier for this feed. */
  id: string;
  /** Human-readable name (e.g., "Following", "Discover", "Local"). */
  name: string;
}

// =============================================================================
// Capabilities Declaration
// =============================================================================

/**
 * Declares what the network supports. The UI adapts based on these flags.
 * Missing capabilities gracefully degrade — buttons hide, features skip.
 */
export interface NetworkCapabilities {
  /** Network supports notifications (enables Beginning flow). */
  notifications: boolean;

  /** Network has multiple feed options (enables feed selector on Middle card). */
  multipleFeeds: boolean;

  /** Network supports fetching thread context (enables T key). */
  threads: boolean;

  /** Network supports quote posts (enables Q key and quote display). */
  quotePosts: boolean;

  /** Network supports follow/unfollow (enables F key). */
  follow: boolean;

  /** Profiles have cover photos / banners. */
  coverPhotos: boolean;

  /** Network supports replying to posts (enables R key). */
  reply: boolean;

  /** Network supports inline mentions (enables mention facet rendering). */
  mentions: boolean;

  /** Network supports hashtags (enables hashtag facet rendering). */
  hashtags: boolean;
}

// =============================================================================
// The Adapter Interface
// =============================================================================

/**
 * The contract between the JKLB UI and a social network.
 *
 * Implement this interface to port JKLB to a new network.
 * The UI calls these methods — it never touches network APIs directly.
 */
export interface NetworkAdapter {
  // --- Identity ---

  /** Human-readable name of this network (e.g., "Bluesky", "Farcaster", "The Forkiverse"). */
  readonly networkName: string;

  /** What this network calls a "post" (e.g., "post", "cast", "status", "toot"). */
  readonly postNoun: string;

  /** What this network calls a "boost/repost" (e.g., "repost", "recast", "boost"). */
  readonly boostNoun: string;

  /** What this network calls a "like" (e.g., "like", "favourite"). */
  readonly likeNoun: string;

  /**
   * The "escape hatch" — the native app or website for this network.
   * Used in UI copy like "View on Bluesky" or "Open in Mastodon".
   * Every network must have one. When JKLB can't do something, it links here.
   */
  readonly nativeClientName: string;

  /** Base URL for the native client (e.g., "https://bsky.app", "https://mastodon.social"). */
  readonly nativeClientUrl: string;

  /** What capabilities this network supports. */
  readonly capabilities: NetworkCapabilities;

  // --- Authentication ---
  //
  // Auth is split into two methods to support redirect-based OAuth flows
  // (ATProto, Mastodon) as well as non-redirect flows (API keys, signer keys).
  //
  // Typical flow:
  //   1. App loads → call resumeSession() to check for existing session
  //   2. No session → show login form → user enters handle → call startLogin(handle)
  //   3. If redirect-based: user leaves page, comes back → resumeSession() detects
  //      callback params and completes the flow
  //   4. If non-redirect: startLogin() completes inline, resumeSession() picks it up
  //

  /**
   * Start the login flow.
   *
   * For redirect-based OAuth (ATProto, Mastodon): this redirects the user away.
   * The Promise resolves before the redirect (or rejects on error).
   *
   * For non-redirect flows (Farcaster signer keys, API tokens): this completes
   * the auth inline and stores the session for resumeSession() to find.
   *
   * @param handle - User-provided identifier. Format is network-specific:
   *   - ATProto: "alice.bsky.social"
   *   - Mastodon: "alice@mastodon.social" (adapter parses instance from handle)
   *   - Farcaster: "alice" (username)
   */
  startLogin(handle: string): Promise<void>;

  /**
   * Resume or complete a session. Called on every app load.
   *
   * This method handles three cases:
   *   1. OAuth callback: detects callback params in the URL, completes the flow,
   *      cleans the URL, returns the new session.
   *   2. Existing session: finds stored credentials, validates them, returns session.
   *   3. No session: returns null.
   *
   * @returns Session if one exists and is valid, null otherwise.
   */
  resumeSession(): Promise<JKLBSession | null>;

  /** End the current session. Clear stored tokens/credentials. */
  logout(): Promise<void>;

  // --- Feed ---

  /**
   * Fetch a page of posts for the feed.
   *
   * The adapter returns posts in its native ordering. The client handles
   * reply filtering (posts that are replies are dropped client-side).
   *
   * @param feedId - Which feed to fetch (from getAvailableFeeds). Null = default feed.
   * @param cursor - Pagination cursor from a previous call. Null = first page.
   * @param limit - Max posts to return.
   * @returns A page of posts with an optional cursor for the next page.
   */
  fetchFeed(
    feedId: string | null,
    cursor: string | null,
    limit: number
  ): Promise<JKLBFeedPage>;

  /**
   * Get available feed options (e.g., "Following", "Discover", "Local").
   * Only called if capabilities.multipleFeeds is true.
   * @returns List of feed options for the Middle card dropdown.
   */
  getAvailableFeeds(): Promise<JKLBFeedOption[]>;

  // --- Post Actions ---

  /** Toggle like on a post. Returns the new liked state. */
  toggleLike(postId: string): Promise<boolean>;

  /** Toggle boost/repost on a post. Returns the new boosted state. */
  toggleBoost(postId: string): Promise<boolean>;

  /**
   * Reply to a post.
   * Only called if capabilities.reply is true.
   */
  reply(parentPostId: string, text: string): Promise<void>;

  /**
   * Quote a post.
   * Only called if capabilities.quotePosts is true.
   */
  quotePost(quotedPostId: string, text: string): Promise<void>;

  /**
   * Toggle follow on a user. Returns the new follow state.
   * Only called if capabilities.follow is true.
   */
  toggleFollow(authorId: string): Promise<boolean>;

  // --- Thread ---

  /**
   * Fetch thread context for a post (ancestors + descendants).
   * Only called if capabilities.threads is true.
   * @returns Ordered list of thread posts with depth info.
   */
  fetchThread(postId: string): Promise<JKLBThreadPost[]>;

  // --- Notifications (for Beginning flow) ---

  /**
   * Fetch recent notifications grouped by type.
   * Only called if capabilities.notifications is true.
   * @returns Notifications sorted by recency.
   */
  fetchNotifications(): Promise<JKLBNotification[]>;

  // --- URLs (Escape Hatch) ---

  /** Get the native platform URL for a post (V key — "View on [nativeClientName]"). */
  getPostUrl(post: JKLBPost): string;

  /** Get the native platform URL for a user profile (clicking mentions/avatars). */
  getProfileUrl(author: JKLBAuthor): string;
}
