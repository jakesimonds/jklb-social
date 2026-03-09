/**
 * useBeginning - State machine hook for the Beginning flow.
 *
 * Manages the sequence: tutorialNav → unactionable (likes & boosts) →
 * follower (serial) → tutorialActions → quotePost (serial) → reply (serial) → mention (serial) → done
 *
 * Fetches notifications on mount, groups by type, and provides j/k navigation
 * through all stages. Empty categories are silently skipped.
 * Tutorial cards are shown when the tutorial setting is enabled (on by default).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Agent, AppBskyNotificationListNotifications } from '@atproto/api';
import { getNotificationsSeenAt, markNotificationsAsSeen, isNotificationNew, getTestNotifications } from '../lib/notifications';
import { TEST_NOTIFICATIONS } from '../lib/flags';

// ── Types ───────────────────────────────────────────────────────────

export type BeginningStage =
  | 'curator'          // Premium: curator config card (textarea + post count slider)
  | 'tutorialNav'      // Tutorial card 1: Welcome + j/space
  | 'tutorialActions'  // Tutorial card 2: Philosophy + l/b
  | 'tutorialMoreKeys' // Tutorial card 3: q/v/o hotkeys
  | 'unactionable'     // Likes & boosts combined (informational)
  | 'follower'         // New follower (serial, one at a time)
  | 'quotePost'        // Quote post (serial)
  | 'reply'            // Reply (serial)
  | 'mention'          // Mention (serial)
  | 'done';            // Transition to Middle

/** A notification actor (person who did the action) */
export interface NotificationActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/** A single notification item from the API, simplified for Beginning flow */
export interface BeginningNotification {
  type: 'like' | 'repost' | 'follow' | 'quote' | 'reply' | 'mention';
  actor: NotificationActor;
  timestamp: string;
  isNew: boolean;
  /** AT URI of the post that was acted upon (likes, boosts, quotes, replies) */
  reasonSubject?: string;
  /** AT URI of the notification record itself (e.g. the reply or quote post) */
  uri?: string;
}

/** Notifications grouped by type for the Beginning flow */
export interface NotificationsByType {
  /** Likes and boosts combined, grouped by the post they reference */
  unactionable: UnactionableGroup[];
  /** Flattened slides for the unactionable view (likes first, then boosts, 2 posts per slide) */
  unactionableSlides: UnactionableSlide[];
  /** New followers */
  followers: BeginningNotification[];
  /** Quote posts of your content */
  quotePosts: BeginningNotification[];
  /** Replies to your posts */
  replies: BeginningNotification[];
  /** Mentions of you in posts */
  mentions: BeginningNotification[];
}

/** A group of likes/boosts for a single post */
export interface UnactionableGroup {
  /** AT URI of the post that received likes/boosts */
  postUri: string;
  /** Actors who liked this post */
  likers: NotificationActor[];
  /** Actors who boosted/reposted this post */
  boosters: NotificationActor[];
}

/** A single slide showing up to 2 posts of the same interaction type */
export interface UnactionableSlide {
  type: 'like' | 'boost';
  items: Array<{
    postUri: string;
    actors: NotificationActor[];
  }>;
}

export interface BeginningState {
  stage: BeginningStage;
  /** Index within the current serial stage (followers, quotePosts, replies) */
  currentIndex: number;
  /** Grouped notification data */
  items: NotificationsByType;
  /** Whether notifications are still loading */
  isLoading: boolean;
  /** Stages the user has advanced past (for staged chorus population) */
  passedStages: BeginningStage[];
}

/** Maps a Beginning stage to its unique notification actors (for staged chorus population) */
export interface SectionAvatars {
  stage: BeginningStage;
  actors: NotificationActor[];
}

export interface UseBeginningParams {
  agent: Agent | null;
  isAuthenticated: boolean;
  /** Whether tutorial cards should be shown */
  tutorialEnabled?: boolean;
  /** Whether this is a JKLB Premium user (shows curator card first) */
  isPremium?: boolean;
}

export interface UseBeginningReturn {
  /** Current state of the Beginning flow */
  state: BeginningState;
  /** Move forward (j key) */
  advance: () => void;
  /** Move backward (k key) */
  goBack: () => void;
  /** Whether the Beginning flow is complete */
  isDone: boolean;
  /** Whether the L/B tutorial was shown during the Beginning flow (false if no actionable posts) */
  showedActionsTutorial: boolean;
  /** Maps each Beginning stage to its notification actors (for staged chorus population) */
  sectionAvatarMap: SectionAvatars[];
}

