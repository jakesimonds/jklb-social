// Feed state management utilities
// Manages posts array, cursors, loading state, and deduplication

import { Agent } from '@atproto/api';
import type { PDSRecord } from './pds';
import { transformEmbed, extractLinkFacets } from './embed-utils';

// Test fixture data is gitignored — import dynamically so it's optional
let _testPostUrls: string[] = [];
let _testPdsRecords: Array<{ record: PDSRecord; handle: string }> = [];
if (import.meta.env.DEV) {
  try {
    const fixtures = await import('./test-fixtures');
    _testPostUrls = fixtures.TEST_POST_URLS;
    _testPdsRecords = fixtures.TEST_PDS_RECORDS;
  } catch {
    // test-fixtures.ts is gitignored — test modes just won't have data
  }
}

/**
 * Get hardcoded test PDS records for UI testing mode
 * Returns records wrapped with their author handles
 */
export function getTestPDSRecords(): Array<{ record: PDSRecord; handle: string }> {
  return _testPdsRecords;
}

/**
 * Parse a Bluesky web URL into handle and rkey components
 *
 * @param url - Bluesky web URL (e.g., https://bsky.app/profile/handle.bsky.social/post/abc123)
 * @returns Object with handle and rkey, or null if URL is invalid
 */
function parseBskyUrl(url: string): { handle: string; rkey: string } | null {
  try {
    const match = url.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/]+)/);
    if (!match) return null;
    return { handle: match[1], rkey: match[2] };
  } catch {
    return null;
  }
}

/**
 * Convert a Bluesky web URL to an AT Protocol URI
 *
 * @param agent - Authenticated ATProto agent (needed to resolve handle to DID)
 * @param url - Bluesky web URL
 * @returns AT URI (at://did/app.bsky.feed.post/rkey) or null if conversion fails
 */
async function bskyUrlToAtUri(agent: Agent, url: string): Promise<string | null> {
  const parsed = parseBskyUrl(url);
  if (!parsed) {
    console.warn(`Invalid Bluesky URL: ${url}`);
    return null;
  }

  try {
    // Resolve handle to DID
    const response = await agent.resolveHandle({ handle: parsed.handle });
    const did = response.data.did;

    // Construct AT URI
    return `at://${did}/app.bsky.feed.post/${parsed.rkey}`;
  } catch (error) {
    console.warn(`Failed to resolve handle for ${parsed.handle}:`, error);
    return null;
  }
}
import type {
  Post,
  FeedState,
  PostAuthor,
} from '../types';

/**
 * Creates an initial empty feed state
 */
export function createInitialFeedState(): FeedState {
  return {
    posts: [],
    cursors: {},
    isLoading: false,
    error: undefined,
    seenUris: new Set<string>(),
  };
}

/**
 * Creates a loading state (preserves posts but sets isLoading flag)
 */
export function setFeedLoading(state: FeedState, isLoading: boolean): FeedState {
  return {
    ...state,
    isLoading,
    error: isLoading ? undefined : state.error,
  };
}

/**
 * Sets an error on the feed state
 */
export function setFeedError(state: FeedState, error: string): FeedState {
  return {
    ...state,
    isLoading: false,
    error,
  };
}

/**
 * Clears the error from feed state
 */
export function clearFeedError(state: FeedState): FeedState {
  return {
    ...state,
    error: undefined,
  };
}

/**
 * Adds posts to the feed, deduplicating by URI
 * Returns new state (immutable)
 *
 * @param state - Current feed state
 * @param newPosts - Posts to add
 * @param maxPosts - Maximum total posts to keep (from settings)
 */
export function addPostsToFeed(
  state: FeedState,
  newPosts: Post[],
  maxPosts: number = 50
): FeedState {
  // Filter out posts we've already seen
  const uniqueNewPosts = newPosts.filter(post => !state.seenUris.has(post.uri));

  if (uniqueNewPosts.length === 0) {
    return state;
  }

  // Add new URIs to the seen set
  const newSeenUris = new Set(state.seenUris);
  uniqueNewPosts.forEach(post => newSeenUris.add(post.uri));

  // Combine posts, respecting max limit
  const combinedPosts = [...state.posts, ...uniqueNewPosts];
  const finalPosts = combinedPosts.slice(0, maxPosts);

  return {
    ...state,
    posts: finalPosts,
    seenUris: newSeenUris,
  };
}

