// Like Chorus state management utilities
// Manages the 18-member grid of users who have recently interacted with the authenticated user

import type { Agent } from '@atproto/api';
import type { ChorusMember, ChorusInteractionType } from '../types';

/**
 * Maximum number of members in the chorus grid
 * Large value to allow filling the entire border (top + right bars)
 * AppLayout CSS uses flex-wrap to fill available space dynamically
 */
export const CHORUS_MAX_SIZE = 100;

/**
 * State for the Like Chorus feature
 */
export interface ChorusState {
  members: ChorusMember[];
  newestMemberDid: string | null;
}

/**
 * Creates an initial empty chorus state
 */
export function createInitialChorusState(): ChorusState {
  return {
    members: [],
    newestMemberDid: null,
  };
}

/**
 * Checks if a member with the given DID exists in the chorus
 */
export function isMemberInChorus(state: ChorusState, did: string): boolean {
  return state.members.some(member => member.did === did);
}

/**
 * Adds a new member to the chorus
 * - If member already exists (by DID), does nothing
 * - If chorus is full (18 members), randomly replaces one existing member
 * - Tracks the newest member for highlighting
 *
 * Returns new state (immutable)
 */
export function addMemberToChorus(
  state: ChorusState,
  newMember: ChorusMember
): ChorusState {
  // Check if member already exists
  if (isMemberInChorus(state, newMember.did)) {
    return state;
  }

  let newMembers: ChorusMember[];

  if (state.members.length >= CHORUS_MAX_SIZE) {
    // Chorus is full - remove the longest-tenured member (FIFO)
    // Find the member with the oldest enteredAt timestamp
    let oldestIndex = 0;
    let oldestTime = state.members[0].enteredAt;
    for (let i = 1; i < state.members.length; i++) {
      if (state.members[i].enteredAt < oldestTime) {
        oldestTime = state.members[i].enteredAt;
        oldestIndex = i;
      }
    }
    newMembers = [...state.members];
    newMembers[oldestIndex] = newMember;
  } else {
    // Chorus has room - add to the end
    newMembers = [...state.members, newMember];
  }

  return {
    members: newMembers,
    newestMemberDid: newMember.did,
  };
}

/**
 * Adds multiple members to the chorus
 * Members are processed in order, with earlier members taking precedence
 *
 * Returns new state (immutable)
 */
export function addMembersToChorus(
  state: ChorusState,
  newMembers: ChorusMember[]
): ChorusState {
  let currentState = state;

  for (const member of newMembers) {
    currentState = addMemberToChorus(currentState, member);
  }

  return currentState;
}

/**
 * Removes a member from the chorus by DID
 * If the removed member was the newest, clears the newest tracking
 *
 * Returns new state (immutable)
 */
export function removeMemberFromChorus(
  state: ChorusState,
  did: string
): ChorusState {
  const newMembers = state.members.filter(member => member.did !== did);

  // If nothing was removed, return original state
  if (newMembers.length === state.members.length) {
    return state;
  }

  return {
    members: newMembers,
    newestMemberDid: state.newestMemberDid === did ? null : state.newestMemberDid,
  };
}

/**
 * Clears the newest member highlight (but keeps the member)
 * Useful when user has acknowledged the new member
 *
 * Returns new state (immutable)
 */
export function clearNewestHighlight(state: ChorusState): ChorusState {
  if (state.newestMemberDid === null) {
    return state;
  }

  return {
    ...state,
    newestMemberDid: null,
  };
}

/**
 * Resets the chorus to empty state
 */
export function resetChorus(): ChorusState {
  return createInitialChorusState();
}

/**
 * Gets the count of members in the chorus
 */
export function getChorusCount(state: ChorusState): number {
  return state.members.length;
}

/**
 * Checks if the chorus is empty
 */
export function isChorusEmpty(state: ChorusState): boolean {
  return state.members.length === 0;
}

/**
 * Checks if the chorus is full (18 members)
 */
export function isChorusFull(state: ChorusState): boolean {
  return state.members.length >= CHORUS_MAX_SIZE;
}

/**
 * Notification types that indicate someone interacted with the user
 * These are the reasons we use to populate the chorus
 */
export const CHORUS_NOTIFICATION_REASONS = [
  'like',
  'repost',
  'follow',
  'mention',
  'reply',
  'quote',
] as const;

export type ChorusNotificationReason = (typeof CHORUS_NOTIFICATION_REASONS)[number];

