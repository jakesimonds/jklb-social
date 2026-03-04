// usePostActions hook - React hook for post action handlers
// Encapsulates like, boost, reply, quote, post, unfollow, and composer submit logic

import { useState, useCallback } from 'react';
import type { Agent } from '@atproto/api';
import type { Post, FeedItem } from '../types';
import { isPostFeedItem } from '../types';
import type { PanelView } from '../types';
import { toggleLike, toggleRepost, toggleFollow, createReply, createQuotePost, unfollowAuthor } from '../lib/actions';
import {
  trackLike,
  trackUnlike,
  trackRepost,
  trackUnrepost,
  trackReply,
  trackUnfollow,
  addLikedPost,
  removeLikedPost,
} from '../lib/session';
import { useToast } from '../lib/ToastContext';

/**
 * Focus target indicates which part of the post UI is focused
 * 'main' = the main post, 'quote' = the quoted post within
 */
export type FocusTarget = 'main' | 'quote';

/**
 * Parameters for the usePostActions hook
 */
export interface UsePostActionsParams {
  agent: Agent | null;
  session: { did: string } | null;
  focusTarget: FocusTarget;
  currentPost: Post | null;
  isInThreadView: boolean;
  threadPosts: Post[];
  threadIndex: number;
  // Callbacks for state updates that live in App.tsx
  setFeedItems: React.Dispatch<React.SetStateAction<FeedItem[]>>;
  setThreadPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  setShowLoginPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  openPanel: (panel: PanelView) => void;
  closePanel: () => void;
}

/**
 * Return type for the usePostActions hook
 */
export interface UsePostActionsReturn {
  // Action handlers
  handleLike: () => Promise<void>;
  handleBoost: () => Promise<void>;
  handleReply: () => void;
  handleQuote: () => void;
  handleUnfollow: () => Promise<void>;
  handleFollow: () => Promise<void>;
  handleSubmitComposer: (text: string, mode?: 'reply' | 'quote') => Promise<void>;
  // Composer state (managed by hook)
  composerTarget: Post | null;
  setComposerTarget: React.Dispatch<React.SetStateAction<Post | null>>;
  isSubmittingComposer: boolean;
}

/**
 * Helper to get the target post based on focus and thread state
 * Index maps directly to posts in scroll thread view
 */
function getTargetPost(
  focusTarget: FocusTarget,
  currentPost: Post | null,
  isInThreadView: boolean,
  threadPosts: Post[],
  threadIndex: number
): Post | null {
  // In thread view, operate on the focused thread post
  if (isInThreadView && threadPosts.length > 0) {
    return threadPosts[threadIndex] ?? null;
  }
  // Determine which post based on focus target
  if (focusTarget === 'main') {
    return currentPost;
  }
  if (focusTarget === 'quote') {
    // Quoted post - construct a Post from QuotedPost
    const quotedPost = currentPost?.embed?.record;
    if (quotedPost) {
      return {
        uri: quotedPost.uri,
        cid: quotedPost.cid,
        author: quotedPost.author,
        text: quotedPost.text,
        indexedAt: quotedPost.indexedAt,
        isLiked: false,
        isReposted: false,
      };
    }
  }
  return null;
}

/**
 * Custom hook for managing post action handlers
 *
 * This hook encapsulates:
 * - Like/unlike functionality with optimistic updates
 * - Boost/repost functionality with optimistic updates
 * - Reply, quote, and new post composer opening
 * - Composer submit logic (reply, quote, new post)
 * - Unfollow functionality
 * - Composer state (target post, submitting state)
 *
 * @param params - Dependencies from the parent component
 * @returns Action handlers and composer state
 */
