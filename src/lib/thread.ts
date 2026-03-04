// Thread detection and fetching utilities
// Used for Cover Flow and Scroll thread viewer features

import { Agent } from '@atproto/api';
import type { Post, PostAuthor, ThreadPost } from '../types';
import { transformEmbed, extractLinkFacets } from './embed-utils';
import { createPublicAgent } from './feed';

/**
 * Check if a post is part of a thread
 * A post is considered part of a thread if:
 * - It has a parent (it's a reply in a thread)
 * - We need to check if the parent chain exists
 *
 * @param post - The post to check
 * @returns true if the post is part of a thread
 */
export function isThreadPost(post: Post): boolean {
  // If the post has a reply parent, it's definitely part of a thread
  return post.replyParent !== undefined;
}

/**
 * Transform a thread post view to our Post type
 */
function transformThreadPostView(postView: {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: { text?: string; reply?: { parent?: { uri?: string }; root?: { uri?: string } }; [key: string]: unknown };
  embed?: unknown;
  indexedAt: string;
  viewer?: {
    like?: string;
    repost?: string;
  };
}, parentAuthor?: PostAuthor): Post {
  const author: PostAuthor = {
    did: postView.author.did,
    handle: postView.author.handle,
    displayName: postView.author.displayName,
    avatar: postView.author.avatar,
  };

  const embed = transformEmbed(postView.embed);

  // Build reply parent info if available
  let replyParent: Post['replyParent'];
  if (parentAuthor && postView.record.reply?.parent?.uri) {
    replyParent = {
      uri: postView.record.reply.parent.uri,
      author: parentAuthor,
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

/**
 * Thread view post type from API response
 */
interface ThreadViewPost {
  $type: string;
  post: {
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    record: { text?: string; reply?: { parent?: { uri?: string }; root?: { uri?: string } }; [key: string]: unknown };
    embed?: unknown;
    indexedAt: string;
    viewer?: {
      like?: string;
      repost?: string;
    };
  };
  parent?: ThreadViewPost;
  replies?: ThreadViewPost[];
}

/**
 * Fetch the full thread context for a post
 * Returns an ordered array: [...parents, currentPost, ...allReplies]
 * with depth info for each post (depth 0 = root, depth 1 = reply to root, etc.)
 *
 * Shows ALL replies depth-first in Bluesky's default ordering.
 *
 * @param agent - ATProto agent (authenticated or null for public access)
 * @param post - The post to get thread context for
 * @returns Ordered array of ThreadPost (post + depth) in the thread
 */
export async function fetchThreadContext(
  agent: Agent | null,
  post: Post
): Promise<ThreadPost[]> {
  // Use public agent if no authenticated agent provided
  const effectiveAgent = agent ?? createPublicAgent();
  try {
    // Fetch the full thread with enough depth for parents and replies
    const response = await effectiveAgent.getPostThread({
      uri: post.uri,
      depth: 10, // Get up to 10 levels of replies
      parentHeight: 100, // Get all parents up to root
    });

    const thread = response.data.thread;

    // Check if we got a valid thread
    if (thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
      // Blocked or deleted thread
      return [{ post, depth: 0 }];
    }

    const threadView = thread as unknown as ThreadViewPost;
    const threadPosts: ThreadPost[] = [];

    // Walk UP the parent chain to find the root and count depth
    const parents: { post: Post; }[] = [];
    let currentParent = threadView.parent;
    let prevAuthor: PostAuthor | undefined;

    while (currentParent && currentParent.$type === 'app.bsky.feed.defs#threadViewPost') {
      const parentPost = transformThreadPostView(currentParent.post, prevAuthor);
      parents.unshift({ post: parentPost }); // Add to front so root is first
      prevAuthor = parentPost.author;
      currentParent = currentParent.parent;
    }

    // Add all parents with depth (root = 0, each child = parent + 1)
    for (let i = 0; i < parents.length; i++) {
      threadPosts.push({ post: parents[i].post, depth: i });
    }

    // Add the current post (with proper reply parent if it has one)
    const currentPostDepth = parents.length;
    const lastParent = parents.length > 0 ? parents[parents.length - 1] : undefined;
    const currentPostTransformed = transformThreadPostView(
      threadView.post,
      lastParent?.post.author
    );
    threadPosts.push({ post: currentPostTransformed, depth: currentPostDepth });

    // Walk DOWN all replies depth-first, following Bluesky's default ordering
    const collectAllReplies = (replies: ThreadViewPost[] | undefined, parentPost: Post, depth: number) => {
      if (!replies || replies.length === 0) return;

      for (const reply of replies) {
        if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') continue;

        const replyPost = transformThreadPostView(reply.post, parentPost.author);
        threadPosts.push({ post: replyPost, depth });

        // Recursively collect all replies to this reply
        collectAllReplies(reply.replies, replyPost, depth + 1);
      }
    };

    // Collect all replies starting from current post's depth + 1
    collectAllReplies(threadView.replies, currentPostTransformed, currentPostDepth + 1);

    return threadPosts;
  } catch (error) {
    console.error('Failed to fetch thread context:', error);
    // On error, just return the single post
    return [{ post, depth: 0 }];
  }
}

/**
 * Cache for thread context to avoid refetching
 * Key: post URI, Value: array of ThreadPosts
 */
const threadCache = new Map<string, ThreadPost[]>();

/**
 * Fetch thread context with caching
 * Uses cache to avoid redundant API calls when navigating back through posts
 *
 * @param agent - ATProto agent (authenticated or null for public access)
 * @param post - The post to get thread context for
 * @returns Ordered array of ThreadPosts (from cache or freshly fetched)
 */
export async function fetchThreadContextCached(
  agent: Agent | null,
  post: Post
): Promise<ThreadPost[]> {
  // Check cache first
  const cached = threadCache.get(post.uri);
  if (cached) {
    return cached;
  }

  // Fetch and cache
  const threadPosts = await fetchThreadContext(agent, post);
  threadCache.set(post.uri, threadPosts);

  return threadPosts;
}