/**
 * Notification from the ATProto API
 * Simplified type for chorus processing
 */
export interface ChorusNotification {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  reason: string;
  isRead: boolean;
  indexedAt: string;
}

/**
 * Result from fetching notifications
 */
export interface FetchNotificationsResult {
  notifications: ChorusNotification[];
  cursor?: string;
}

/**
 * Fetches notifications from the ATProto API via the agent
 * Returns notifications that can be processed to populate the chorus
 *
 * @param agent - The authenticated ATProto agent
 * @param limit - Maximum number of notifications to fetch (default: 50)
 * @param cursor - Pagination cursor for fetching more notifications
 */
export async function fetchNotificationsForChorus(
  agent: Agent,
  limit: number = 50,
  cursor?: string
): Promise<FetchNotificationsResult> {
  const response = await agent.listNotifications({
    limit,
    cursor,
    // Filter to only include notification types relevant to the chorus
    reasons: [...CHORUS_NOTIFICATION_REASONS],
  });

  const notifications: ChorusNotification[] = response.data.notifications.map(
    (notif) => ({
      uri: notif.uri,
      cid: notif.cid,
      author: {
        did: notif.author.did,
        handle: notif.author.handle,
        displayName: notif.author.displayName,
        avatar: notif.author.avatar,
      },
      reason: notif.reason,
      isRead: notif.isRead,
      indexedAt: notif.indexedAt,
    })
  );

  return {
    notifications,
    cursor: response.data.cursor,
  };
}

/**
 * Maps notification reason to interaction type for color-coding
 */
function mapReasonToInteractionType(reason: string): ChorusInteractionType | undefined {
  switch (reason) {
    case 'like':
      return 'like';
    case 'follow':
      return 'follow';
    case 'repost':
      return 'repost';
    case 'quote':
      return 'quote';
    case 'reply':
      return 'reply';
    case 'mention':
      return 'mention';
    default:
      return undefined;
  }
}

/**
 * Extracts unique ChorusMember objects from notifications
 * Dedupes by DID and returns members in order of most recent notification first
 * Captures the interaction type (like/follow/repost/etc) for avatar color-coding
 *
 * @param notifications - Array of notifications from fetchNotificationsForChorus
 * @returns Array of unique ChorusMember objects, most recent first
 */
export function extractMembersFromNotifications(
  notifications: ChorusNotification[]
): ChorusMember[] {
  const seenDids = new Set<string>();
  const members: ChorusMember[] = [];

  // Notifications are typically returned in reverse-chronological order (newest first)
  // We iterate through them and add unique members while preserving that order
  for (const notification of notifications) {
    const { did, handle, displayName, avatar } = notification.author;

    // Skip if we've already seen this DID
    if (seenDids.has(did)) {
      continue;
    }

    seenDids.add(did);
    members.push({
      did,
      handle,
      displayName,
      avatar,
      enteredAt: Date.now(),
      interactionType: mapReasonToInteractionType(notification.reason),
    });
  }

  return members;
}

/**
 * Populates the chorus state from a list of notifications
 * - Extracts unique users from notifications (deduped by DID)
 * - Adds them to the chorus (most recent first)
 * - Respects the 18-member limit
 *
 * @param state - Current chorus state
 * @param notifications - Array of notifications to process
 * @returns New chorus state with members populated
 */
export function populateChorusFromNotifications(
  state: ChorusState,
  notifications: ChorusNotification[]
): ChorusState {
  // Extract unique members from notifications
  const newMembers = extractMembersFromNotifications(notifications);

  // Add all new members to the chorus
  // The addMembersToChorus function handles deduplication and the 18-member limit
  return addMembersToChorus(state, newMembers);
}

/**
 * Convenience function that fetches notifications and populates the chorus in one call
 * This is the main entry point for refreshing the chorus
 *
 * @param agent - The authenticated ATProto agent
 * @param state - Current chorus state
 * @param limit - Maximum number of notifications to fetch (default: 50)
 * @returns Promise resolving to new chorus state and pagination cursor
 */
export async function refreshChorusFromNotifications(
  agent: Agent,
  state: ChorusState,
  limit: number = 50
): Promise<{ state: ChorusState; cursor?: string }> {
  // Fetch notifications
  const { notifications, cursor } = await fetchNotificationsForChorus(agent, limit);

  // Populate chorus from notifications
  const newState = populateChorusFromNotifications(state, notifications);

  return {
    state: newState,
    cursor,
  };
}