// ── Slide building ──────────────────────────────────────────────────

/**
 * Build paginated slides from unactionable groups.
 * Likes first, then boosts. Up to 2 posts per slide.
 * A post that got both likes AND boosts appears in both sections.
 */
function buildUnactionableSlides(groups: UnactionableGroup[]): UnactionableSlide[] {
  const slides: UnactionableSlide[] = [];

  // Collect all posts with likers
  const likeItems = groups
    .filter(g => g.likers.length > 0)
    .map(g => ({ postUri: g.postUri, actors: g.likers }));

  for (let i = 0; i < likeItems.length; i += 2) {
    slides.push({ type: 'like', items: likeItems.slice(i, i + 2) });
  }

  // Collect all posts with boosters
  const boostItems = groups
    .filter(g => g.boosters.length > 0)
    .map(g => ({ postUri: g.postUri, actors: g.boosters }));

  for (let i = 0; i < boostItems.length; i += 2) {
    slides.push({ type: 'boost', items: boostItems.slice(i, i + 2) });
  }

  return slides;
}

// ── Stage ordering ──────────────────────────────────────────────────

/**
 * Build the ordered list of stages to visit, skipping empty ones.
 * Tutorial cards are inserted when enabled.
 */
function buildStageSequence(
  items: NotificationsByType,
  tutorialEnabled: boolean,
  isPremium: boolean = false,
): BeginningStage[] {
  const stages: BeginningStage[] = [];

  // Premium users get the curator card first
  if (isPremium) {
    stages.push('curator');
  }

  // Tutorial cards 1-3 (all at the start, before any notifications)
  if (tutorialEnabled) {
    stages.push('tutorialNav');      // Card 1: Welcome + j/space
    stages.push('tutorialActions');   // Card 2: Philosophy + l/b
    stages.push('tutorialMoreKeys'); // Card 3: q/v/o hotkeys
  }

  // Unactionable (likes & boosts) — skip if no slides
  if (items.unactionableSlides.length > 0) {
    stages.push('unactionable');
  }

  // Followers — skip if empty
  if (items.followers.length > 0) {
    stages.push('follower');
  }

  // Quote posts — skip if empty
  if (items.quotePosts.length > 0) {
    stages.push('quotePost');
  }

  // Replies — skip if empty
  if (items.replies.length > 0) {
    stages.push('reply');
  }

  // Mentions — skip if empty
  if (items.mentions.length > 0) {
    stages.push('mention');
  }

  // Always end with done
  stages.push('done');

  return stages;
}

/**
 * Get the number of items in a serial stage.
 * Non-serial stages (card, tutorial, done) return 1.
 */
function getStageItemCount(stage: BeginningStage, items: NotificationsByType): number {
  switch (stage) {
    case 'unactionable':
      return items.unactionableSlides.length;
    case 'follower':
      return items.followers.length;
    case 'quotePost':
      return items.quotePosts.length;
    case 'reply':
      return items.replies.length;
    case 'mention':
      return items.mentions.length;
    case 'curator':
      return 1; // Single card
    default:
      return 1; // Single-item stages (tutorial, done)
  }
}

// ── Section → avatar mapping (for staged chorus population) ─────────

/**
 * Build a mapping of which notification actors belong to which Beginning stage.
 * Used by the chorus to progressively reveal avatars as the user advances.
 */
function buildSectionAvatarMap(items: NotificationsByType): SectionAvatars[] {
  const map: SectionAvatars[] = [];

  // Unactionable (likes + boosts) — extract unique actors from all groups
  const unactionableActors = new Map<string, NotificationActor>();
  for (const group of items.unactionable) {
    for (const actor of group.likers) {
      unactionableActors.set(actor.did, actor);
    }
    for (const actor of group.boosters) {
      unactionableActors.set(actor.did, actor);
    }
  }
  if (unactionableActors.size > 0) {
    map.push({ stage: 'unactionable', actors: [...unactionableActors.values()] });
  }

  // Followers
  if (items.followers.length > 0) {
    map.push({ stage: 'follower', actors: items.followers.map(f => f.actor) });
  }

  // Quote posts, replies, mentions — each notification's actor
  for (const [stage, notifs] of [
    ['quotePost', items.quotePosts],
    ['reply', items.replies],
    ['mention', items.mentions],
  ] as const) {
    if (notifs.length > 0) {
      const actors = notifs.map(n => n.actor);
      map.push({ stage, actors });
    }
  }

  return map;
}

