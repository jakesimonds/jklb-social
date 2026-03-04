// User actions for interacting with posts
// Like, unlike, repost, unrepost, reply, etc.

import { RichText } from '@atproto/api';
import type { Agent } from '@atproto/api';
import type { Post, LikedPost, SessionMetrics } from '../types';

/**
 * Upload an image blob and return the embed-ready image object
 * with explicit aspectRatio so Bluesky doesn't stretch it.
 */
async function uploadImageBlob(agent: Agent, file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const res = await agent.uploadBlob(uint8, { encoding: file.type });

  // Read natural dimensions for aspectRatio
  const dimensions = await getImageDimensions(file);

  return {
    image: res.data.blob,
    alt: '',
    aspectRatio: { width: dimensions.width, height: dimensions.height },
  };
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Result from toggling a like on a post
 */
export interface ToggleLikeResult {
  success: boolean;
  isLiked: boolean;
  likeUri?: string;
  error?: string;
}

/**
 * Toggle like on a post
 *
 * If the post is not liked, like it.
 * If the post is already liked, unlike it.
 *
 * @param agent - Authenticated ATProto agent
 * @param post - The post to like/unlike
 * @returns Result with new like state and URI
 */
export async function toggleLike(
  agent: Agent,
  post: Post
): Promise<ToggleLikeResult> {
  try {
    if (post.isLiked && post.likeUri) {
      // Unlike the post - delete the like record
      await agent.deleteLike(post.likeUri);
      return {
        success: true,
        isLiked: false,
        likeUri: undefined,
      };
    } else {
      // Like the post - create a like record
      const response = await agent.like(post.uri, post.cid);
      return {
        success: true,
        isLiked: true,
        likeUri: response.uri,
      };
    }
  } catch (error) {
    console.error('Failed to toggle like:', error);
    return {
      success: false,
      isLiked: post.isLiked,
      likeUri: post.likeUri,
      error: error instanceof Error ? error.message : 'Failed to toggle like',
    };
  }
}

/**
 * Result from toggling a repost on a post
 */
export interface ToggleRepostResult {
  success: boolean;
  isReposted: boolean;
  repostUri?: string;
  error?: string;
}

/**
 * Toggle repost on a post
 *
 * If the post is not reposted, repost it.
 * If the post is already reposted, unrepost it.
 *
 * @param agent - Authenticated ATProto agent
 * @param post - The post to repost/unrepost
 * @returns Result with new repost state and URI
 */
export async function toggleRepost(
  agent: Agent,
  post: Post
): Promise<ToggleRepostResult> {
  try {
    if (post.isReposted && post.repostUri) {
      // Unrepost - delete the repost record
      await agent.deleteRepost(post.repostUri);
      return {
        success: true,
        isReposted: false,
        repostUri: undefined,
      };
    } else {
      // Repost - create a repost record
      const response = await agent.repost(post.uri, post.cid);
      return {
        success: true,
        isReposted: true,
        repostUri: response.uri,
      };
    }
  } catch (error) {
    console.error('Failed to toggle repost:', error);
    return {
      success: false,
      isReposted: post.isReposted,
      repostUri: post.repostUri,
      error: error instanceof Error ? error.message : 'Failed to toggle repost',
    };
  }
}

/**
 * Result from creating a reply
 */
export interface CreateReplyResult {
  success: boolean;
  uri?: string;
  cid?: string;
  error?: string;
}

/**
 * Result from creating a quote post
 */
export interface CreateQuotePostResult {
  success: boolean;
  uri?: string;
  cid?: string;
  error?: string;
}

/**
 * Create a reply to a post
 *
 * @param agent - Authenticated ATProto agent
 * @param post - The post to reply to
 * @param text - The reply text content
 * @returns Result with the new reply's URI and CID
 */
export async function createReply(
  agent: Agent,
  post: Post,
  text: string,
  image?: File | null
): Promise<CreateReplyResult> {
  try {
    // Create RichText to detect mentions, links, etc.
    const rt = new RichText({ text });
    await rt.detectFacets(agent);

    // Build the reply reference
    // If the post we're replying to has a parent, we need both root and parent
    // Otherwise, the post we're replying to is both the root and parent
    const reply = {
      root: post.replyParent
        ? { uri: post.replyParent.uri, cid: post.cid } // Reply to a reply - use original root
        : { uri: post.uri, cid: post.cid },
      parent: { uri: post.uri, cid: post.cid },
    };

    // Build image embed if provided
    let embed: Record<string, unknown> | undefined;
    if (image) {
      const imageData = await uploadImageBlob(agent, image);
      embed = {
        $type: 'app.bsky.embed.images' as const,
        images: [imageData],
      };
    }

    const postData: Record<string, unknown> = {
      text: rt.text,
      facets: rt.facets,
      reply,
    };
    if (embed) postData.embed = embed;

    const response = await agent.post(postData as Parameters<typeof agent.post>[0]);

    return {
      success: true,
      uri: response.uri,
      cid: response.cid,
    };
  } catch (error) {
    console.error('Failed to create reply:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create reply',
    };
  }
}

/**
 * Create a quote post (post with embedded quoted post)
 *
 * @param agent - Authenticated ATProto agent
 * @param quotedPost - The post to quote
 * @param text - The quote post text content
 * @returns Result with the new post's URI and CID
 */
export async function createQuotePost(
  agent: Agent,
  quotedPost: Post,
  text: string,
  image?: File | null
): Promise<CreateQuotePostResult> {
  try {
    // Create RichText to detect mentions, links, etc.
    const rt = new RichText({ text });
    await rt.detectFacets(agent);

    // Build the embed — quote + image requires recordWithMedia
    let embed: Record<string, unknown>;
    if (image) {
      const imageData = await uploadImageBlob(agent, image);
      embed = {
        $type: 'app.bsky.embed.recordWithMedia' as const,
        record: {
          $type: 'app.bsky.embed.record' as const,
          record: {
            uri: quotedPost.uri,
            cid: quotedPost.cid,
          },
        },
        media: {
          $type: 'app.bsky.embed.images' as const,
          images: [imageData],
        },
      };
    } else {
      embed = {
        $type: 'app.bsky.embed.record' as const,
        record: {
          uri: quotedPost.uri,
          cid: quotedPost.cid,
        },
      };
    }

    const response = await agent.post({
      text: rt.text,
      facets: rt.facets,
      embed,
    } as Parameters<typeof agent.post>[0]);

    return {
      success: true,
      uri: response.uri,
      cid: response.cid,
    };
  } catch (error) {
    console.error('Failed to create quote post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create quote post',
    };
  }
}

/**
 * Result from creating a new post
 */
export interface CreatePostResult {
  success: boolean;
  uri?: string;
  cid?: string;
  error?: string;
}

/**
 * Result from unfollowing a user
 */
export interface UnfollowResult {
  success: boolean;
  error?: string;
}

/**
 * Result from toggling follow on an author
 */
export interface ToggleFollowResult {
  success: boolean;
  isFollowing: boolean;
  followUri?: string;
  error?: string;
}

/**
 * Create a new post
 *
 * @param agent - Authenticated ATProto agent
 * @param text - The post text content
 * @returns Result with the new post's URI and CID
 */
export async function createPost(
  agent: Agent,
  text: string
): Promise<CreatePostResult> {
  try {
    // Create RichText to detect mentions, links, etc.
    const rt = new RichText({ text });
    await rt.detectFacets(agent);

    const response = await agent.post({
      text: rt.text,
      facets: rt.facets,
    });

    return {
      success: true,
      uri: response.uri,
      cid: response.cid,
    };
  } catch (error) {
    console.error('Failed to create post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create post',
    };
  }
}

/**
 * Unfollow an author
 *
 * Looks up if the user is following the author, and if so, unfollows them.
 * If not following, returns success (no-op).
 *
 * @param agent - Authenticated ATProto agent
 * @param userDid - The DID of the current authenticated user
 * @param authorDid - The DID of the author to unfollow
 * @returns Result with success status
 */
export async function unfollowAuthor(
  agent: Agent,
  userDid: string,
  authorDid: string
): Promise<UnfollowResult> {
  try {
    // Use listRecords to find the follow record directly
    // This is more efficient than iterating through getFollows
    let followUri: string | undefined;
    let recordsCursor: string | undefined;

    do {
      const recordsResponse = await agent.com.atproto.repo.listRecords({
        repo: userDid,
        collection: 'app.bsky.graph.follow',
        limit: 100,
        cursor: recordsCursor,
      });

      const followRecord = recordsResponse.data.records.find(r => {
        const subject = (r.value as { subject?: string })?.subject;
        return subject === authorDid;
      });

      if (followRecord) {
        followUri = followRecord.uri;
        break;
      }

      recordsCursor = recordsResponse.data.cursor;
    } while (recordsCursor);

    if (!followUri) {
      // Not following this user, nothing to do
      return {
        success: true, // No-op is still success
      };
    }

    // Delete the follow record
    await agent.deleteFollow(followUri);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to unfollow author:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unfollow author',
    };
  }
}

