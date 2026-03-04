// Session management utilities for russAbbot
// Handles session lifecycle, metrics tracking, and persistence

import type { Session, SessionMetrics, LikedPost, Post } from '../types';
import {
  saveCurrentSession,
  loadCurrentSession,
  clearCurrentSession,
  addSession,
} from './storage';

/**
 * Create default empty metrics
 */
export function createDefaultMetrics(): SessionMetrics {
  return {
    postsViewed: 0,
    likes: 0,
    unlikes: 0,
    reposts: 0,
    unreposts: 0,
    replies: 0,
    linksOpened: 0,
    unfollows: 0,
  };
}

/**
 * Create a new session with a unique ID and current timestamp
 */
export function createSession(): Session {
  return {
    id: crypto.randomUUID(),
    startTime: new Date().toISOString(),
    metrics: createDefaultMetrics(),
  };
}

/**
 * Start a new session
 * Creates and persists a new session to localStorage
 */
export function startSession(): Session {
  const session = createSession();
  saveCurrentSession(session);
  return session;
}

/**
 * Get the current active session
 * Returns null if no session is active
 */
export function getCurrentSession(): Session | null {
  return loadCurrentSession();
}

/**
 * Update the current session with new data
 * Persists changes to localStorage
 */
export function updateCurrentSession(updates: Partial<Session>): Session | null {
  const current = loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    ...updates,
    // Merge metrics if provided
    metrics: updates.metrics
      ? { ...current.metrics, ...updates.metrics }
      : current.metrics,
  };

  saveCurrentSession(updated);
  return updated;
}

/**
 * Increment a specific metric in the current session
 */
export function incrementMetric(metric: keyof SessionMetrics): Session | null {
  const current = loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    metrics: {
      ...current.metrics,
      [metric]: current.metrics[metric] + 1,
    },
  };

  saveCurrentSession(updated);
  return updated;
}

/**
 * Convenience functions for incrementing specific metrics
 */
export function trackPostViewed(): Session | null {
  return incrementMetric('postsViewed');
}

export function untrackPostViewed(): Session | null {
  const current = loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    metrics: {
      ...current.metrics,
      postsViewed: Math.max(0, current.metrics.postsViewed - 1),
    },
  };

  saveCurrentSession(updated);
  return updated;
}

export function trackLike(): Session | null {
  return incrementMetric('likes');
}

export function trackUnlike(): Session | null {
  return incrementMetric('unlikes');
}

export function trackRepost(): Session | null {
  return incrementMetric('reposts');
}

export function trackUnrepost(): Session | null {
  return incrementMetric('unreposts');
}

export function trackReply(): Session | null {
  return incrementMetric('replies');
}

export function trackLinkOpened(): Session | null {
  return incrementMetric('linksOpened');
}

export function trackUnfollow(): Session | null {
  return incrementMetric('unfollows');
}

/**
 * Reset postsViewed counter to 0
 * Used when award nomination is toggled ON - counter starts fresh from opt-in moment
 */
export function resetPostsViewed(): Session | null {
  const current = loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    metrics: {
      ...current.metrics,
      postsViewed: 0,
    },
  };

  saveCurrentSession(updated);
  return updated;
}

/**
 * Add a liked post to the current session
 * Stores minimal data: uri, cid, author name/handle, first 100 chars of text
 * Used by award nomination to let user pick their favorite post from the session
 */
export function addLikedPost(post: Post): Session | null {
  const current = loadCurrentSession();
  if (!current) return null;

  const likedPost: LikedPost = {
    uri: post.uri,
    cid: post.cid,
    authorDisplayName: post.author.displayName || post.author.handle,
    authorHandle: post.author.handle,
    textPreview: post.text.slice(0, 100),
    likedAt: new Date().toISOString(),
  };

  const updated: Session = {
    ...current,
    likedPosts: [...(current.likedPosts || []), likedPost],
  };

  saveCurrentSession(updated);
  return updated;
}

/**
 * Remove a post from the liked posts list (when user unlikes)
 * Matches by URI since that's unique per post
 */
export function removeLikedPost(postUri: string): Session | null {
  const current = loadCurrentSession();
  if (!current || !current.likedPosts) return null;

  const updated: Session = {
    ...current,
    likedPosts: current.likedPosts.filter(p => p.uri !== postUri),
  };

  saveCurrentSession(updated);
  return updated;
}

/**
 * End the current session
 * Sets endTime, moves to session history, clears current session
 */
export function endSession(): Session | null {
  const current = loadCurrentSession();
  if (!current) return null;

  const ended: Session = {
    ...current,
    endTime: new Date().toISOString(),
  };

  // Add to history
  addSession(ended);

  // Clear current session
  clearCurrentSession();

  return ended;
}

/**
 * Save session on page unload handler
 * Called by beforeunload event to persist session before user leaves
 */
function handleBeforeUnload(): void {
  endSession();
}

/**
 * Set up session save on page unload
 * Attaches a beforeunload event listener that saves the current session
 * Returns a cleanup function to remove the listener
 */
export function setupSessionSaveOnUnload(): () => void {
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return cleanup function
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
