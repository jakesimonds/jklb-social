// useThread hook - React hook for thread view state management
// Encapsulates thread state, navigation, and enter/exit logic
// Thread view always uses ScrollThread (vertical list)

import { useState, useCallback } from 'react';
import type { Agent } from '@atproto/api';
import type { Post } from '../types';
import { fetchThreadContextCached } from '../lib/thread';
// Note: trackPostViewed is NOT imported here
// Thread navigation (arrow keys within a thread) should NOT count toward "posts viewed"
// Only j/k feed navigation counts (handled in useFeed hook)

/**
 * Parameters for the useThread hook
 */
export interface UseThreadParams {
  agent: Agent | null;
}

/**
 * Return type for the useThread hook
 */
export interface UseThreadReturn {
  // State
  isInThreadView: boolean;
  threadPosts: Post[];
  threadDepths: number[];
  threadIndex: number;
  /** The index of the original post that was used to enter thread view */
  originalPostIndex: number;

  // Actions
  enterThreadView: (post: Post) => Promise<void>;
  exitThreadView: () => void;
  navigateThread: (newIndex: number) => void;
  handleThreadNavigate: (direction: -1 | 1) => void;

  // For usePostActions (optimistic updates)
  setThreadPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}

/**
 * Custom hook for managing thread view state and navigation
 *
 * This hook encapsulates:
 * - Thread state (isInThreadView, threadPosts, threadDepths, threadIndex)
 * - Enter/exit thread view logic
 * - Navigation within thread (up/down for Scroll)
 *
 * @param params - Dependencies from the parent component
 * @returns Thread state and actions
 */
export function useThread({ agent }: UseThreadParams): UseThreadReturn {
  // Thread state
  const [isInThreadView, setIsInThreadView] = useState(false);
  const [threadPosts, setThreadPosts] = useState<Post[]>([]);
  const [threadDepths, setThreadDepths] = useState<number[]>([]);
  const [threadIndex, setThreadIndex] = useState(0);
  const [originalPostIndex, setOriginalPostIndex] = useState(0);

  /**
   * Exit thread view and return to single-post mode
   */
  const exitThreadView = useCallback(() => {
    setIsInThreadView(false);
    setThreadPosts([]);
    setThreadDepths([]);
    setThreadIndex(0);
  }, []);

  /**
   * Enter thread view for a post that's part of a thread
   * Works both authenticated (with agent) and unauthenticated (using public API)
   */
  const enterThreadView = useCallback(async (post: Post) => {
    // Fetch thread context - works with or without agent (uses public API if null)
    const thread = await fetchThreadContextCached(agent, post);

    // Enter thread view for any post (even single posts)
    if (thread.length >= 1) {
      const posts = thread.map(tp => tp.post);
      const depths = thread.map(tp => tp.depth);
      setThreadPosts(posts);
      setThreadDepths(depths);

      // Find the index of the current post in the thread
      const postIndex = posts.findIndex(p => p.uri === post.uri);

      // Scroll: No hero card, index maps directly
      setThreadIndex(postIndex >= 0 ? postIndex : 0);

      setOriginalPostIndex(postIndex >= 0 ? postIndex : 0);
      setIsInThreadView(true);
    }
  }, [agent]);

  /**
   * Navigate within thread
   * Note: Does NOT track post viewed - thread navigation is within already-viewed content
   */
  const navigateThread = useCallback((newIndex: number) => {
    if (newIndex >= 0 && newIndex < threadPosts.length) {
      setThreadIndex(newIndex);
    }
  }, [threadPosts.length]);

  /**
   * Handle directional navigation in thread view
   * direction: -1 for previous, 1 for next
   * Note: Does NOT track post viewed - thread navigation is within already-viewed content
   */
  const handleThreadNavigate = useCallback((direction: -1 | 1) => {
    const newIndex = threadIndex + direction;
    if (newIndex >= 0 && newIndex < threadPosts.length) {
      setThreadIndex(newIndex);
    }
  }, [threadIndex, threadPosts.length]);

  return {
    // State
    isInThreadView,
    threadPosts,
    threadDepths,
    threadIndex,
    originalPostIndex,

    // Actions
    enterThreadView,
    exitThreadView,
    navigateThread,
    handleThreadNavigate,

    // For optimistic updates
    setThreadPosts,
  };
}