/**
 * Prepends posts to the feed (for refresh/new posts at top)
 * Deduplicates by URI
 * Returns new state (immutable)
 */
export function prependPostsToFeed(
  state: FeedState,
  newPosts: Post[],
  maxPosts: number = 50
): FeedState {
  // Filter out posts we've already seen
  const uniqueNewPosts = newPosts.filter(post => !state.seenUris.has(post.uri));

  if (uniqueNewPosts.length === 0) {
    return state;
  }

  // Add new URIs to the seen set
  const newSeenUris = new Set(state.seenUris);
  uniqueNewPosts.forEach(post => newSeenUris.add(post.uri));

  // Prepend new posts, respecting max limit
  const combinedPosts = [...uniqueNewPosts, ...state.posts];
  const finalPosts = combinedPosts.slice(0, maxPosts);

  return {
    ...state,
    posts: finalPosts,
    seenUris: newSeenUris,
  };
}

/**
 * Updates the chronological cursor
 */
export function setChronoCursor(state: FeedState, cursor: string | undefined): FeedState {
  return {
    ...state,
    cursors: {
      ...state.cursors,
      chrono: cursor,
    },
  };
}

/**
 * Updates the algorithmic feed cursor
 */
export function setAlgoCursor(state: FeedState, cursor: string | undefined): FeedState {
  return {
    ...state,
    cursors: {
      ...state.cursors,
      algo: cursor,
    },
  };
}

/**
 * Clears all cursors (for full refresh)
 */
export function clearCursors(state: FeedState): FeedState {
  return {
    ...state,
    cursors: {},
  };
}

/**
 * Resets the feed to initial empty state
 * Used when settings change or user logs out
 */
export function resetFeed(): FeedState {
  return createInitialFeedState();
}

/**
 * Clears posts but keeps cursors and other state
 * Used for soft refresh
 */
export function clearPosts(state: FeedState): FeedState {
  return {
    ...state,
    posts: [],
    seenUris: new Set<string>(),
  };
}

/**
 * Updates a single post in the feed (e.g., after like/repost)
 * Returns new state (immutable)
 */
export function updatePostInFeed(
  state: FeedState,
  uri: string,
  updates: Partial<Post>
): FeedState {
  const postIndex = state.posts.findIndex(post => post.uri === uri);

  if (postIndex === -1) {
    return state;
  }

  const newPosts = [...state.posts];
  newPosts[postIndex] = {
    ...newPosts[postIndex],
    ...updates,
  };

  return {
    ...state,
    posts: newPosts,
  };
}

/**
 * Removes a post from the feed
 * Returns new state (immutable)
 */
export function removePostFromFeed(state: FeedState, uri: string): FeedState {
  const newPosts = state.posts.filter(post => post.uri !== uri);

  if (newPosts.length === state.posts.length) {
    return state;
  }

  // Note: We keep the URI in seenUris to prevent it from appearing again
  return {
    ...state,
    posts: newPosts,
  };
}

/**
 * Gets the count of posts currently in the feed
 */
export function getPostCount(state: FeedState): number {
  return state.posts.length;
}

/**
 * Checks if the feed is empty
 */
export function isFeedEmpty(state: FeedState): boolean {
  return state.posts.length === 0;
}

/**
 * Checks if the feed is loading
 */
export function isFeedLoading(state: FeedState): boolean {
  return state.isLoading;
}

/**
 * Checks if the feed has an error
 */
export function hasFeedError(state: FeedState): boolean {
  return state.error !== undefined;
}

/**
 * Gets posts for display (limited to first N for the viewport)
 * The 6-slot grid displays 6 posts at a time
 */
export function getDisplayPosts(state: FeedState, count: number = 6): Post[] {
  return state.posts.slice(0, count);
}