/**
 * Toggle follow on an author
 *
 * If following (has followUri), unfollow them.
 * If not following, follow them.
 *
 * @param agent - Authenticated ATProto agent
 * @param authorDid - The DID of the author to follow/unfollow
 * @param currentFollowUri - The current follow URI if following (for unfollow)
 * @returns Result with new follow state and URI
 */
export async function toggleFollow(
  agent: Agent,
  authorDid: string,
  currentFollowUri?: string
): Promise<ToggleFollowResult> {
  try {
    if (currentFollowUri) {
      // Unfollow - delete the follow record
      await agent.deleteFollow(currentFollowUri);
      return {
        success: true,
        isFollowing: false,
        followUri: undefined,
      };
    } else {
      // Follow - create a follow record
      const response = await agent.follow(authorDid);
      return {
        success: true,
        isFollowing: true,
        followUri: response.uri,
      };
    }
  } catch (error) {
    console.error('Failed to toggle follow:', error);
    return {
      success: false,
      isFollowing: !!currentFollowUri,
      followUri: currentFollowUri,
      error: error instanceof Error ? error.message : 'Failed to toggle follow',
    };
  }
}

/**
 * Result from creating an award nomination post
 */
export interface CreateAwardNominationPostResult {
  success: boolean;
  uri?: string;
  cid?: string;
  error?: string;
}

