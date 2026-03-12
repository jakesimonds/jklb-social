// useFeed hook for React Native
// Simplified from src/hooks/useFeed.ts — no chorus, no test posts, no PDS records
// Handles public feed (unauthenticated) and chrono/algo feed (authenticated)

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Agent } from '@atproto/api';
import type { Post, FeedItem, FeedSettings } from '../lib/types';
import { isPostFeedItem } from '../lib/types';
import {
  fetchChronoFeed,
  fetchAlgoFeed,
  fetchPublicDiscoverFeed,
  fetchBanners,
  combineAndDeduplicateFeedItems,
  wrapPostsAsFeedItems,
  type FetchAlgoResult,
} from '../lib/feed';
import { trackPostViewed, untrackPostViewed } from '../lib/session';

const DEFAULT_FEED_LIMIT = 100; // Bluesky API caps at 100

export interface UseFeedParams {
  agent: Agent | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  feedSettings: FeedSettings;
}

export interface UseFeedReturn {
  feedItems: FeedItem[];
  currentItemIndex: number;
  isLoading: boolean;
  error: string | null;
  currentPost: Post | null;
  setFeedItems: React.Dispatch<React.SetStateAction<FeedItem[]>>;
  setCurrentItemIndex: React.Dispatch<React.SetStateAction<number>>;
  resetFeed: () => void;
}

export function useFeed({
  agent,
  isAuthenticated,
  isInitializing,
  feedSettings,
}: UseFeedParams): UseFeedReturn {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const chronoCursorRef = useRef<string | undefined>(undefined);
  const hasFetchedRef = useRef(false);
  const prevIsAuthenticatedRef = useRef<boolean>(isAuthenticated);

  // Reset feed state on auth transitions (login/logout)
  useEffect(() => {
    if (prevIsAuthenticatedRef.current !== isAuthenticated) {
      setFeedItems([]);
      setCurrentItemIndex(0);
      setFeedError(null);
      chronoCursorRef.current = undefined;
      hasFetchedRef.current = false;
    }
    prevIsAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Derived state
  const currentItem = feedItems[currentItemIndex] ?? null;
  const currentPost = currentItem && isPostFeedItem(currentItem) ? currentItem.post : null;

  // Public feed for unauthenticated users
  useEffect(() => {
    if (isAuthenticated || hasFetchedRef.current || feedItems.length > 0) return;
    if (isInitializing) return;

    async function fetchPublicFeed() {
      hasFetchedRef.current = true;
      setFeedLoading(true);
      setFeedError(null);

      try {
        const result = await fetchPublicDiscoverFeed(30);
        const allItems = wrapPostsAsFeedItems(result.posts);

        // Filter out reply posts — only show original posts
        const filteredItems = allItems.filter(item => {
          if (!isPostFeedItem(item)) return true;
          return !item.post.replyParent;
        });

        setFeedItems(filteredItems);
      } catch (err) {
        console.error('Failed to fetch public feed:', err);
        setFeedError(err instanceof Error ? err.message : 'Failed to load public feed');
      } finally {
        setFeedLoading(false);
      }
    }

    fetchPublicFeed();
  }, [isAuthenticated, isInitializing, feedItems.length]);

  // Authenticated feed (chrono or algo)
  useEffect(() => {
    if (!agent || hasFetchedRef.current) return;

    const currentAgent = agent;

    async function fetchInitialData() {
      hasFetchedRef.current = true;
      setFeedLoading(true);
      setFeedError(null);

      try {
        // Always use chronological feed — algo feed selection not yet implemented
        // This avoids "could not locate record" errors from stale/invalid feed URIs
        const chronoResult = await fetchChronoFeed(currentAgent, DEFAULT_FEED_LIMIT);
        const feedItemArrays: FeedItem[][] = [wrapPostsAsFeedItems(chronoResult.posts)];
        chronoCursorRef.current = chronoResult.cursor;

        const { items: combinedItems } = combineAndDeduplicateFeedItems(feedItemArrays);

        // Filter out reply posts — only show original posts
        const filteredItems = combinedItems.filter(item => {
          if (!isPostFeedItem(item)) return true;
          return !item.post.replyParent;
        });

        // Render feed immediately — don't block on banners
        setFeedItems(filteredItems);

        // Fire-and-forget — banners load in background
        const postsForBanners = filteredItems
          .filter(isPostFeedItem)
          .map(item => item.post);
        fetchBanners(currentAgent, postsForBanners).then(() => {
          // Force re-render so banner images appear once loaded
          setFeedItems(prev => [...prev]);
        }).catch(err => {
          console.error('Banner fetch failed:', err);
        });
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        setFeedError(err instanceof Error ? err.message : 'Failed to load feed');
      } finally {
        setFeedLoading(false);
      }
    }

    fetchInitialData();
  }, [agent, feedSettings.algoFeed, fetchTrigger]);

  // Reset all feed state so the next effect cycle triggers a fresh fetch
  const resetFeed = useCallback(() => {
    setFeedItems([]);
    setCurrentItemIndex(0);
    setFeedError(null);
    chronoCursorRef.current = undefined;
    hasFetchedRef.current = false;
    setFetchTrigger(n => n + 1);
  }, []);

  return {
    feedItems,
    currentItemIndex,
    isLoading: feedLoading,
    error: feedError,
    currentPost,
    setFeedItems,
    setCurrentItemIndex,
    resetFeed,
  };
}
