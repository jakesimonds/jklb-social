/**
 * BeginningView - Renders the current Beginning stage content.
 *
 * j/k navigation is handled by useKeybindings in App.tsx (phase-aware).
 * Action keys (l/b/f/v) are routed through setBeginningActions → useKeybindings.
 * This component only delegates rendering to the appropriate component for each stage type.
 */

import type { Agent } from '@atproto/api';
import type { BeginningState } from '../../hooks/useBeginning';
import type { Post } from '../../types';
import { TutorialCard } from '../TutorialCard';
import { TUTORIAL_CONTENT } from '../../lib/tutorials';
import { UnactionableItemsView } from './UnactionableItemsView';
import { NewFollowerCard } from './NewFollowerCard';
import { BeginningPostCard } from './BeginningPostCard';

interface BeginningViewProps {
  state: BeginningState;
  advance: () => void;
  goBack: () => void;
  agent: Agent;
  /** Setter for beginning component action handlers (like/boost/follow/reply) routed through useKeybindings */
  setBeginningActions?: (actions: {
    like?: () => void;
    boost?: () => void;
    follow?: () => void;
    viewOnBluesky?: () => void;
    reply?: () => void;
  } | null) => void;
  /** Reply handler — opens composer with the given post */
  onReplyToPost?: (post: Post) => void;
}

export function BeginningView({ state, advance, goBack: _goBack, agent, setBeginningActions, onReplyToPost }: BeginningViewProps) {
  // j/k keys are handled by useKeybindings in App.tsx (phase-aware effectiveGoToNext/Prev)
  // Action keys (l/b/f/v) are registered by child components via setBeginningActions

  if (state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <svg className="animate-spin h-10 w-10 text-[var(--memphis-pink)] mb-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-[var(--memphis-text-muted)] text-sm">Loading notifications...</p>
      </div>
    );
  }

  switch (state.stage) {
    case 'tutorialNav':
      return (
        <TutorialCard
          title={TUTORIAL_CONTENT.nav.title}
          message={TUTORIAL_CONTENT.nav.message}
          onAdvance={advance}
          handleKeys={false}
        />
      );

    case 'unactionable':
      return (
        <UnactionableItemsView
          slides={state.items.unactionableSlides}
          currentIndex={state.currentIndex}
          agent={agent}
        />
      );

    case 'follower':
      return (
        <NewFollowerCard
          follower={state.items.followers[state.currentIndex]}
          agent={agent}
          index={state.currentIndex}
          total={state.items.followers.length}
          setBeginningActions={setBeginningActions}
        />
      );

    case 'tutorialActions':
      return (
        <TutorialCard
          title={TUTORIAL_CONTENT.actions.title}
          message={TUTORIAL_CONTENT.actions.message}
          onAdvance={advance}
          handleKeys={false}
        />
      );

    case 'quotePost':
      return (
        <BeginningPostCard
          notification={state.items.quotePosts[state.currentIndex]}
          agent={agent}
          index={state.currentIndex}
          total={state.items.quotePosts.length}
          sectionLabel="you've been quote posted"
          accentColor="var(--memphis-yellow)"
          setBeginningActions={setBeginningActions}
          onReplyToPost={onReplyToPost}
        />
      );

    case 'reply':
      return (
        <BeginningPostCard
          notification={state.items.replies[state.currentIndex]}
          agent={agent}
          index={state.currentIndex}
          total={state.items.replies.length}
          sectionLabel="your post got a reply"
          accentColor="var(--memphis-cyan)"
          setBeginningActions={setBeginningActions}
          onReplyToPost={onReplyToPost}
        />
      );

    case 'mention':
      return (
        <BeginningPostCard
          notification={state.items.mentions[state.currentIndex]}
          agent={agent}
          index={state.currentIndex}
          total={state.items.mentions.length}
          sectionLabel="somebody's ears are burning"
          accentColor="var(--memphis-pink)"
          setBeginningActions={setBeginningActions}
          onReplyToPost={onReplyToPost}
        />
      );

    case 'done':
      return null;

    default:
      return null;
  }
}
