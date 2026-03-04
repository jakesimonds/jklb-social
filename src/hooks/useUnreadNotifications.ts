/**
 * useUnreadNotifications - Hook to track unread notification state
 *
 * Periodically checks for new notifications by fetching the latest notification
 * and comparing its timestamp against the last-seen timestamp in localStorage.
 *
 * Features:
 * - Checks on mount and periodically (every 60 seconds)
 * - Clears unread indicator when notifications are viewed
 * - Respects authentication state (no polling when not logged in)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent } from '@atproto/api';
import { hasUnreadNotifications as checkUnread, getTestNotifications } from '../lib/notifications';
import { TEST_NOTIFICATIONS } from '../lib/flags';

// How often to check for new notifications (in milliseconds)
const POLL_INTERVAL_MS = 60_000; // 60 seconds

export interface UseUnreadNotificationsParams {
  agent: Agent | null;
  isAuthenticated: boolean;
  beginningComplete: boolean;
}

export interface UseUnreadNotificationsReturn {
  /** Whether there are unread notifications */
  hasUnread: boolean;
  /** Manually trigger a check for unread notifications */
  checkForUnread: () => Promise<void>;
  /** Clear the unread indicator (call when notifications are viewed) */
  clearUnread: () => void;
}

export function useUnreadNotifications({
  agent,
  isAuthenticated,
  beginningComplete,
}: UseUnreadNotificationsParams): UseUnreadNotificationsReturn {
  const [hasUnread, setHasUnread] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Check for unread notifications by fetching the newest notification
   * and comparing with the seenAt timestamp
   */
  const checkForUnread = useCallback(async () => {
    if (!agent || !isAuthenticated) {
      setHasUnread(false);
      return;
    }

    try {
      // If TEST_NOTIFICATIONS flag is on, inject fake notifications
      if (TEST_NOTIFICATIONS) {
        const fakeNotifs = getTestNotifications();
        if (fakeNotifs.length > 0) {
          // Fake notifications always appear as "new" (recent timestamps)
          const newestFakeTime = fakeNotifs[0].indexedAt;
          if (checkUnread(newestFakeTime)) {
            setHasUnread(true);
            return;
          }
        }
      }

      // Fetch just one notification to get the newest timestamp
      const response = await agent.listNotifications({ limit: 1 });
      const notifications = response.data.notifications;

      if (notifications.length === 0) {
        setHasUnread(false);
        return;
      }

      // Check if the newest notification is newer than seenAt
      const newestTime = notifications[0].indexedAt;
      setHasUnread(checkUnread(newestTime));
    } catch (error) {
      console.error('Failed to check for unread notifications:', error);
      // Keep current state on error
    }
  }, [agent, isAuthenticated]);

  /**
   * Clear the unread indicator
   * Called when the user opens the notifications panel
   */
  const clearUnread = useCallback(() => {
    setHasUnread(false);
  }, []);

  // Initial check and polling setup — deferred until Beginning is done
  useEffect(() => {
    if (!isAuthenticated || !agent || !beginningComplete) {
      setHasUnread(false);
      return;
    }

    // Initial check
    checkForUnread();

    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      checkForUnread();
    }, POLL_INTERVAL_MS);

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, agent, beginningComplete, checkForUnread]);

  return {
    hasUnread,
    checkForUnread,
    clearUnread,
  };
}
