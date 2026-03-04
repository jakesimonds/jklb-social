// Feed state management utilities for russAbbot mobile
// Adapted from src/lib/feed.ts — fixed imports for React Native
// Removed: Test harness data (TEST_POST_URLS, TEST_PDS_RECORDS) — not needed for mobile
// Removed: pds.ts dependency — PDSRecord type inlined where needed

import { Agent } from '@atproto/api';
import { transformEmbed, extractLinkFacets } from './embed-utils';
import type {
  Post,
  FeedState,
  PostAuthor,
  FeedItem,
  PostFeedItem,
  PDSFeedItem,
} from './types';

/**
 * PDSRecord type (inlined from pds.ts to avoid pulling in DOM-dependent code)
 */
export interface PDSRecord {
  uri: string;
  cid: string;
  collection: string;
  createdAt: string;
  record: unknown;
}

// ============================================================================
// Feed State Management
// ============================================================================

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
 */
export function addPostsToFeed(
  state: FeedState,
  newPosts: Post[],
  maxPosts: number = 50
): FeedState {
  const uniqueNewPosts = newPosts.filter(post => !state.seenUris.has(post.uri));

  if (uniqueNewPosts.length === 0) {
    return state;
  }

  const newSeenUris = new Set(state.seenUris);
  uniqueNewPosts.forEach(post => newSeenUris.add(post.uri));

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
 */
export function prependPostsToFeed(
  state: FeedState,
  newPosts: Post[],
  maxPosts: number = 50
): FeedState {
  const uniqueNewPosts = newPosts.filter(post => !state.seenUris.has(post.uri));

  if (uniqueNewPosts.length === 0) {
    return state;
  }

  const newSeenUris = new Set(state.seenUris);
  uniqueNewPosts.forEach(post => newSeenUris.add(post.uri));

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
 */
export function resetFeed(): FeedState {
  return createInitialFeedState();
}

/**
 * Clears posts but keeps cursors and other state
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
 */
export function removePostFromFeed(state: FeedState, uri: string): FeedState {
  const newPosts = state.posts.filter(post => post.uri !== uri);

  if (newPosts.length === state.posts.length) {
    return state;
  }

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
 */
export function wrapPDSRecordsAsFeedItems(
  records: PDSRecord[],
  memberHandles: Map<string, string>
): PDSFeedItem[] {
  return records.map((record) => {
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
// Banner Fetching — getProfiles for cover photos
// ============================================================================

/** Cache for author banners — keyed by DID, persists across feed loads */
const bannerCache = new Map<string, string | null>();

/**
 * Fetch banner URLs via getProfiles and patch them onto posts.
 * The timeline API only returns profileViewBasic (no banner), so we
 * need a separate getProfiles call.
 */
export async function fetchBanners(
  agent: Agent,
  posts: Post[],
): Promise<void> {
  // Collect unique DIDs that we haven't cached yet
  const uncachedDids = [...new Set(posts.map(p => p.author.did))]
    .filter(did => !bannerCache.has(did));

  // Fetch profiles in batches of 25 (API limit)
  if (uncachedDids.length > 0) {
    try {
      const res = await agent.getProfiles({ actors: uncachedDids.slice(0, 25) });
      for (const profile of res.data.profiles) {
        bannerCache.set(profile.did, profile.banner ?? null);
      }
      // Mark any unfound DIDs as null so we don't retry
      for (const did of uncachedDids) {
        if (!bannerCache.has(did)) bannerCache.set(did, null);
      }
    } catch (err) {
      console.warn('Banner fetch failed:', err);
    }
  }

  // Patch banner URLs onto posts from cache
  for (const post of posts) {
    const banner = bannerCache.get(post.author.did);
    if (banner) {
      post.author.banner = banner;
    }
  }
}

// ============================================================================
// API Fetching - Transform helpers
// ============================================================================

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
        following?: string;
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
  if (!replyParent && post.record.reply) {
    const recordReply = post.record.reply as { parent?: { uri?: string }; root?: { uri?: string } };
    if (recordReply.parent?.uri) {
      const parentUri = recordReply.parent.uri;
      const didMatch = parentUri.match(/at:\/\/(did:[^/]+)/);
      const parentDid = didMatch ? didMatch[1] : '';
      replyParent = {
        uri: parentUri,
        author: {
          did: parentDid,
          handle: parentDid ? `${parentDid.slice(0, 20)}...` : 'unknown',
          displayName: undefined,
          avatar: undefined,
        },
      };
    }
  }

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
    repostReason,
  };
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
      following?: string;
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

  let replyParent: Post['replyParent'];
  if (postView.record.reply?.parent?.uri) {
    const parentUri = postView.record.reply.parent.uri;
    const didMatch = parentUri.match(/at:\/\/(did:[^/]+)/);
    const parentDid = didMatch ? didMatch[1] : '';
    replyParent = {
      uri: parentUri,
      author: {
        did: parentDid,
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
// API Fetching - Tier 1: Chronological Feed
// ============================================================================

export interface FetchChronoResult {
  posts: Post[];
  cursor: string | undefined;
}

/**
 * Fetch Tier 1 chronological feed from user's timeline
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

export interface FetchChorusResult {
  posts: Post[];
}

/**
 * Fetch Tier 2 chorus member feed
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
    const fetchPromises = memberDids.map(async (did) => {
      try {
        const response = await agent.getAuthorFeed({
          actor: did,
          limit: postsPerMember,
          filter: 'posts_no_replies',
        });

        return response.data.feed.map((item) =>
          transformFeedViewPost(item as Parameters<typeof transformFeedViewPost>[0])
        );
      } catch (error) {
        console.warn(`Failed to fetch posts for chorus member ${did}:`, error);
        return [];
      }
    });

    const postArrays = await Promise.all(fetchPromises);
    const allPosts = postArrays.flat();

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
// API Fetching - Replies for Current Post
// ============================================================================

export interface FetchRepliesResult {
  replies: Post[];
  postUri: string;
}

const repliesCache = new Map<string, Post[]>();

export function clearRepliesCache(): void {
  repliesCache.clear();
}

export function getCachedReplies(postUri: string): Post[] | undefined {
  return repliesCache.get(postUri);
}

/**
 * Fetch replies for a specific post using getPostThread
 */
export async function fetchPostReplies(
  agent: Agent,
  postUri: string,
  maxReplies: number = 2
): Promise<FetchRepliesResult> {
  const cached = repliesCache.get(postUri);
  if (cached) {
    return { replies: cached.slice(0, maxReplies), postUri };
  }

  try {
    const response = await agent.getPostThread({
      uri: postUri,
      depth: 1,
      parentHeight: 0,
    });

    const thread = response.data.thread;

    if (
      thread.$type !== 'app.bsky.feed.defs#threadViewPost' ||
      !('replies' in thread) ||
      !Array.isArray(thread.replies)
    ) {
      repliesCache.set(postUri, []);
      return { replies: [], postUri };
    }

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

    repliesCache.set(postUri, replies);

    return { replies, postUri };
  } catch (error) {
    console.error(`Failed to fetch replies for ${postUri}:`, error);
    return { replies: [], postUri };
  }
}

// ============================================================================
// API Fetching - Public Feed (unauthenticated)
// ============================================================================

export function createPublicAgent(): Agent {
  return new Agent({ service: 'https://public.api.bsky.app' });
}

export interface FetchAlgoResult {
  posts: Post[];
  cursor: string | undefined;
}

/**
 * Fetch public Discover feed (no authentication required)
 */
export async function fetchPublicDiscoverFeed(
  limit: number = 30,
  cursor?: string
): Promise<FetchAlgoResult> {
  const agent = createPublicAgent();

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
 * Fetch Tier 3 algorithmic feed from a feed generator
 */
export async function fetchAlgoFeed(
  agent: Agent,
  feedUri: string,
  limit: number,
  cursor?: string
): Promise<FetchAlgoResult> {
  if (!feedUri) {
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
