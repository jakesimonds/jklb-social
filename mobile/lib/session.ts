// Session management utilities for russAbbot mobile
// Adapted from src/lib/session.ts
// Changes: All storage functions are now async (AsyncStorage)
// Removed: setupSessionSaveOnUnload (no window/beforeunload in React Native)
// Removed: crypto.randomUUID (use Math.random UUID generator instead)

import type { Session, SessionMetrics, LikedPost, Post } from './types';
import {
  saveCurrentSession,
  loadCurrentSession,
  clearCurrentSession,
  addSession,
} from './storage';

/**
 * Generate a UUID v4 (React Native compatible)
 * crypto.randomUUID() is not available in all RN environments
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
    id: generateUUID(),
    startTime: new Date().toISOString(),
    metrics: createDefaultMetrics(),
  };
}

/**
 * Start a new session
 * Creates and persists a new session to AsyncStorage
 */
export async function startSession(): Promise<Session> {
  const session = createSession();
  await saveCurrentSession(session);
  return session;
}

/**
 * Get the current active session
 * Returns null if no session is active
 */
export async function getCurrentSession(): Promise<Session | null> {
  return loadCurrentSession();
}

/**
 * Update the current session with new data
 * Persists changes to AsyncStorage
 */
export async function updateCurrentSession(updates: Partial<Session>): Promise<Session | null> {
  const current = await loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    ...updates,
    // Merge metrics if provided
    metrics: updates.metrics
      ? { ...current.metrics, ...updates.metrics }
      : current.metrics,
  };

  await saveCurrentSession(updated);
  return updated;
}

/**
 * Increment a specific metric in the current session
 */
export async function incrementMetric(metric: keyof SessionMetrics): Promise<Session | null> {
  const current = await loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    metrics: {
      ...current.metrics,
      [metric]: current.metrics[metric] + 1,
    },
  };

  await saveCurrentSession(updated);
  return updated;
}

/**
 * Convenience functions for incrementing specific metrics
 */
export async function trackPostViewed(): Promise<Session | null> {
  return incrementMetric('postsViewed');
}

export async function untrackPostViewed(): Promise<Session | null> {
  const current = await loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    metrics: {
      ...current.metrics,
      postsViewed: Math.max(0, current.metrics.postsViewed - 1),
    },
  };

  await saveCurrentSession(updated);
  return updated;
}

export async function trackLike(): Promise<Session | null> {
  return incrementMetric('likes');
}

export async function trackUnlike(): Promise<Session | null> {
  return incrementMetric('unlikes');
}

export async function trackRepost(): Promise<Session | null> {
  return incrementMetric('reposts');
}

export async function trackUnrepost(): Promise<Session | null> {
  return incrementMetric('unreposts');
}

export async function trackReply(): Promise<Session | null> {
  return incrementMetric('replies');
}

export async function trackLinkOpened(): Promise<Session | null> {
  return incrementMetric('linksOpened');
}

export async function trackUnfollow(): Promise<Session | null> {
  return incrementMetric('unfollows');
}

/**
 * Reset postsViewed counter to 0
 * Used when credible exit is toggled ON - counter starts fresh from opt-in moment
 */
export async function resetPostsViewed(): Promise<Session | null> {
  const current = await loadCurrentSession();
  if (!current) return null;

  const updated: Session = {
    ...current,
    metrics: {
      ...current.metrics,
      postsViewed: 0,
    },
  };

  await saveCurrentSession(updated);
  return updated;
}

/**
 * Add a liked post to the current session
 * Stores minimal data: uri, cid, author name/handle, first 100 chars of text
 * Used by credible exit to let user pick their favorite post from the session
 */
export async function addLikedPost(post: Post): Promise<Session | null> {
  const current = await loadCurrentSession();
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

  await saveCurrentSession(updated);
  return updated;
}

/**
 * Remove a post from the liked posts list (when user unlikes)
 * Matches by URI since that's unique per post
 */
export async function removeLikedPost(postUri: string): Promise<Session | null> {
  const current = await loadCurrentSession();
  if (!current || !current.likedPosts) return null;

  const updated: Session = {
    ...current,
    likedPosts: current.likedPosts.filter(p => p.uri !== postUri),
  };

  await saveCurrentSession(updated);
  return updated;
}

/**
 * End the current session
 * Sets endTime, moves to session history, clears current session
 */
export async function endSession(): Promise<Session | null> {
  const current = await loadCurrentSession();
  if (!current) return null;

  const ended: Session = {
    ...current,
    endTime: new Date().toISOString(),
  };

  // Add to history
  await addSession(ended);

  // Clear current session
  await clearCurrentSession();

  return ended;
}