/**
 * Checks if a post URI has been seen (for deduplication)
 */
export function isPostSeen(state: FeedState, uri: string): boolean {
  return state.seenUris.has(uri);
}

/**
 * Gets the number of unique posts seen (includes removed posts)
 */
export function getSeenCount(state: FeedState): number {
  return state.seenUris.size;
}

// ============================================================================
// Deduplication Utilities
// ============================================================================

/**
 * Deduplication result with combined posts and tracking set
 */
export interface DeduplicationResult {
  posts: Post[];
  seenUris: Set<string>;
}

/**
 * Deduplicate an array of posts by URI
 * Returns only unique posts, preserving order (first occurrence wins)
 *
 * @param posts - Array of posts to deduplicate
 * @returns Array with duplicates removed
 */
export function deduplicatePosts(posts: Post[]): Post[] {
  const seen = new Set<string>();
  const uniquePosts: Post[] = [];

  for (const post of posts) {
    if (!seen.has(post.uri)) {
      seen.add(post.uri);
      uniquePosts.push(post);
    }
  }

  return uniquePosts;
}

/**
 * Combine multiple post arrays into one, deduplicating by URI
 * Posts from earlier arrays take precedence (first occurrence wins)
 *
 * This is the primary function for combining posts from multiple tiers:
 * - Tier 1: Chronological feed
 * - Tier 2: Chorus member posts
 * - Tier 3: Algorithmic feed
 *
 * @param postArrays - Arrays of posts to combine (in order of priority)
 * @param existingSeenUris - Optional Set of URIs already seen (for incremental deduplication)
 * @param maxPosts - Optional maximum number of posts to return
 * @returns DeduplicationResult with combined unique posts and updated seen set
 */
export function combineAndDeduplicatePosts(
  postArrays: Post[][],
  existingSeenUris?: Set<string>,
  maxPosts?: number
): DeduplicationResult {
  const seen = new Set<string>(existingSeenUris);
  const uniquePosts: Post[] = [];

  for (const posts of postArrays) {
    for (const post of posts) {
      if (!seen.has(post.uri)) {
        seen.add(post.uri);
        uniquePosts.push(post);

        // Stop if we've reached the max
        if (maxPosts !== undefined && uniquePosts.length >= maxPosts) {
          return { posts: uniquePosts, seenUris: seen };
        }
      }
    }
  }

  return { posts: uniquePosts, seenUris: seen };
}

// ============================================================================
// FeedItem Utilities - Unified Feed with Posts and PDS Records
// ============================================================================

import type { FeedItem, PostFeedItem, PDSFeedItem } from '../types';
import { isPostFeedItem } from '../types';

/**
 * Wrap a Post in a PostFeedItem for the unified feed
 */
export function wrapPostAsFeedItem(post: Post): PostFeedItem {
  return {
    type: 'post',
    uri: post.uri,
    indexedAt: post.indexedAt,
    post,
  };
}

/**
 * Wrap multiple Posts as FeedItems
 */
export function wrapPostsAsFeedItems(posts: Post[]): PostFeedItem[] {
  return posts.map(wrapPostAsFeedItem);
}

/**
 * Wrap a PDSRecord in a PDSFeedItem for the unified feed
 *
 * @param record - The PDS record to wrap
 * @param authorHandle - The handle of the record's author (from memberHandles map)
 */
export function wrapPDSRecordAsFeedItem(record: PDSRecord, authorHandle: string): PDSFeedItem {
  return {
    type: 'pds-record',
    uri: record.uri,
    indexedAt: record.createdAt,
    record: {
      uri: record.uri,
      cid: record.cid,
      collection: record.collection,
      createdAt: record.createdAt,
      record: record.record,
    },
    authorHandle,
  };
}

/**
 * Wrap PDSRecords as FeedItems
 *
 * @param records - Array of PDS records
 * @param memberHandles - Map of DID to handle for author display
 */
