/**
 * NotificationHover - Context-aware hover card for notifications
 *
 * Shows different content based on notification type:
 *
 * - follow: Shows the PROFILE of the person who followed (same as ProfileHover)
 * - like/repost: Shows the POST that was liked/reposted
 * - quote/reply/mention: Shows the POST that was quoted/replied to/mentioned in
 *
 * The key insight: for engagement notifications (like, repost, quote, reply, mention),
 * users want to see WHAT was acted upon, not just WHO did it.
 *
 * Uses the notification's reasonSubject (AT URI) to fetch and display the relevant post.
 */

import React, { useState, useEffect } from 'react';
import type { Agent } from '@atproto/api';
import { ProfileHover, PROFILE_HOVER_WIDTH } from './ProfileHover';
import type { ProfileHoverData } from './ProfileHover';

/** Notification types that show post content */
type PostNotificationType = 'like' | 'repost' | 'quote' | 'reply' | 'mention';

/** Notification types that show profile content */
type ProfileNotificationType = 'follow';

/** All notification types */
export type NotificationType = PostNotificationType | ProfileNotificationType;

/** Data needed to display the hover for a notification */
export interface NotificationHoverData {
  type: NotificationType;
  /** The actor who triggered the notification */
  actor: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  /** AT URI of the subject post (for like/repost/quote/reply/mention) */
  reasonSubject?: string;
}

/** Props for the NotificationHover component */
export interface NotificationHoverProps {
  notification: NotificationHoverData;
  /** Agent for fetching post data */
  agent: Agent | null;
  isVisible: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/** Post preview data */
interface PostPreview {
  uri: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  indexedAt: string;
}

/** Card dimensions for positioning calculations */
export const NOTIFICATION_HOVER_WIDTH = PROFILE_HOVER_WIDTH;
export const NOTIFICATION_HOVER_HEIGHT = 220;

/**
 * Get a verb describing the notification action
 */
function getActionVerb(type: NotificationType): string {
  switch (type) {
    case 'like': return 'liked';
    case 'repost': return 'boosted';
    case 'quote': return 'quoted';
    case 'reply': return 'replied to';
    case 'mention': return 'mentioned you in';
    case 'follow': return 'followed you';
    default: return '';
  }
}

/**
 * Get color class for the notification type
 */
function getTypeColorClass(type: NotificationType): string {
  switch (type) {
    case 'like': return 'text-[var(--memphis-pink)]';
    case 'repost': return 'text-[var(--memphis-yellow)]';
    case 'follow': return 'text-[var(--memphis-cyan)]';
    case 'mention': return 'text-white';
    case 'quote': return 'text-[#ff9800]';
    case 'reply': return 'text-[#4caf50]';
    default: return 'text-white';
  }
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

/**
 * NotificationHover component
 *
 * Shows context-appropriate hover card:
 * - Follow notifications: ProfileHover (who followed you)
 * - All other notifications: Post preview (what was acted upon)
 */
export function NotificationHover({
  notification,
  agent,
  isVisible,
  style,
  className = '',
}: NotificationHoverProps) {
  const [postPreview, setPostPreview] = useState<PostPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { type, actor, reasonSubject } = notification;
  const isFollowNotification = type === 'follow';

  // Fetch post data for non-follow notifications
  useEffect(() => {
    if (!isVisible || isFollowNotification || !reasonSubject || !agent) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchPost = async () => {
      try {
        const response = await agent.getPostThread({ uri: reasonSubject, depth: 0 });

        if (cancelled) return;

        // Extract post from thread response
        const thread = response.data.thread;
        if (thread.$type === 'app.bsky.feed.defs#threadViewPost' && 'post' in thread) {
          const threadView = thread as { post: { uri: string; author: { handle: string; displayName?: string; avatar?: string }; record: unknown; indexedAt: string } };
          const post = threadView.post;
          const record = post.record as { text?: string };
          setPostPreview({
            uri: post.uri,
            author: {
              handle: post.author.handle,
              displayName: post.author.displayName,
              avatar: post.author.avatar,
            },
            text: record.text || '',
            indexedAt: post.indexedAt,
          });
        } else {
          // Thread not found or blocked
          setError('Post not available');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch post for notification hover:', err);
          setError('Could not load post');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPost();

    return () => {
      cancelled = true;
    };
  }, [isVisible, isFollowNotification, reasonSubject, agent]);

  if (!isVisible) return null;

  // For follow notifications, delegate to ProfileHover
  if (isFollowNotification) {
    const profileData: ProfileHoverData = {
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName,
      avatar: actor.avatar,
    };
    return (
      <ProfileHover
        profile={profileData}
        isVisible={isVisible}
        style={style}
        className={className}
      />
    );
  }

  // For post-related notifications, show post preview
  return (
    <div
      className={`
        absolute z-50
        bg-[var(--memphis-navy)] border-2 border-[var(--memphis-cyan)]
        rounded-xl p-4 shadow-lg
        min-w-[300px] max-w-[400px] max-h-[400px] overflow-y-auto
        animate-fade-in
        ${className}
      `}
      style={style}
      role="tooltip"
      aria-label={`${actor.displayName || actor.handle} ${getActionVerb(type)} your post`}
    >
      {/* Action header: who did what */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
        {/* Actor avatar (small) */}
        {actor.avatar ? (
          <img
            src={actor.avatar}
            alt=""
            className="w-8 h-8 rounded-full border border-[var(--memphis-pink)]"
          />
        ) : (
          <div className="w-8 h-8 rounded-full border border-[var(--memphis-pink)] bg-[var(--memphis-cyan)] flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {actor.handle.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Action text */}
        <p className="text-sm flex-1">
          <span className="font-medium text-white">
            {actor.displayName || `@${actor.handle}`}
          </span>
          <span className={`ml-1 ${getTypeColorClass(type)}`}>
            {getActionVerb(type)}
          </span>
        </p>
      </div>

      {/* Post preview content */}
      <div className="space-y-2">
        {loading && (
          <p className="text-sm text-white/50 italic">Loading post...</p>
        )}

        {error && (
          <p className="text-sm text-white/50 italic">{error}</p>
        )}

        {postPreview && !loading && (
          <>
            {/* Post author (your post) */}
            <div className="flex items-center gap-2">
              {postPreview.author.avatar ? (
                <img
                  src={postPreview.author.avatar}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[var(--memphis-cyan)] flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {postPreview.author.handle.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-xs text-white/70">
                {postPreview.author.displayName || `@${postPreview.author.handle}`}
              </span>
              <span className="text-xs text-white/40">
                · {formatTime(postPreview.indexedAt)}
              </span>
            </div>

            {/* Post text (truncated) */}
            {postPreview.text && (
              <p className="text-sm text-white/90 leading-relaxed line-clamp-4">
                {postPreview.text}
              </p>
            )}

            {/* Link to view full post */}
            <a
              href={`https://bsky.app/profile/${postPreview.author.handle}/post/${postPreview.uri.split('/').pop()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-[var(--memphis-cyan)] hover:text-[var(--memphis-pink)] transition-colors"
            >
              View post →
            </a>
          </>
        )}
      </div>
    </div>
  );
}