// ── Notification processing ─────────────────────────────────────────

function processNotifications(
  rawNotifs: AppBskyNotificationListNotifications.Notification[],
  seenAt: string | null,
): NotificationsByType {
  const likes: BeginningNotification[] = [];
  const boosts: BeginningNotification[] = [];
  const followers: BeginningNotification[] = [];
  const quotePosts: BeginningNotification[] = [];
  const replies: BeginningNotification[] = [];
  const mentions: BeginningNotification[] = [];

  for (const notif of rawNotifs) {
    const actor: NotificationActor = {
      did: notif.author.did,
      handle: notif.author.handle,
      displayName: notif.author.displayName,
      avatar: notif.author.avatar,
    };
    const isNew = isNotificationNew(notif.indexedAt, seenAt);
    const base = {
      actor,
      timestamp: notif.indexedAt,
      isNew,
      reasonSubject: notif.reasonSubject,
      uri: notif.uri,
    };

    switch (notif.reason) {
      case 'like':
        likes.push({ ...base, type: 'like' });
        break;
      case 'repost':
        boosts.push({ ...base, type: 'repost' });
        break;
      case 'follow':
        followers.push({ ...base, type: 'follow' });
        break;
      case 'quote':
        quotePosts.push({ ...base, type: 'quote' });
        break;
      case 'reply':
        replies.push({ ...base, type: 'reply' });
        break;
      case 'mention':
        mentions.push({ ...base, type: 'mention' });
        break;
    }
  }

  // Group likes and boosts by the post they reference
  const postMap = new Map<string, UnactionableGroup>();
  for (const like of likes) {
    if (!like.reasonSubject) continue;
    let group = postMap.get(like.reasonSubject);
    if (!group) {
      group = { postUri: like.reasonSubject, likers: [], boosters: [] };
      postMap.set(like.reasonSubject, group);
    }
    group.likers.push(like.actor);
  }
  for (const boost of boosts) {
    if (!boost.reasonSubject) continue;
    let group = postMap.get(boost.reasonSubject);
    if (!group) {
      group = { postUri: boost.reasonSubject, likers: [], boosters: [] };
      postMap.set(boost.reasonSubject, group);
    }
    group.boosters.push(boost.actor);
  }

  const unactionable = Array.from(postMap.values());

  return {
    unactionable,
    unactionableSlides: buildUnactionableSlides(unactionable),
    followers,
    quotePosts,
    replies,
    mentions,
  };
}

// ── Hook ────────────────────────────────────────────────────────────

const EMPTY_ITEMS: NotificationsByType = {
  unactionable: [],
  unactionableSlides: [],
  followers: [],
  quotePosts: [],
  replies: [],
  mentions: [],
};