export function wrapPDSRecordsAsFeedItems(
  records: PDSRecord[],
  memberHandles: Map<string, string>
): PDSFeedItem[] {
  return records.map((record) => {
    // Extract DID from the record URI (at://did:xxx/collection/rkey)
    const didMatch = record.uri.match(/^at:\/\/(did:[^/]+)/);
    const did = didMatch ? didMatch[1] : '';
    const handle = memberHandles.get(did) || did;
    return wrapPDSRecordAsFeedItem(record, handle);
  });
}

/**
 * Result from combining feed items
 */
export interface FeedItemDeduplicationResult {
  items: FeedItem[];
  seenUris: Set<string>;
}

/**
 * Combine multiple FeedItem arrays into one, deduplicating by URI
 * Items from earlier arrays take precedence (first occurrence wins)
 *
 * This is the primary function for combining feed items from multiple tiers:
 * - Tier 1: Chronological feed (Posts)
 * - Tier 2: Chorus PDS records (Posts and PDSRecords)
 * - Tier 3: Algorithmic feed (Posts)
 *
 * @param itemArrays - Arrays of FeedItems to combine (in order of priority)
 * @param existingSeenUris - Optional Set of URIs already seen
 * @param maxItems - Optional maximum number of items to return
 */
export function combineAndDeduplicateFeedItems(
  itemArrays: FeedItem[][],
  existingSeenUris?: Set<string>,
  maxItems?: number
): FeedItemDeduplicationResult {
  const seen = new Set<string>(existingSeenUris);
  const uniqueItems: FeedItem[] = [];

  for (const items of itemArrays) {
    for (const item of items) {
      if (!seen.has(item.uri)) {
        seen.add(item.uri);
        uniqueItems.push(item);

        if (maxItems !== undefined && uniqueItems.length >= maxItems) {
          return { items: uniqueItems, seenUris: seen };
        }
      }
    }
  }

  return { items: uniqueItems, seenUris: seen };
}

// ============================================================================
// Reply Filtering & Self-Thread Collapsing
// ============================================================================

/**
 * Filter reply posts from the feed and collapse self-reply threads.
 *
 * Rules:
 * - Remove any post that is a reply to someone else (replyParent.author.did !== post.author.did)
 * - Keep self-reply threads (author replying to themselves) but collapse them to one feed item
 * - The root post of a self-thread is kept; all other posts in the chain are removed
 * - If the root isn't in the feed, keep the first encountered post from that thread
 * - Each collapsed thread counts as 1 toward postsViewed
 * - Non-post feed items (PDS records) are always kept
 */
export function filterRepliesAndCollapseThreads(items: FeedItem[]): FeedItem[] {
  return items.filter(item => {
    // Always keep non-post items (PDS records, etc.)
    if (!isPostFeedItem(item)) return true;
    // Hard rule: if it's a reply to anything, drop it
    if (item.post.replyParent) return false;
    // Also check the raw record — belt and suspenders
    const record = item.post as { record?: { reply?: unknown } };
    if (record.record?.reply) return false;
    return true;
  });
}

// ============================================================================
// API Fetching - Tier 1: Chronological Feed
// ============================================================================

/**
 * Result from fetching chronological feed
 */
export interface FetchChronoResult {
  posts: Post[];
  cursor: string | undefined;
}

/**
 * Transform an API FeedViewPost to our Post type
 */
