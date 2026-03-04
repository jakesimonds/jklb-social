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
  /** First thing the user sees — introduces j/k navigation. Empty title signals TutorialCard to use styled j/k button layout. */
  nav: {
    title: '',
    message: 'Press J to go forward, K to go back',
  },

  /** Shown before the first actionable post — introduces l/b actions */
  actions: {
    title: 'Actions',
    message: 'For posts: L to like, B to boost',
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
    title: '',
    body: 'Press J to go forward, K to go back',
    placement: 'beforeAll',
  },
  {
    id: 'actions',
    phase: 'beginning',
    title: 'Actions',
    body: 'For posts: L to like, B to boost',
    placement: 'beforeActionable',
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
      return 'end';
  }
}