export function usePostActions({
  agent,
  session,
  focusTarget,
  currentPost,
  isInThreadView,
  threadPosts,
  threadIndex,
  setFeedItems,
  setThreadPosts,
  setShowLoginPrompt,
  openPanel,
  closePanel,
}: UsePostActionsParams): UsePostActionsReturn {
  // Composer state
  const [composerTarget, setComposerTarget] = useState<Post | null>(null);
  const [isSubmittingComposer, setIsSubmittingComposer] = useState(false);

  // Toast notifications from context
  const { showError, showSuccess } = useToast();

  /**
   * Handle like/unlike for the focused content
   * - In thread view: like the focused thread post
   * - focusTarget 'main': like the main post
   * - focusTarget 'quote': like the quoted post
   */
  const handleLike = useCallback(async () => {
    if (!agent) {
      setShowLoginPrompt(true);
      return;
    }

    const targetPost = getTargetPost(focusTarget, currentPost, isInThreadView, threadPosts, threadIndex);
    if (!targetPost) return;

    // Store original state for rollback
    const originalIsLiked = targetPost.isLiked;
    const originalLikeUri = targetPost.likeUri;

    // Optimistic UI update helper
    const updatePostState = (isLiked: boolean, likeUri?: string) => {
      // In thread view, update the thread posts array
      if (isInThreadView && threadPosts.length > 0) {
        setThreadPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.uri === targetPost.uri ? { ...p, isLiked, likeUri } : p
          )
        );
        // Also update main feed items if the post exists there
        setFeedItems((prevItems) =>
          prevItems.map((item) =>
            isPostFeedItem(item) && item.uri === targetPost.uri
              ? { ...item, post: { ...item.post, isLiked, likeUri } }
              : item
          )
        );
      } else if (focusTarget === 'main' && currentPost) {
        setFeedItems((prevItems) =>
          prevItems.map((item) =>
            isPostFeedItem(item) && item.uri === currentPost.uri
              ? { ...item, post: { ...item.post, isLiked, likeUri } }
              : item
          )
        );
      }
      // Note: Quoted posts don't have persistent like state in our data model
    };

    // Apply optimistic update
    updatePostState(!originalIsLiked, originalIsLiked ? undefined : 'pending');

    // Call API
    const result = await toggleLike(agent, targetPost);

    if (!result.success) {
      // Revert on failure
      updatePostState(originalIsLiked, originalLikeUri);
      console.error('Failed to toggle like:', result.error);
    } else {
      // Update with actual like URI from API
      updatePostState(result.isLiked, result.likeUri);
      // Track the action in session metrics and liked posts list
      if (result.isLiked) {
        trackLike();
        // Add to liked posts for award nomination feature
        addLikedPost(targetPost);
      } else {
        trackUnlike();
        // Remove from liked posts when unliked
        removeLikedPost(targetPost.uri);
      }
    }
  }, [agent, focusTarget, currentPost, isInThreadView, threadPosts, threadIndex, setFeedItems, setThreadPosts, setShowLoginPrompt]);

  /**
   * Handle boost/repost for the focused content
   * - In thread view: repost the focused thread post
   * - focusTarget 'main': repost the main post
   * - focusTarget 'quote': repost the quoted post
   */
  const handleBoost = useCallback(async () => {
    if (!agent) {
      setShowLoginPrompt(true);
      return;
    }

    const targetPost = getTargetPost(focusTarget, currentPost, isInThreadView, threadPosts, threadIndex);
    if (!targetPost) return;

    // Store original state for rollback
    const originalIsReposted = targetPost.isReposted;
    const originalRepostUri = targetPost.repostUri;

    // Optimistic UI update helper
    const updatePostState = (isReposted: boolean, repostUri?: string) => {
      // In thread view, update the thread posts array
      if (isInThreadView && threadPosts.length > 0) {
        setThreadPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.uri === targetPost.uri ? { ...p, isReposted, repostUri } : p
          )
        );
        // Also update main feed items if the post exists there
        setFeedItems((prevItems) =>
          prevItems.map((item) =>
            isPostFeedItem(item) && item.uri === targetPost.uri
              ? { ...item, post: { ...item.post, isReposted, repostUri } }
              : item
          )
        );
      } else if (focusTarget === 'main' && currentPost) {
        setFeedItems((prevItems) =>
          prevItems.map((item) =>
            isPostFeedItem(item) && item.uri === currentPost.uri
              ? { ...item, post: { ...item.post, isReposted, repostUri } }
              : item
          )
        );
      }
      // Note: Quoted posts don't have persistent repost state in our data model
    };

    // Apply optimistic update
    updatePostState(!originalIsReposted, originalIsReposted ? undefined : 'pending');

    // Call API
    const result = await toggleRepost(agent, targetPost);

    if (!result.success) {
      // Revert on failure
      updatePostState(originalIsReposted, originalRepostUri);
      console.error('Failed to toggle repost:', result.error);
    } else {
      // Update with actual repost URI from API
      updatePostState(result.isReposted, result.repostUri);
      // Track the action in session metrics
      if (result.isReposted) {
        trackRepost();
      } else {
        trackUnrepost();
      }
    }
  }, [agent, focusTarget, currentPost, isInThreadView, threadPosts, threadIndex, setFeedItems, setThreadPosts, setShowLoginPrompt]);

  /**
   * Handle reply button press ('r' key)
   * Opens the reply composer for the focused content
   */
  const handleReply = useCallback(() => {
    if (!agent) {
      setShowLoginPrompt(true);
      return;
    }

    const targetPost = getTargetPost(focusTarget, currentPost, isInThreadView, threadPosts, threadIndex);
    if (!targetPost) return;

    // Open reply composer via ContentPanel
    setComposerTarget(targetPost);
    openPanel({ type: 'composer-reply', targetUri: targetPost.uri });
  }, [agent, focusTarget, currentPost, isInThreadView, threadPosts, threadIndex, setShowLoginPrompt, openPanel]);

  /**
   * Handle quote button press ('q' key)
   * Opens the quote composer for the focused content
   */
  const handleQuote = useCallback(() => {
    if (!agent) {
      setShowLoginPrompt(true);
      return;
    }

    const targetPost = getTargetPost(focusTarget, currentPost, isInThreadView, threadPosts, threadIndex);
    if (!targetPost) return;

    // Open quote composer via ContentPanel
    setComposerTarget(targetPost);
    openPanel({ type: 'composer-quote', targetUri: targetPost.uri });
  }, [agent, focusTarget, currentPost, isInThreadView, threadPosts, threadIndex, setShowLoginPrompt, openPanel]);

  /**
   * Handle unfollow button press ('u' key)
   * Unfollows the author of the focused content
   */
  const handleUnfollow = useCallback(async () => {
    if (!agent || !session?.did) {
      setShowLoginPrompt(true);
      return;
    }

    let authorDid: string | undefined;
    let authorHandle: string | undefined;

    // Determine which author to unfollow based on focus target
    if (focusTarget === 'main') {
      authorDid = currentPost?.author.did;
      authorHandle = currentPost?.author.handle;
    } else if (focusTarget === 'quote') {
      const quotedPost = currentPost?.embed?.record;
      if (quotedPost) {
        authorDid = quotedPost.author.did;
        authorHandle = quotedPost.author.handle;
      }
    }

    if (!authorDid) return;

    // Call API to unfollow
    const result = await unfollowAuthor(agent, session.did, authorDid);

    if (result.success) {
      showSuccess(`Unfollowed @${authorHandle || authorDid}`);
      trackUnfollow();
    } else {
      showError(`Failed to unfollow: ${result.error || 'Unknown error'}`);
      console.error('Failed to unfollow:', result.error);
    }
  }, [agent, session, focusTarget, currentPost, setShowLoginPrompt, showSuccess, showError]);

  /**
   * Handle follow/unfollow button press ('f' key)
   * Toggles follow state on the author of the focused content
   */
  const handleFollow = useCallback(async () => {
    if (!agent) {
      setShowLoginPrompt(true);
      return;
    }

    const targetPost = getTargetPost(focusTarget, currentPost, isInThreadView, threadPosts, threadIndex);
    if (!targetPost) return;

    const authorDid = targetPost.author.did;
    const authorHandle = targetPost.author.handle;
    const originalIsFollowing = targetPost.author.isFollowing ?? false;
    const originalFollowUri = targetPost.author.followUri;

    // Optimistic UI update helper
    const updateAuthorFollowState = (isFollowing: boolean, followUri?: string) => {
      // In thread view, update the thread posts array
      if (isInThreadView && threadPosts.length > 0) {
        setThreadPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.author.did === authorDid
              ? { ...p, author: { ...p.author, isFollowing, followUri } }
              : p
          )
        );
      }
      // Update main feed items for all posts by this author
      setFeedItems((prevItems) =>
        prevItems.map((item) =>
          isPostFeedItem(item) && item.post.author.did === authorDid
            ? { ...item, post: { ...item.post, author: { ...item.post.author, isFollowing, followUri } } }
            : item
        )
      );
    };

    // Apply optimistic update
    updateAuthorFollowState(!originalIsFollowing, originalIsFollowing ? undefined : 'pending');

    // Call API
    const result = await toggleFollow(agent, authorDid, originalFollowUri);

    if (!result.success) {
      // Revert on failure
      updateAuthorFollowState(originalIsFollowing, originalFollowUri);
      showError(`Failed to ${originalIsFollowing ? 'unfollow' : 'follow'}: ${result.error || 'Unknown error'}`);
      console.error('Failed to toggle follow:', result.error);
    } else {
      // Update with actual follow URI from API
      updateAuthorFollowState(result.isFollowing, result.followUri);
      if (result.isFollowing) {
        showSuccess(`Followed @${authorHandle}`);
      } else {
        showSuccess(`Unfollowed @${authorHandle}`);
        trackUnfollow();
      }
    }
  }, [agent, focusTarget, currentPost, isInThreadView, threadPosts, threadIndex, setFeedItems, setThreadPosts, setShowLoginPrompt, showSuccess, showError]);

  /**
   * Submit composer content (reply, quote, or new post) to the API.
   * Uses composerTarget to infer mode: null = compose, non-null = reply or quote.
   */
  const handleSubmitComposer = useCallback(async (text: string, mode?: 'reply' | 'quote') => {
    if (!agent) return;

    setIsSubmittingComposer(true);

    let result: { success: boolean; error?: string };

    // Infer mode from composerTarget if not explicitly provided
    const effectiveMode = mode || 'reply';

    if (effectiveMode === 'reply' && composerTarget) {
      result = await createReply(agent, composerTarget, text);
      if (result.success) {
        trackReply();
      }
    } else if (effectiveMode === 'quote' && composerTarget) {
      result = await createQuotePost(agent, composerTarget, text);
    } else {
      result = { success: false, error: 'Invalid composer mode' };
    }

    setIsSubmittingComposer(false);

    if (result.success) {
      // Close the composer on success
      setComposerTarget(null);
      closePanel();
    } else {
      console.error('Failed to submit:', result.error);
    }
  }, [agent, composerTarget, closePanel]);

  return {
    // Action handlers
    handleLike,
    handleBoost,
    handleReply,
    handleQuote,
    handleUnfollow,
    handleFollow,
    handleSubmitComposer,
    // Composer state
    composerTarget,
    setComposerTarget,
    isSubmittingComposer,
  };
}