function transformFeedViewPost(feedViewPost: {
  post: {
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
      viewer?: {
        following?: string;  // AT URI if authenticated user follows this author
      };
    };
    record: { text?: string; [key: string]: unknown };
    embed?: unknown;
    indexedAt: string;
    viewer?: {
      like?: string;
      repost?: string;
    };
  };
  reply?: {
    parent?: {
      $type?: string;
      uri?: string;
      author?: {
        did?: string;
        handle?: string;
        displayName?: string;
        avatar?: string;
      };
    };
  };
  reason?: {
    $type?: string;
    by?: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    indexedAt?: string;
  };
}): Post {
  const { post, reply, reason } = feedViewPost;

  const author: PostAuthor = {
    did: post.author.did,
    handle: post.author.handle,
    displayName: post.author.displayName,
    avatar: post.author.avatar,
    banner: (post.author as Record<string, unknown>).banner as string | undefined,
    isFollowing: !!post.author.viewer?.following,
    followUri: post.author.viewer?.following,
  };

  const embed = transformEmbed(post.embed);

  // Extract reply parent info if this is a reply
  // Check for parent with author info (don't be strict about $type - API may vary)
  let replyParent: Post['replyParent'];
  if (reply?.parent && reply.parent.author?.handle) {
    replyParent = {
      uri: reply.parent.uri || '',
      author: {
        did: reply.parent.author?.did || '',
        handle: reply.parent.author.handle,
        displayName: reply.parent.author?.displayName,
        avatar: reply.parent.author?.avatar,
      },
    };
  }
  // Fallback: check post.record.reply for reply reference (may not have full author info)
  // This at least lets us detect the post IS a reply even if we don't have parent details
  if (!replyParent && post.record.reply) {
    const recordReply = post.record.reply as { parent?: { uri?: string }; root?: { uri?: string } };
    if (recordReply.parent?.uri) {
      // We have a reply reference but no resolved parent - mark as reply with unknown author
      // The parent URI format is at://did:plc:xxx/app.bsky.feed.post/rkey
      // Extract the DID to use as a placeholder handle
      const parentUri = recordReply.parent.uri;
      const didMatch = parentUri.match(/at:\/\/(did:[^/]+)/);
      const parentDid = didMatch ? didMatch[1] : '';
      replyParent = {
        uri: parentUri,
        author: {
          did: parentDid,
          handle: '', // Don't use DID as handle — PostCard will show "you" for empty handles
          displayName: undefined,
          avatar: undefined,
        },
      };
    }
  }

  // Extract reply root URI (for self-thread collapsing)
  let replyRoot: Post['replyRoot'];
  if (post.record.reply) {
    const recordReply = post.record.reply as { root?: { uri?: string } };
    if (recordReply.root?.uri) {
      replyRoot = { uri: recordReply.root.uri };
    }
  }

  // Extract repost reason if this post appeared because someone reposted it
  let repostReason: Post['repostReason'];
  if (reason?.$type === 'app.bsky.feed.defs#reasonRepost' && reason.by) {
    repostReason = {
      by: {
        did: reason.by.did,
        handle: reason.by.handle,
        displayName: reason.by.displayName,
        avatar: reason.by.avatar,
      },
      indexedAt: reason.indexedAt || post.indexedAt,
    };
  }

  const linkFacets = extractLinkFacets(post.record.facets);
  return {
    uri: post.uri,
    cid: post.cid,
    author,
    text: post.record.text || '',
    indexedAt: post.indexedAt,
    embed,
    isLiked: !!post.viewer?.like,
    isReposted: !!post.viewer?.repost,
    likeUri: post.viewer?.like,
    repostUri: post.viewer?.repost,
    ...(linkFacets.length > 0 ? { linkFacets } : {}),
    replyParent,
    replyRoot,
    repostReason,
  };
}

/**
 * Fetch Tier 1 chronological feed from user's timeline
 *
 * Uses agent.getTimeline() to fetch the user's Following timeline
 * in reverse chronological order (newest first)
 *
 * @param agent - Authenticated ATProto agent
 * @param limit - Maximum number of posts to fetch (from settings.feed.chronoCount)
 * @param cursor - Optional cursor for pagination (for "load more")
 * @returns Posts array and cursor for next page
 */
export async function fetchChronoFeed(
  agent: Agent,
  limit: number,
  cursor?: string
): Promise<FetchChronoResult> {
  try {
    const response = await agent.getTimeline({
      limit,
      cursor,
    });

    const posts = response.data.feed.map((item) =>
      transformFeedViewPost(item as Parameters<typeof transformFeedViewPost>[0])
    );

    return {
      posts,
      cursor: response.data.cursor,
    };
  } catch (error) {
    console.error('Failed to fetch chronological feed:', error);
    throw error;
  }
}

