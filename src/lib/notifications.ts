/**
 * Notification utilities for russAbbot
 * Handles tracking of "seen" notifications via a seenAt timestamp cursor
 *
 * The seenAt cursor stores the timestamp of when the user last finished the Beginning flow.
 * useBeginning filters out notifications older than seenAt entirely — they never enter
 * the flow. Only notifications with indexedAt > seenAt are fetched into the Beginning sequence.
 */

import { STORAGE_KEYS } from '../types';
import { TEST_NOTIFICATIONS } from './flags';

let testFixtures: typeof import('./test-fixtures') | null = null;
try {
  testFixtures = await import('./test-fixtures');
} catch {
  // test-fixtures.ts is gitignored — test notifications won't have data
}

/**
 * Get the timestamp when user last viewed notifications
 * Returns null if never viewed (all notifications are "new")
 */
export function getNotificationsSeenAt(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_SEEN_AT);
    return value;
  } catch {
    console.error('Failed to read notificationsSeenAt from localStorage');
    return null;
  }
}

/**
 * Update the seenAt cursor to now
 * Called when the Beginning flow reaches 'done' stage (see useBeginning.ts)
 */
export function markNotificationsAsSeen(): void {
  try {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_SEEN_AT, now);
  } catch (error) {
    console.error('Failed to save notificationsSeenAt to localStorage', error);
  }
}

/**
 * Check if a notification is "new" (unseen)
 * A notification is new if its indexedAt timestamp is after the seenAt cursor
 *
 * @param notificationTimestamp - ISO timestamp from notification's indexedAt
 * @param seenAt - ISO timestamp from getNotificationsSeenAt() (or null if never viewed)
 * @returns true if the notification is new/unseen
 */
export function isNotificationNew(notificationTimestamp: string, seenAt: string | null): boolean {
  // If never viewed, all notifications are new
  if (!seenAt) {
    return true;
  }

  try {
    const notifTime = new Date(notificationTimestamp).getTime();
    const seenTime = new Date(seenAt).getTime();
    return notifTime > seenTime;
  } catch {
    // If date parsing fails, assume not new (safer default)
    return false;
  }
}

/**
 * Fake notification data for testing
 * Mimics the shape of AppBskyNotificationListNotifications.Notification
 */
interface FakeNotification {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  reason: 'like' | 'repost' | 'follow' | 'mention' | 'quote' | 'reply';
  reasonSubject?: string;
  isRead: boolean;
  indexedAt: string;
}

/**
 * Generate fake notifications for testing
 * Returns 6 fake notifications with recent timestamps (appear as "new")
 * Each has a different type to test all notification variants (like, repost, follow, reply, quote, mention)
 */
function generateFakeNotifications(): FakeNotification[] {
  if (!testFixtures) return [];

  const now = Date.now();
  const { TEST_ACTORS, JAKE_POST_1, JAKE_POST_2, JAKE_MARGIN_QUESTION, MARGIN_REPLY_URI, REAL_QUOTE_URI } = testFixtures;

  const notifications: FakeNotification[] = [
    {
      uri: `at://${TEST_ACTORS[0].did}/app.bsky.feed.like/phantom0`,
      cid: 'phantomcid0',
      author: TEST_ACTORS[0],
      reason: 'like',
      reasonSubject: JAKE_POST_1,
      isRead: false,
      indexedAt: new Date(now - 0 * 60000).toISOString(),
    },
    {
      uri: `at://${TEST_ACTORS[1].did}/app.bsky.feed.repost/phantom1`,
      cid: 'phantomcid1',
      author: TEST_ACTORS[1],
      reason: 'repost',
      reasonSubject: JAKE_POST_2,
      isRead: false,
      indexedAt: new Date(now - 1 * 60000).toISOString(),
    },
    {
      uri: `at://${TEST_ACTORS[2].did}/app.bsky.graph.follow/phantom2`,
      cid: 'phantomcid2',
      author: TEST_ACTORS[2],
      reason: 'follow',
      isRead: false,
      indexedAt: new Date(now - 2 * 60000).toISOString(),
    },
    {
      uri: MARGIN_REPLY_URI,
      cid: 'phantomcid3',
      author: TEST_ACTORS[6],
      reason: 'reply',
      reasonSubject: JAKE_MARGIN_QUESTION,
      isRead: false,
      indexedAt: new Date(now - 3 * 60000).toISOString(),
    },
    {
      uri: REAL_QUOTE_URI,
      cid: 'phantomcid4',
      author: TEST_ACTORS[3],
      reason: 'quote',
      reasonSubject: JAKE_POST_2,
      isRead: false,
      indexedAt: new Date(now - 4 * 60000).toISOString(),
    },
    {
      uri: `at://${TEST_ACTORS[5].did}/app.bsky.feed.post/3mfkfemdxnc2m`,
      cid: 'phantomcid5',
      author: TEST_ACTORS[5],
      reason: 'mention',
      isRead: false,
      indexedAt: new Date(now - 5 * 60000).toISOString(),
    },
  ];

  return notifications;
}

/**
 * Get fake test notifications (if TEST_NOTIFICATIONS flag is on)
 * Returns empty array if flag is off
 */
export function getTestNotifications(): FakeNotification[] {
  if (!TEST_NOTIFICATIONS) {
    return [];
  }
  return generateFakeNotifications();
}

/**
 * Check if there are unread notifications by comparing newest notification timestamp
 * with the last-seen timestamp
 *
 * @param newestNotificationTime - ISO timestamp of the newest notification
 * @returns true if there are unread notifications
 */
export function hasUnreadNotifications(newestNotificationTime: string | null): boolean {
  if (!newestNotificationTime) {
    return false;
  }

  const seenAt = getNotificationsSeenAt();

  // If never viewed notifications, any notification is unread
  if (!seenAt) {
    return true;
  }

  try {
    const newestTime = new Date(newestNotificationTime).getTime();
    const seenTime = new Date(seenAt).getTime();
    return newestTime > seenTime;
  } catch {
    // If date parsing fails, assume no unread (safer default)
    return false;
  }
}
