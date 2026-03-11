/**
 * BeginningPostCard - Thin wrapper that fetches a post from a BeginningNotification
 * and renders it using the existing PostCard component.
 *
 * Used for quote posts and replies in the Beginning flow.
 * Registers l/b action handlers via setBeginningActions for centralized keybinding routing.
 * Navigation (j/k) is handled by useKeybindings in App.tsx.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Agent } from '@atproto/api';
import type { BeginningNotification } from '../../hooks/useBeginning';
import type { Post } from '../../types';
import { transformPostView } from '../../lib/feed';
import { toggleLike, toggleRepost, toggleFollow } from '../../lib/actions';
import { buildBskyPostUrl } from '../../lib/post-utils';
import { PostCard } from '../PostCard';
interface BeginningPostCardProps {
  notification: BeginningNotification;
  agent: Agent;
  /** Index within the list (for display like "2 of 5") */
  index: number;
  total: number;
  /** Label for the section header (e.g., "quote post", "reply") */
  sectionLabel: string;
  /** Accent color for outline and header (e.g., var(--memphis-yellow)) */
  accentColor: string;
  /** Register action handlers with parent for centralized keybinding routing */
  setBeginningActions?: (actions: {
    like?: () => void;
    boost?: () => void;
    follow?: () => void;
    viewOnBluesky?: () => void;
    reply?: () => void;
  } | null) => void;
  /** Reply handler — opens composer with the given post */
  onReplyToPost?: (post: Post) => void;
}

export function BeginningPostCard({
  notification,
  agent,
  index,
  total,
  sectionLabel: _sectionLabel,
  accentColor: _accentColor,
  setBeginningActions,
  onReplyToPost,
}: BeginningPostCardProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [parentPost, setParentPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the full post data (and parent for replies) from the notification URI
  useEffect(() => {
    if (!notification.uri) {
      setError('No post URI available');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setParentPost(null);

    const fetchPost = async () => {
      try {
        // Build URI list: always the reply post, plus parent if available
        const uris = [notification.uri!];
        if (notification.reasonSubject) {
          uris.push(notification.reasonSubject);
        }

        const response = await agent.getPosts({ uris });
        if (cancelled) return;

        // Find reply post (matches notification.uri)
        const replyView = response.data.posts.find(p => p.uri === notification.uri);
        if (!replyView) {
          setError('Post not found');
          setIsLoading(false);
          return;
        }
        const transformedReply = transformPostView(replyView as Parameters<typeof transformPostView>[0]);
        setPost(transformedReply);

        // Find parent post (matches notification.reasonSubject)
        if (notification.reasonSubject) {
          const parentView = response.data.posts.find(p => p.uri === notification.reasonSubject);
          if (parentView) {
            const transformedParent = transformPostView(parentView as Parameters<typeof transformPostView>[0]);
            setParentPost(transformedParent);
          }
        }
      } catch (err) {
        console.error(`BeginningPostCard: Failed to fetch post:`, err);
        if (!cancelled) {
          setError('Failed to load post');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPost();
    return () => { cancelled = true; };
  }, [agent, notification.uri, notification.reasonSubject]);

  // Like action (l key)
  const handleLike = useCallback(async () => {
    if (!post) return;

    // Optimistic update
    const prevPost = post;
    setPost(p => p ? { ...p, isLiked: !p.isLiked, likeUri: p.isLiked ? undefined : 'pending' } : p);

    const result = await toggleLike(agent, post);
    if (result.success) {
      setPost(p => p ? { ...p, isLiked: result.isLiked, likeUri: result.likeUri } : p);
    } else {
      // Rollback
      setPost(prevPost);
    }
  }, [agent, post]);

  // Boost action (b key)
  const handleBoost = useCallback(async () => {
    if (!post) return;

    const prevPost = post;
    setPost(p => p ? { ...p, isReposted: !p.isReposted, repostUri: p.isReposted ? undefined : 'pending' } : p);

    const result = await toggleRepost(agent, post);
    if (result.success) {
      setPost(p => p ? { ...p, isReposted: result.isReposted, repostUri: result.repostUri } : p);
    } else {
      setPost(prevPost);
    }
  }, [agent, post]);

  // Follow action (f key)
  const handleFollow = useCallback(async () => {
    if (!post) return;

    const prevPost = post;
    const wasFollowing = post.author.isFollowing;
    setPost(p => p ? { ...p, author: { ...p.author, isFollowing: !wasFollowing } } : p);

    const result = await toggleFollow(agent, post.author.did, wasFollowing ? post.author.followUri : undefined);
    if (result.success) {
      setPost(p => p ? { ...p, author: { ...p.author, isFollowing: result.isFollowing, followUri: result.followUri } } : p);
    } else {
      setPost(prevPost);
    }
  }, [agent, post]);

  // View on Bluesky action (v key)
  const handleViewOnBluesky = useCallback(() => {
    if (!post) return;
    const url = buildBskyPostUrl(post.author.handle, post.uri);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [post]);

  // Reply action (r key)
  const handleReply = useCallback(() => {
    if (!post || !onReplyToPost) return;
    onReplyToPost(post);
  }, [post, onReplyToPost]);

  // Register action handlers with parent for centralized keybinding routing
  useEffect(() => {
    setBeginningActions?.({ like: handleLike, boost: handleBoost, follow: handleFollow, viewOnBluesky: handleViewOnBluesky, reply: handleReply });
    return () => setBeginningActions?.(null);
  }, [handleLike, handleBoost, handleFollow, handleViewOnBluesky, handleReply, setBeginningActions]);

  if (isLoading) {
    return (
      <div className="flex flex-col w-full">
        {total > 1 && (
          <p className="text-xs text-[var(--memphis-text-muted)] text-center mb-2">
            {index + 1} of {total}
          </p>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[var(--memphis-text-muted)] text-sm italic">loading post...</div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col w-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[var(--memphis-text-muted)] text-sm">{error || 'Post unavailable'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {total > 1 && (
        <p className="text-xs text-[var(--memphis-text-muted)] text-center mb-2">
          {index + 1} of {total}
        </p>
      )}

      {/* Parent post (yours) — small, read-only context */}
      {parentPost && notification.type === 'reply' && (
        <div className="border-b border-white/10">
          <PostCard
            post={parentPost}
            size="sm"
            isFocused={false}
            hideActions
          />
        </div>
      )}

      {/* Reply/quote/mention post (theirs) — actionable */}
      <PostCard
        post={post}
        isFocused={true}
        onLike={handleLike}
        onBoost={handleBoost}
        onFollow={handleFollow}
        onReply={handleReply}
      />
    </div>
  );
}