// ============================================================================
// API Fetching - Tier 2: Chorus Member Feed
// ============================================================================

/**
 * Result from fetching chorus member posts
 */
export interface FetchChorusResult {
  posts: Post[];
}

/**
 * Fetch Tier 2 chorus member feed
 *
 * Fetches recent posts from each chorus member using agent.getAuthorFeed()
 * Posts are combined and sorted by indexedAt (newest first)
 *
 * @param agent - Authenticated ATProto agent
 * @param memberDids - Array of chorus member DIDs to fetch posts from
 * @param postsPerMember - Number of posts to fetch per member (default: 5)
 * @returns Combined posts array sorted by recency
 */
export async function fetchChorusFeed(
  agent: Agent,
  memberDids: string[],
  postsPerMember: number = 5
): Promise<FetchChorusResult> {
  if (memberDids.length === 0) {
    return { posts: [] };
  }

  try {
    // Fetch posts from each chorus member in parallel
    const fetchPromises = memberDids.map(async (did) => {
      try {
        const response = await agent.getAuthorFeed({
          actor: did,
          limit: postsPerMember,
          // Don't include replies in chorus feed - just original posts
          filter: 'posts_no_replies',
        });

        return response.data.feed.map((item) =>
          transformFeedViewPost(item as Parameters<typeof transformFeedViewPost>[0])
        );
      } catch (error) {
        // If fetching from one member fails, log and continue with others
        console.warn(`Failed to fetch posts for chorus member ${did}:`, error);
        return [];
      }
    });

    // Wait for all fetches to complete
    const postArrays = await Promise.all(fetchPromises);

    // Flatten all posts into a single array
    const allPosts = postArrays.flat();

    // Sort by indexedAt (newest first)
    allPosts.sort((a, b) => {
      const dateA = new Date(a.indexedAt).getTime();
      const dateB = new Date(b.indexedAt).getTime();
      return dateB - dateA;
    });

    return {
      posts: allPosts,
    };
  } catch (error) {
    console.error('Failed to fetch chorus member feed:', error);
    throw error;
  }
}

// ============================================================================
// API Fetching - Test Harness: Known Posts for Testing
// ============================================================================

/**
 * Result from fetching test posts
 */
export interface FetchTestPostsResult {
  posts: Post[];
}

/**
 * Transform an API PostView to our Post type
 * Similar to transformFeedViewPost but for direct post fetches (no feed wrapper)
 */
export function transformPostView(postView: {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    viewer?: {
      following?: string;  // AT URI if authenticated user follows this author
    };
  };
  record: { text?: string; reply?: { parent?: { uri?: string }; root?: { uri?: string } }; [key: string]: unknown };
  embed?: unknown;
  indexedAt: string;
  viewer?: {
    like?: string;
    repost?: string;
  };
}): Post {
  const author: PostAuthor = {
    did: postView.author.did,
    handle: postView.author.handle,
    displayName: postView.author.displayName,
    avatar: postView.author.avatar,
    banner: (postView.author as Record<string, unknown>).banner as string | undefined,
    isFollowing: !!postView.author.viewer?.following,
    followUri: postView.author.viewer?.following,
  };

  const embed = transformEmbed(postView.embed);

  // Check if this post is a reply (has reply.parent in record)
  // For direct post fetches, we don't have the resolved parent author info,
  // so we mark it as a reply but with minimal parent info
  let replyParent: Post['replyParent'];
  if (postView.record.reply?.parent?.uri) {
    const parentUri = postView.record.reply.parent.uri;
    // Extract DID from parent URI: at://did:plc:xxx/app.bsky.feed.post/rkey
    const didMatch = parentUri.match(/at:\/\/(did:[^/]+)/);
    const parentDid = didMatch ? didMatch[1] : '';
    replyParent = {
      uri: parentUri,
      author: {
        did: parentDid,
        // We don't have the handle from getPosts - will be resolved by thread view
        handle: '',
        displayName: undefined,
        avatar: undefined,
      },
    };
  }

  const linkFacets = extractLinkFacets(postView.record.facets);
  return {
    uri: postView.uri,
    cid: postView.cid,
    author,
    text: postView.record.text || '',
    indexedAt: postView.indexedAt,
    embed,
    isLiked: !!postView.viewer?.like,
    isReposted: !!postView.viewer?.repost,
    likeUri: postView.viewer?.like,
    repostUri: postView.viewer?.repost,
    ...(linkFacets.length > 0 ? { linkFacets } : {}),
    replyParent,
  };
}

