/**
 * Tutorial content registry - single source of truth for all tutorial card content.
 *
 * Each entry maps a tutorial ID to its title and message.
 * Used by TutorialCard in BeginningView, AppLayout (middleTutorial), and anywhere
 * else a tutorial card needs to be rendered.
 *
 * To add a new tutorial, just add an entry here and reference its key.
 */

import type { StageView } from '../types/viewState';

export interface TutorialContent {
  title: string;
  message: string;
}

export const TUTORIAL_CONTENT: Record<string, TutorialContent> = {
  /** Card 1: Welcome — introduces j navigation and space for hotkeys */
  nav: {
    title: 'Welcome to jklb.social!',
    message: 'First (& only) thing you need to know:\n[j] to go forward.\n[space] to see all hotkeys',
  },

  /** Card 2: Philosophy — reducing friction to sociable behaviors, introduces l/b */
  actions: {
    title: '',
    message: 'jklb.social is about reducing friction to sociable behaviors and increasing friction to mindless scrolling. It\'s as easy to like a post as it is to see the next post. Consider liking more posts!\n\n[l] likes a post\n[b] boosts (reposts)\n(why not [r] for re-post? Because [r] is for reply)',
  },

  /** Card 3: More keys — q, v, o hotkeys */
  moreKeys: {
    title: '',
    message: 'You can [q] to quote-post\nYou can [v] to view any post on Bluesky\n[o] opens hyperlinks',
  },

} as const;

export interface TutorialCardDef {
  id: string;
  phase: 'beginning' | 'middle' | 'end';
  title: string;
  body: string;
  placement: 'beforeAll' | 'beforeActionable';
}

export const tutorials: TutorialCardDef[] = [
  {
    id: 'nav',
    phase: 'beginning',
    title: 'Welcome to jklb.social!',
    body: 'First (& only) thing you need to know: [j] to go forward.',
    placement: 'beforeAll',
  },
  {
    id: 'actions',
    phase: 'beginning',
    title: '',
    body: 'Philosophy + like/boost intro',
    placement: 'beforeAll',
  },
  {
    id: 'moreKeys',
    phase: 'beginning',
    title: '',
    body: 'More hotkeys: q, v, o',
    placement: 'beforeAll',
  },
];

export function getTutorialPhase(id: string): 'beginning' | 'middle' | 'end' {
  const card = tutorials.find(t => t.id === id);
  return card?.phase ?? 'beginning';
}

export function getPhase(stage: StageView): 'beginning' | 'middle' | 'end' {
  switch (stage.type) {
    case 'tutorial':
      return getTutorialPhase(stage.id);
    case 'unactionable':
    case 'follower':
    case 'reply-to-user':
    case 'mention':
    case 'quote-post':
      return 'beginning';
    case 'middle-card':
    case 'post':
    case 'thread':
      return 'middle';
    case 'end-grid':
    case 'atmosphere':
    case 'liked-posts-grid':
    case 'share':
    case 'end-stats':
    case 'participation-claim':
    case 'participation-share':
    case 'award-nominate':
    case 'trophy-case':
      return 'end';
  }
}
