// useFeed hook - React hook for feed state management
// Encapsulates feed state, fetching logic, and navigation

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Agent } from '@atproto/api';
import type { Post, FeedItem, FeedSettings, PDSFeedItem } from '../types';
import { isPostFeedItem, isPDSFeedItem } from '../types';
import {
  fetchChronoFeed,
  fetchChorusFeed,
  fetchAlgoFeed,
  fetchTestPosts,
  fetchPublicDiscoverFeed,
  combineAndDeduplicateFeedItems,
  filterRepliesAndCollapseThreads,
  wrapPostsAsFeedItems,
  wrapPDSRecordsAsFeedItems,
  getTestPDSRecords,
  type FetchChorusResult,
  type FetchAlgoResult,
} from '../lib/feed';
import { UI_TESTING_MODE } from '../lib/settings';
import { trackPostViewed, untrackPostViewed } from '../lib/session';
import {
  createInitialChorusState,
  refreshChorusFromNotifications,
  type ChorusState,
} from '../lib/chorus';
import { prefetchBanners } from './useAuthorBanner';

/** Default limit for feed fetches */
const DEFAULT_FEED_LIMIT = 100;

/**
 * Compare two FeedSettings objects for equality
 * Returns true if all relevant settings are the same
 */
function areFeedSettingsEqual(a: FeedSettings, b: FeedSettings): boolean {
  return (
    a.chorusEnabled === b.chorusEnabled &&
    a.algoFeed === b.algoFeed
  );
}

/**
 * Parameters for the useFeed hook
 */
export interface UseFeedParams {
  agent: Agent | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  feedSettings: FeedSettings;
  chorusMemberDids: string[];
  onChorusRefresh?: (state: ChorusState) => void;
}

/**
 * Return type for the useFeed hook
 */
export interface UseFeedReturn {
  // State
  feedItems: FeedItem[];
  currentItemIndex: number;
  isLoading: boolean;
  error: string | null;

  // Derived
  currentItem: FeedItem | null;
  currentPost: Post | null;
  currentPDSRecord: PDSFeedItem | null;

  // Navigation (raw - App.tsx wraps with thread logic)
  goToNextPost: () => void;
  goToPreviousPost: () => void;
  navigateToIndex: (index: number) => void;

  // Actions
  setFeedItems: React.Dispatch<React.SetStateAction<FeedItem[]>>;
  setCurrentItemIndex: React.Dispatch<React.SetStateAction<number>>;
  insertFeedItem: (item: FeedItem, afterIndex: number) => void;
}

/**
 * Custom hook for managing feed state, fetching, and navigation
 *
 * This hook encapsulates:
 * - Feed state (feedItems, currentItemIndex, loading, error)
 * - Public feed fetching for unauthenticated users
 * - Authenticated feed fetching (chrono + chorus + algo tiers)
 * - Settings change detection and refetching
 * - j/k navigation (raw - caller wraps with thread view logic)
 *
 * @param params - Dependencies from the parent component
 * @returns Feed state and actions
 */