// ============================================================================
// API Fetching - Replies for Current Post
// ============================================================================

/**
 * Result from fetching post replies
 */
export interface FetchRepliesResult {
  replies: Post[];
  postUri: string;
}

/**
 * Cache for replies to avoid refetching on k navigation
 * Key: post URI, Value: array of reply Posts
 */
const repliesCache = new Map<string, Post[]>();

/**
 * Clear the replies cache (e.g., on logout or refresh)
 */
export function clearRepliesCache(): void {
  repliesCache.clear();
}

/**
 * Get cached replies for a post URI
 */
export function getCachedReplies(postUri: string): Post[] | undefined {
  return repliesCache.get(postUri);
}

/**
 * Fetch replies for a specific post using getPostThread
 *
 * This function:
 * 1. Checks the cache first to avoid redundant API calls
 * 2. Fetches the thread via agent.getPostThread()
 * 3. Extracts the first 2 replies from the thread
 * 4. Caches the result for navigation back (k key)
 *
 * @param agent - Authenticated ATProto agent
 * @param postUri - The AT URI of the post to fetch replies for
 * @param maxReplies - Maximum number of replies to return (default: 2 for slots 4-5)
 * @returns Array of reply Posts
 */
export async function fetchPostReplies(
  agent: Agent,
  postUri: string,
  maxReplies: number = 2
): Promise<FetchRepliesResult> {
  // Check cache first
  const cached = repliesCache.get(postUri);
  if (cached) {
    return { replies: cached.slice(0, maxReplies), postUri };
  }

  try {
    const response = await agent.getPostThread({
      uri: postUri,
      depth: 1, // Only get immediate replies, not nested threads
      parentHeight: 0, // Don't fetch parent posts
    });

    // The thread response has replies in thread.replies
    const thread = response.data.thread;

    // Check if we got a valid thread with replies
    if (
      thread.$type !== 'app.bsky.feed.defs#threadViewPost' ||
      !('replies' in thread) ||
      !Array.isArray(thread.replies)
    ) {
      // No replies or blocked/deleted thread
      repliesCache.set(postUri, []);
      return { replies: [], postUri };
    }

    // Extract reply posts, filtering out blocked/deleted replies
    const replies: Post[] = [];
    for (const reply of thread.replies) {
      if (
        reply.$type === 'app.bsky.feed.defs#threadViewPost' &&
        'post' in reply &&
        reply.post
      ) {
        const replyPost = reply.post as {
          uri: string;
          cid: string;
          author: {
            did: string;
            handle: string;
            displayName?: string;
            avatar?: string;
          };
          record: { text?: string; [key: string]: unknown };
          embed?: unknown;
          indexedAt: string;
          viewer?: {
            like?: string;
            repost?: string;
          };
        };

        replies.push(transformPostView(replyPost));

        if (replies.length >= maxReplies) {
          break;
        }
      }
    }

    // Cache the replies
    repliesCache.set(postUri, replies);

    return { replies, postUri };
  } catch (error) {
    console.error(`Failed to fetch replies for ${postUri}:`, error);
    // Don't cache errors - allow retry
    return { replies: [], postUri };
  }
}

// ============================================================================
// API Fetching - Public Feed (unauthenticated)
// ============================================================================

/**
 * Creates an unauthenticated Agent for public API access
 * Uses bsky.social's public API endpoint
 */
export function createPublicAgent(): Agent {
  return new Agent({ service: 'https://public.api.bsky.app' });
}