/**
 * Create an award nomination post
 *
 * Creates a Bluesky post with:
 * - Plain text nomination (passed as postText)
 * - Optional quote embed of the user's favorite post
 *
 * @param agent - Authenticated ATProto agent
 * @param quotedPost - The post to quote (null if no quote)
 * @param metrics - Session metrics (used for nomination record)
 * @param postText - The full post text (nomination)
 * @param _image - Unused, kept for interface compat
 * @returns Result with the new post's URI and CID
 */
export async function createAwardNominationPost(
  agent: Agent,
  quotedPost: LikedPost | null,
  metrics: SessionMetrics,
  postText: string,
  _image?: File | null
): Promise<CreateAwardNominationPostResult> {
  try {
    // Create RichText to detect links, mentions, etc.
    const rt = new RichText({ text: postText });
    await rt.detectFacets(agent);

    // Create post with appropriate embed
    let response;

    if (quotedPost) {
      // Quote post: use record embed
      response = await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: quotedPost.uri,
            cid: quotedPost.cid,
          },
        },
      });
    } else {
      // No quote: just text
      response = await agent.post({
        text: rt.text,
        facets: rt.facets,
      });
    }

    // Write nomination record if a "best post" was selected
    if (quotedPost) {
      try {
        // Extract recipient DID from quotedPost.uri (format: at://did:plc:xxx/collection/rkey)
        const recipientDid = quotedPost.uri.split('/')[2];
        const nominationCreatedAt = new Date().toISOString();

        const nominationResult = await agent.com.atproto.repo.createRecord({
          repo: agent.assertDid,
          collection: 'social.jklb.award.nomination',
          record: {
            $type: 'social.jklb.award.nomination',
            subject: quotedPost.uri,
            subjectCid: quotedPost.cid,
            recipient: recipientDid,
            exitPost: response.uri,
            postsViewed: metrics.postsViewed,
            createdAt: nominationCreatedAt,
          },
        });

        // Notify the nominations index worker (fire-and-forget)
        try {
          fetch('https://jklb.social/api/nominations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              awarderDid: agent.assertDid,
              awarderHandle: '',
              recipientDid,
              nominationUri: nominationResult.data.uri,
              subjectUri: quotedPost.uri,
              exitPostUri: response.uri,
              createdAt: nominationCreatedAt,
            }),
          }).catch((err) => {
            console.error('Failed to notify nominations worker:', err);
          });
        } catch (err) {
          console.error('Failed to notify nominations worker:', err);
        }
      } catch (err) {
        console.error('Failed to write nomination record:', err);
        // Don't fail the whole exit — nomination is bonus
      }

      // Silent reply to own post: @mention the winner with claim link
      try {
        const replyText = `@${quotedPost.authorHandle} To claim your award (writes a social.jklb.award record to your PDS) click here: jklb.social/claimAward`;
        const replyRt = new RichText({ text: replyText });
        await replyRt.detectFacets(agent);

        agent.post({
          text: replyRt.text,
          facets: replyRt.facets,
          reply: {
            root: { uri: response.uri, cid: response.cid },
            parent: { uri: response.uri, cid: response.cid },
          },
        }).catch((err) => {
          console.error('Failed to create award claim reply:', err);
        });
      } catch (err) {
        console.error('Failed to create award claim reply:', err);
        // Don't fail the whole exit — reply is bonus
      }
    }

    return {
      success: true,
      uri: response.uri,
      cid: response.cid,
    };
  } catch (error) {
    console.error('Failed to create award nomination post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create award nomination post',
    };
  }
}