export function useBeginning({
  agent,
  isAuthenticated,
  tutorialEnabled = true,
  isPremium = false,
}: UseBeginningParams): UseBeginningReturn {
  const [state, setState] = useState<BeginningState>({
    stage: isPremium ? 'curator' : (tutorialEnabled ? 'tutorialNav' : 'unactionable'),
    currentIndex: 0,
    items: EMPTY_ITEMS,
    isLoading: true,
    passedStages: [],
  });

  const hasFetchedRef = useRef(false);
  // Store the stage sequence so advance/goBack can reference it
  const stageSequenceRef = useRef<BeginningStage[]>([]);

  // Fetch notifications on mount
  useEffect(() => {
    if (!agent || !isAuthenticated || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchNotifications = async () => {
      const seenAt = getNotificationsSeenAt();

      try {
        const response = await agent.listNotifications({ limit: 100 });
        const realNotifs = response.data.notifications;

        // Only keep notifications newer than seenAt (skip old ones already seen)
        const newNotifs = seenAt
          ? realNotifs.filter(n => isNotificationNew(n.indexedAt, seenAt))
          : realNotifs;

        // Inject test notifications if flag is on (these always appear as new)
        const fakeNotifs = TEST_NOTIFICATIONS ? getTestNotifications() : [];
        const allNotifs = [
          ...fakeNotifs,
          ...newNotifs,
        ] as AppBskyNotificationListNotifications.Notification[];

        const items = processNotifications(allNotifs, seenAt);
        const sequence = buildStageSequence(items, tutorialEnabled, isPremium);
        stageSequenceRef.current = sequence;

        setState({
          stage: sequence[0],
          currentIndex: 0,
          items,
          isLoading: false,
          passedStages: [],
        });
      } catch (err) {
        console.error('useBeginning: Failed to fetch notifications:', err);
        // On error, skip to done (let user proceed to Middle)
        const sequence = buildStageSequence(EMPTY_ITEMS, tutorialEnabled, isPremium);
        stageSequenceRef.current = sequence;
        setState({
          stage: sequence[0],
          currentIndex: 0,
          items: EMPTY_ITEMS,
          isLoading: false,
          passedStages: [],
        });
      }
    };

    fetchNotifications();
  }, [agent, isAuthenticated, tutorialEnabled, isPremium]);

  // Rebuild stage sequence when tutorialEnabled changes (without re-fetching)
  useEffect(() => {
    if (!hasFetchedRef.current) return; // Haven't fetched yet, nothing to rebuild

    setState(prev => {
      const sequence = buildStageSequence(prev.items, tutorialEnabled, isPremium);
      stageSequenceRef.current = sequence;

      // If currently on a tutorial stage and tutorials just got disabled, advance past it
      const isTutorialStage = prev.stage === 'tutorialNav' || prev.stage === 'tutorialActions' || prev.stage === 'tutorialMoreKeys';
      if (!tutorialEnabled && isTutorialStage) {
        return { ...prev, stage: sequence[0] || 'done', currentIndex: 0 };
      }
      return prev;
    });
  }, [tutorialEnabled, isPremium]);

  // Mark notifications as seen when Beginning flow completes
  // This updates the localStorage seenAt cursor so next reload only shows new notifications
  useEffect(() => {
    if (state.stage === 'done') {
      markNotificationsAsSeen();
    }
  }, [state.stage]);

  // Advance to the next item or stage (j key)
  const advance = useCallback(() => {
    setState(prev => {
      if (prev.stage === 'done') return prev;

      const sequence = stageSequenceRef.current;
      const stageIdx = sequence.indexOf(prev.stage);
      if (stageIdx === -1) return prev;

      const itemCount = getStageItemCount(prev.stage, prev.items);

      // If there are more items in this serial stage, advance within it
      if (prev.currentIndex < itemCount - 1) {
        return { ...prev, currentIndex: prev.currentIndex + 1 };
      }

      // Otherwise, move to the next stage
      const nextStageIdx = stageIdx + 1;
      if (nextStageIdx >= sequence.length) return prev;

      return {
        ...prev,
        stage: sequence[nextStageIdx],
        currentIndex: 0,
        // Track that we've passed this stage (for staged chorus population)
        passedStages: prev.passedStages.includes(prev.stage)
          ? prev.passedStages
          : [...prev.passedStages, prev.stage],
      };
    });
  }, []);

  // Go back to the previous item or stage (k key)
  const goBack = useCallback(() => {
    setState(prev => {
      const sequence = stageSequenceRef.current;
      const stageIdx = sequence.indexOf(prev.stage);
      if (stageIdx === -1) return prev;

      // If there are previous items in this serial stage, go back within it
      if (prev.currentIndex > 0) {
        return { ...prev, currentIndex: prev.currentIndex - 1 };
      }

      // Otherwise, move to the previous stage
      const prevStageIdx = stageIdx - 1;
      if (prevStageIdx < 0) return prev; // Already at start

      const prevStage = sequence[prevStageIdx];
      const prevItemCount = getStageItemCount(prevStage, prev.items);

      return {
        ...prev,
        stage: prevStage,
        // Go to the last item of the previous stage
        currentIndex: prevItemCount - 1,
      };
    });
  }, []);

  // Check if the tutorialActions stage is in the sequence (i.e., was shown during Beginning)
  const showedActionsTutorial = stageSequenceRef.current.includes('tutorialActions');

  // Derive section→avatar mapping from notification items (recomputes only when items change)
  const sectionAvatarMap = useMemo(() => buildSectionAvatarMap(state.items), [state.items]);

  return {
    state,
    advance,
    goBack,
    isDone: state.stage === 'done',
    showedActionsTutorial,
    sectionAvatarMap,
  };
}
