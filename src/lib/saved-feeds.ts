// Utility for fetching and resolving user's saved/pinned feeds from Bluesky preferences

import type { Agent } from '@atproto/api';
import { STORAGE_KEYS, KNOWN_FEEDS } from '../types';

export interface ResolvedFeed {
  id: string;
  type: 'feed' | 'list' | 'timeline';
  value: string;         // AT-URI or 'following'
  pinned: boolean;
  displayName: string;
}

interface CachedFeeds {
  feeds: ResolvedFeed[];
  fetchedAt: string;
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch and resolve the user's saved/pinned feeds from their Bluesky preferences.
 * Returns feeds with human-readable display names.
 * Only includes 'feed' and 'timeline' types (lists are skipped for now).
 */
export async function fetchUserSavedFeeds(agent: Agent): Promise<ResolvedFeed[]> {
  const prefs = await agent.getPreferences();
  const savedFeeds = prefs.savedFeeds;

  if (!savedFeeds || savedFeeds.length === 0) {
    return [];
  }

  const resolved: ResolvedFeed[] = [];

  // Timeline items — no API call needed
  for (const item of savedFeeds) {
    if (item.type === 'timeline') {
      resolved.push({
        id: item.id,
        type: 'timeline',
        value: item.value,
        pinned: item.pinned,
        displayName: 'Following',
      });
    }
  }

  // Batch-resolve feed generators
  const feedItems = savedFeeds.filter(f => f.type === 'feed');
  if (feedItems.length > 0) {
    const { data } = await agent.app.bsky.feed.getFeedGenerators({
      feeds: feedItems.map(f => f.value),
    });
    for (const gen of data.feeds) {
      const item = feedItems.find(f => f.value === gen.uri);
      if (item) {
        resolved.push({
          id: item.id,
          type: 'feed',
          value: item.value,
          pinned: item.pinned,
          displayName: gen.displayName,
        });
      }
    }
  }

  // Return in original order (matching user's arrangement)
  return savedFeeds
    .map(f => resolved.find(r => r.id === f.id))
    .filter((r): r is ResolvedFeed => r !== undefined);
}

/**
 * Load cached feeds from localStorage
 */
export function loadCachedFeeds(): ResolvedFeed[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_FEEDS);
    if (!raw) return null;
    const cached: CachedFeeds = JSON.parse(raw);
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age > CACHE_MAX_AGE_MS) return null;
    return cached.feeds;
  } catch {
    return null;
  }
}

/**
 * Save feeds to localStorage cache
 */
export function saveCachedFeeds(feeds: ResolvedFeed[]): void {
  const cached: CachedFeeds = {
    feeds,
    fetchedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.SAVED_FEEDS, JSON.stringify(cached));
}

/**
 * Build fallback feeds from KNOWN_FEEDS constant.
 * Used when preferences can't be fetched or return empty.
 */
export function getFallbackFeeds(): ResolvedFeed[] {
  return [
    { id: 'fallback-for-you', type: 'feed', value: KNOWN_FEEDS.FOR_YOU, pinned: true, displayName: 'For You' },
    { id: 'fallback-whats-hot', type: 'feed', value: KNOWN_FEEDS.WHATS_HOT, pinned: true, displayName: "What's Hot" },
    { id: 'fallback-discover', type: 'feed', value: KNOWN_FEEDS.DISCOVER, pinned: true, displayName: 'Discover' },
  ];
}