export function useFeed({
  agent,
  isAuthenticated,
  isInitializing,
  feedSettings,
  chorusMemberDids,
  onChorusRefresh,
}: UseFeedParams): UseFeedReturn {
  // Feed state
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const chronoCursorRef = useRef<string | undefined>(undefined);

  // Track if we've done the initial fetch
  const hasFetchedRef = useRef(false);

  // Track previous feed settings to detect changes
  const prevFeedSettingsRef = useRef<FeedSettings | null>(null);

  // Track previous auth state to detect logout
  const prevIsAuthenticatedRef = useRef<boolean>(isAuthenticated);

  // =========================================================================
  // Auth State Change Effect (reset feed state on login or logout)
  // =========================================================================
  useEffect(() => {
    // Detect transition from authenticated to unauthenticated (logout)
    if (prevIsAuthenticatedRef.current && !isAuthenticated) {
      // Reset all feed state to trigger fresh public feed fetch
      setFeedItems([]);
      setCurrentItemIndex(0);
      setFeedError(null);
      chronoCursorRef.current = undefined;
      hasFetchedRef.current = false;
      prevFeedSettingsRef.current = null;

      // Reset chorus state to initial empty state
      if (onChorusRefresh) {
        onChorusRefresh(createInitialChorusState());
      }
    }

    // Detect transition from unauthenticated to authenticated (login)
    // This fixes BUG-CHORUS-01: the public feed effect may have run during OAuth
    // callback processing (when isInitializing=false but isAuthenticated=false),
    // setting hasFetchedRef=true. We need to reset it to allow the authenticated
    // feed effect to run and fetch the user's personalized feed + chorus.
    if (!prevIsAuthenticatedRef.current && isAuthenticated) {
      // Reset feed state to trigger fresh authenticated feed fetch
      setFeedItems([]);
      setCurrentItemIndex(0);
      setFeedError(null);
      chronoCursorRef.current = undefined;
      hasFetchedRef.current = false;
      prevFeedSettingsRef.current = null;
    }

    // Update the ref for next render
    prevIsAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, onChorusRefresh]);

  // Derived state
  const currentItem = feedItems[currentItemIndex] ?? null;
  const currentPost = currentItem && isPostFeedItem(currentItem) ? currentItem.post : null;
  const currentPDSRecord = currentItem && isPDSFeedItem(currentItem) ? currentItem : null;

  // =========================================================================
  // Public Feed Effect (for unauthenticated users)
  // =========================================================================
  useEffect(() => {
    // Only fetch public feed if not authenticated and no items loaded yet
    if (isAuthenticated || hasFetchedRef.current || feedItems.length > 0) return;
    // Wait for initialization to complete
    if (isInitializing) return;

    async function fetchPublicFeed() {
      hasFetchedRef.current = true;
      setFeedLoading(true);
      setFeedError(null);

      try {
        const result = await fetchPublicDiscoverFeed(30);
        setFeedItems(filterRepliesAndCollapseThreads(wrapPostsAsFeedItems(result.posts)));
      } catch (err) {
        console.error('Failed to fetch public feed:', err);
        setFeedError(err instanceof Error ? err.message : 'Failed to load public feed');
      } finally {
        setFeedLoading(false);
      }
    }

    fetchPublicFeed();
  }, [isAuthenticated, isInitializing, feedItems.length]);

  // =========================================================================
  // Initial Data Effect (authenticated users)
  // =========================================================================
  useEffect(() => {
    if (!agent || hasFetchedRef.current) return;

    // Capture agent for async closure (TypeScript narrowing)
    const currentAgent = agent;

    async function fetchInitialData() {
      hasFetchedRef.current = true;
      setFeedLoading(true);
      setFeedError(null);

      try {
        // We'll collect FeedItems from each tier
        const feedItemArrays: FeedItem[][] = [];

        // Fetch test posts first (only in UI testing mode)
        if (UI_TESTING_MODE) {
          const testResult = await fetchTestPosts(currentAgent);
          feedItemArrays.push(wrapPostsAsFeedItems(testResult.posts));

          // Also add test PDS records (non-Bluesky content from ATProto apps)
          const testPDSRecords = getTestPDSRecords();
          const memberHandles = new Map(testPDSRecords.map(r => [
            r.record.uri.split('/')[2], // Extract DID from URI
            r.handle
          ]));
          feedItemArrays.push(wrapPDSRecordsAsFeedItems(
            testPDSRecords.map(r => r.record),
            memberHandles
          ));
        }

        // Determine feed mode: null algoFeed = Chronological, otherwise Algo
        const algoFeedUri = feedSettings.algoFeed;
        const isChronological = algoFeedUri === null;

        // Parallel fetch: chorus notifications + main feed are independent
        // Only step 3 (chorus feed) depends on chorus members from step 1
        const [chorusResult, mainFeedResult] = await Promise.all([
          feedSettings.chorusEnabled
            ? refreshChorusFromNotifications(currentAgent, createInitialChorusState())
            : Promise.resolve({ state: createInitialChorusState() }),
          isChronological
            ? fetchChronoFeed(currentAgent, DEFAULT_FEED_LIMIT)
            : fetchAlgoFeed(currentAgent, algoFeedUri, DEFAULT_FEED_LIMIT),
        ]);

        // Notify parent of chorus state update
        if (feedSettings.chorusEnabled && onChorusRefresh) {
          onChorusRefresh(chorusResult.state);
        }

        // Push main feed results
        if (isChronological) {
          const chronoResult = mainFeedResult as { posts: Post[]; cursor?: string };
          feedItemArrays.push(wrapPostsAsFeedItems(chronoResult.posts));
          chronoCursorRef.current = chronoResult.cursor;
        } else {
          feedItemArrays.push(wrapPostsAsFeedItems((mainFeedResult as FetchAlgoResult).posts));
        }

        // Tier 2: Chorus feed — still sequential, needs chorus members from step 1
        if (feedSettings.chorusEnabled && chorusResult.state.members.length > 0) {
          const chorusMemberDidsFromResult = chorusResult.state.members.map(m => m.did);
          const chorusFeedResult: FetchChorusResult = await fetchChorusFeed(
            currentAgent,
            chorusMemberDidsFromResult,
            5 // 5 posts per chorus member
          );
          feedItemArrays.push(wrapPostsAsFeedItems(chorusFeedResult.posts));
        }

        // Combine and deduplicate all feed items from all tiers
        // Deduplication ensures no duplicate items appear in timeline (by URI)
        const { items: combinedItems } = combineAndDeduplicateFeedItems(
          feedItemArrays
        );
        // Filter replies and collapse self-threads so each thread counts as one item
        const filteredItems = filterRepliesAndCollapseThreads(combinedItems);
        setFeedItems(filteredItems);
        // Note: We do NOT call trackPostViewed() here.
        // Initial feed load doesn't count as "viewing" - the user hasn't actively
        // navigated yet. Viewing is tracked only when the user presses j/k or navigates.
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        setFeedError(err instanceof Error ? err.message : 'Failed to load feed');
      } finally {
        setFeedLoading(false);
      }
    }

    fetchInitialData();
  }, [agent, feedSettings.chorusEnabled, feedSettings.algoFeed, onChorusRefresh]);

  // =========================================================================
  // Settings Change Effect (refetch when settings change)
  // =========================================================================
  useEffect(() => {
    // Skip if no agent available
    if (!agent) return;

    // On first run, just store the current settings
    if (prevFeedSettingsRef.current === null) {
      prevFeedSettingsRef.current = { ...feedSettings };
      return;
    }

    // Check if feed settings have changed
    if (areFeedSettingsEqual(prevFeedSettingsRef.current, feedSettings)) {
      return; // No change, nothing to do
    }

    // Settings changed - update ref and trigger refresh
    prevFeedSettingsRef.current = { ...feedSettings };

    // Reset feed state
    setFeedItems([]);
    setCurrentItemIndex(0);
    setFeedError(null);
    chronoCursorRef.current = undefined;

    // Capture agent and chorusMemberDids for async closure
    const currentAgent = agent;
    const currentChorusMemberDids = chorusMemberDids;

    async function refetchFeed() {
      setFeedLoading(true);

      try {
        // We'll collect FeedItems from each tier
        const feedItemArrays: FeedItem[][] = [];

        // Fetch test posts first (only in UI testing mode)
        if (UI_TESTING_MODE) {
          const testResult = await fetchTestPosts(currentAgent);
          feedItemArrays.push(wrapPostsAsFeedItems(testResult.posts));

          // Also add test PDS records (non-Bluesky content from ATProto apps)
          const testPDSRecords = getTestPDSRecords();
          const memberHandles = new Map(testPDSRecords.map(r => [
            r.record.uri.split('/')[2], // Extract DID from URI
            r.handle
          ]));
          feedItemArrays.push(wrapPDSRecordsAsFeedItems(
            testPDSRecords.map(r => r.record),
            memberHandles
          ));
        }

        // Determine feed mode: null algoFeed = Chronological, otherwise Algo
        const algoFeedUri = feedSettings.algoFeed;
        const isChronological = algoFeedUri === null;

        // Tier 1: Either Chronological OR Algo feed (mutually exclusive)
        if (isChronological) {
          // Chronological mode: fetch user's timeline
          const chronoResult = await fetchChronoFeed(
            currentAgent,
            DEFAULT_FEED_LIMIT
          );
          feedItemArrays.push(wrapPostsAsFeedItems(chronoResult.posts));
          chronoCursorRef.current = chronoResult.cursor;
        } else {
          // Algo mode: fetch the selected algorithm feed
          const algoResult: FetchAlgoResult = await fetchAlgoFeed(
            currentAgent,
            algoFeedUri,
            DEFAULT_FEED_LIMIT
          );
          feedItemArrays.push(wrapPostsAsFeedItems(algoResult.posts));
        }

        // Tier 2: Chorus posts from chorus members
        if (feedSettings.chorusEnabled && currentChorusMemberDids.length > 0) {
          // Fetch Bluesky posts from chorus members via the API
          const chorusFeedResult: FetchChorusResult = await fetchChorusFeed(
            currentAgent,
            currentChorusMemberDids,
            5 // 5 posts per chorus member
          );
          feedItemArrays.push(wrapPostsAsFeedItems(chorusFeedResult.posts));
        }

        // Combine and deduplicate all feed items from all tiers
        const { items: combinedItems } = combineAndDeduplicateFeedItems(
          feedItemArrays
        );
        // Filter replies and collapse self-threads so each thread counts as one item
        const filteredItems = filterRepliesAndCollapseThreads(combinedItems);
        setFeedItems(filteredItems);
        // Note: We do NOT call trackPostViewed() here.
        // Settings change refetch doesn't count as "viewing" - viewing is tracked
        // only when the user actively navigates with j/k or jumps to an index.
      } catch (err) {
        console.error('Failed to refetch feed after settings change:', err);
        setFeedError(err instanceof Error ? err.message : 'Failed to load feed');
      } finally {
        setFeedLoading(false);
      }
    }

    refetchFeed();
  }, [agent, feedSettings, chorusMemberDids]);

  // =========================================================================
  // Prefetch Effect — while the human reads, fetch what's coming next
  // =========================================================================
  useEffect(() => {
    if (feedItems.length === 0) return;
    // Prefetch banners for the next 3 posts
    const upcomingDids = feedItems
      .slice(currentItemIndex + 1, currentItemIndex + 4)
      .map(item => isPostFeedItem(item) ? item.post.author.did : undefined);
    prefetchBanners(agent, upcomingDids);
  }, [currentItemIndex, feedItems, agent]);

  // =========================================================================
  // Navigation Callbacks (raw - caller wraps with thread view logic)
  // =========================================================================

  /**
   * Navigate to the next post in the feed
   * Note: Thread view exit is handled by the caller (App.tsx)
   *
   * IMPORTANT: trackPostViewed() must be called OUTSIDE the state setter.
   * React StrictMode calls state updater functions twice to detect impurities.
   * Side effects inside setters will execute twice, causing double-counting.
   */
  const goToNextPost = useCallback(() => {
    if (currentItemIndex < feedItems.length - 1) {
      // Track post viewed BEFORE updating state (outside setter to avoid StrictMode double-call)
      trackPostViewed();
      setCurrentItemIndex(currentItemIndex + 1);
    }
    // TODO: Trigger fetch more posts when approaching end
  }, [currentItemIndex, feedItems.length]);

  /**
   * Navigate to the previous post in the feed
   * Note: Thread view exit is handled by the caller (App.tsx)
   *
   * IMPORTANT: trackPostViewed() must be called OUTSIDE the state setter.
   * React StrictMode calls state updater functions twice to detect impurities.
   * Side effects inside setters will execute twice, causing double-counting.
   */
  const goToPreviousPost = useCallback(() => {
    if (currentItemIndex > 0) {
      // Decrement posts viewed counter so progress bar moves back
      untrackPostViewed();
      setCurrentItemIndex(currentItemIndex - 1);
    }
  }, [currentItemIndex]);

  /**
   * Navigate directly to a specific index
   *
   * Note: trackPostViewed() is correctly called OUTSIDE the state setter here.
   * This avoids double-counting in React StrictMode.
   */
  const navigateToIndex = useCallback((index: number) => {
    if (index >= 0 && index < feedItems.length) {
      trackPostViewed();
      setCurrentItemIndex(index);
    }
  }, [feedItems.length]);

  /**
   * Insert a feed item after a specific index
   * Used by drillIntoQuote to add quoted posts to the feed
   */
  const insertFeedItem = useCallback((item: FeedItem, afterIndex: number) => {
    setFeedItems((prevItems) => {
      const newItems = [...prevItems];
      newItems.splice(afterIndex + 1, 0, item);
      return newItems;
    });
  }, []);

  return {
    // State
    feedItems,
    currentItemIndex,
    isLoading: feedLoading,
    error: feedError,

    // Derived
    currentItem,
    currentPost,
    currentPDSRecord,

    // Navigation
    goToNextPost,
    goToPreviousPost,
    navigateToIndex,

    // Actions
    setFeedItems,
    setCurrentItemIndex,
    insertFeedItem,
  };
}
