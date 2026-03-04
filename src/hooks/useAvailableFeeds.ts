// Hook for fetching the user's saved/pinned feeds from Bluesky preferences
// Loads from cache instantly, then refreshes in background on login

import { useState, useEffect } from 'react';
import type { Agent } from '@atproto/api';
import {
  fetchUserSavedFeeds,
  loadCachedFeeds,
  saveCachedFeeds,
  getFallbackFeeds,
  type ResolvedFeed,
} from '../lib/saved-feeds';

export interface UseAvailableFeedsParams {
  agent: Agent | null;
  isAuthenticated: boolean;
}

/**
 * Fetches user's saved feeds on login and caches them.
 * Returns fallback feeds if not authenticated or fetch fails.
 */
export function useAvailableFeeds({
  agent,
  isAuthenticated,
}: UseAvailableFeedsParams): ResolvedFeed[] {
  const [feeds, setFeeds] = useState<ResolvedFeed[]>(() => {
    if (!isAuthenticated) return [];
    return loadCachedFeeds() ?? [];
  });

  useEffect(() => {
    if (!agent || !isAuthenticated) {
      setFeeds([]);
      return;
    }

    // Load from cache immediately for instant UI
    const cached = loadCachedFeeds();
    if (cached && cached.length > 0) {
      setFeeds(cached);
    }

    // Refresh from API in background
    fetchUserSavedFeeds(agent)
      .then((resolved) => {
        if (resolved.length > 0) {
          setFeeds(resolved);
          saveCachedFeeds(resolved);
        } else if (!cached || cached.length === 0) {
          // No saved feeds and no cache — use fallback
          setFeeds(getFallbackFeeds());
        }
      })
      .catch((err) => {
        console.error('Failed to fetch saved feeds:', err);
        if (!cached || cached.length === 0) {
          setFeeds(getFallbackFeeds());
        }
      });
  }, [agent, isAuthenticated]);

  return feeds;
}