/**
 * Fetch public Discover feed (no authentication required)
 *
 * Uses the public API to fetch the "What's Hot" / Discover feed
 * that anyone can browse without logging in.
 *
 * @param limit - Maximum number of posts to fetch
 * @param cursor - Optional cursor for pagination
 * @returns Posts array and cursor for next page
 */
export async function fetchPublicDiscoverFeed(
  limit: number = 30,
  cursor?: string
): Promise<FetchAlgoResult> {
  const agent = createPublicAgent();

  // The discover feed URI for Bluesky's "Discover" feed
  // This is the public feed generator that shows trending content
  const discoverFeedUri = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';

  try {
    const response = await agent.app.bsky.feed.getFeed({
      feed: discoverFeedUri,
      limit,
      cursor,
    });

    const posts = response.data.feed.map((item) =>
      transformFeedViewPost(item as Parameters<typeof transformFeedViewPost>[0])
    );

    return {
      posts,
      cursor: response.data.cursor,
    };
  } catch (error) {
    console.error('Failed to fetch public discover feed:', error);
    throw error;
  }
}

// ============================================================================
// API Fetching - Tier 3: Algorithmic Feed
// ============================================================================

/**
 * Result from fetching algorithmic feed
 */
export interface FetchAlgoResult {
  posts: Post[];
  cursor: string | undefined;
}

/**
 * Fetch Tier 3 algorithmic feed from a feed generator
 *
 * Uses agent.app.bsky.feed.getFeed() to fetch posts from a selected
 * feed generator (e.g., What's Hot, Discover, or custom feeds)
 *
 * @param agent - Authenticated ATProto agent
 * @param feedUri - AT URI of the feed generator (e.g., at://did:plc:.../app.bsky.feed.generator/whats-hot)
 * @param limit - Maximum number of posts to fetch
 * @param cursor - Optional cursor for pagination (for "load more")
 * @returns Posts array and cursor for next page
 */
export async function fetchAlgoFeed(
  agent: Agent,
  feedUri: string,
  limit: number,
  cursor?: string
): Promise<FetchAlgoResult> {
  if (!feedUri) {
    // No feed selected, return empty
    return { posts: [], cursor: undefined };
  }

  try {
    const response = await agent.app.bsky.feed.getFeed({
      feed: feedUri,
      limit,
      cursor,
    });

    const posts = response.data.feed.map((item) =>
      transformFeedViewPost(item as Parameters<typeof transformFeedViewPost>[0])
    );

    return {
      posts,
      cursor: response.data.cursor,
    };
  } catch (error) {
    console.error('Failed to fetch algorithmic feed:', error);
    throw error;
  }
}

// ============================================================================
// API Fetching - Test Harness: Known Posts for Testing
// ============================================================================

/**
 * Fetch test posts from hardcoded URLs for testing purposes
 *
 * This function:
 * 1. Converts Bluesky web URLs to AT URIs (resolving handles to DIDs)
 * 2. Fetches the posts via agent.getPosts()
 * 3. Returns them for prepending to the feed
 *
 * @param agent - Authenticated ATProto agent
 * @returns Posts array from the hardcoded test URLs
 */
export async function fetchTestPosts(agent: Agent): Promise<FetchTestPostsResult> {
  if (_testPostUrls.length === 0) {
    return { posts: [] };
  }

  try {
    // Convert all URLs to AT URIs in parallel
    const atUriPromises = _testPostUrls.map((url) => bskyUrlToAtUri(agent, url));
    const atUris = await Promise.all(atUriPromises);

    // Filter out any failed conversions
    const validUris = atUris.filter((uri): uri is string => uri !== null);

    if (validUris.length === 0) {
      console.warn('No valid test post URIs could be resolved');
      return { posts: [] };
    }

    // Fetch all posts in a single batch request
    const response = await agent.getPosts({ uris: validUris });

    // Transform to our Post type
    const posts = response.data.posts.map((postView) =>
      transformPostView(postView as Parameters<typeof transformPostView>[0])
    );

    return { posts };
  } catch (error) {
    console.error('Failed to fetch test posts:', error);
    // Don't throw - test posts are optional, just return empty
    return { posts: [] };
  }
}
