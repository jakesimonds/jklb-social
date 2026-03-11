/**
 * useEndFlow - State machine for the End flow.
 *
 * Grid-based navigation: the End screen shows a button grid.
 * Each button either performs an instant action or opens a sub-flow
 * that renders inside an EndSubFlowWrapper.
 *
 * Stages: grid → (award-liked → award-share) | stats | atmosphere
 * Sub-flows return to grid via returnToGrid().
 */

import { useState, useCallback } from 'react';
import type { LikedPost } from '../types';

/** Top-level: grid or a sub-flow */
export type EndFlowStage = 'grid' | 'award-liked' | 'award-share' | 'stats' | 'atmosphere' | 'participation-claim' | 'award-nominate' | 'trophy-case';

export interface EndFlowState {
  stage: EndFlowStage;
  selectedPost: LikedPost | null;
  isActive: boolean;
  /** Keyboard-highlighted button index on the grid (0-8), null if none */
  highlightedIndex: number | null;
}

export interface UseEndFlowReturn {
  state: EndFlowState;
  /** Enter the End flow — goes straight to grid */
  enter: () => void;
  /** Open a sub-flow by button id */
  openSubFlow: (id: string) => void;
  /** Return to the grid from any sub-flow */
  returnToGrid: () => void;
  /** Advance within the award sub-flow (liked → share) */
  advanceAward: () => void;
  /** Go back within the award sub-flow (share → liked, liked → grid) */
  goBackAward: () => void;
  /** Select/deselect a liked post */
  selectPost: (post: LikedPost | null) => void;
  /** Exit the End flow entirely */
  exit: () => void;
  /** Set keyboard-highlighted index on grid */
  setHighlightedIndex: (index: number | null) => void;
}

export function useEndFlow(): UseEndFlowReturn {
  const [state, setState] = useState<EndFlowState>({
    stage: 'grid',
    selectedPost: null,
    isActive: false,
    highlightedIndex: null,
  });

  const enter = useCallback(() => {
    setState({
      stage: 'grid',
      selectedPost: null,
      isActive: true,
      highlightedIndex: 0,
    });
  }, []);

  const openSubFlow = useCallback((id: string) => {
    setState(prev => {
      if (!prev.isActive) return prev;
      switch (id) {
        case 'award':               return { ...prev, stage: 'award-liked' as const };
        case 'stats':               return { ...prev, stage: 'stats' as const };
        case 'atmosphere':          return { ...prev, stage: 'atmosphere' as const };
        case 'participation-claim':  return { ...prev, stage: 'participation-claim' as const };
        case 'award-nominate':      return { ...prev, stage: 'award-nominate' as const };
        case 'trophy-case':         return { ...prev, stage: 'trophy-case' as const };
        // 'another', 'logout', 'clipboard' are instant actions handled by App.tsx
        default:            return prev;
      }
    });
  }, []);

  const returnToGrid = useCallback(() => {
    setState(prev => ({
      ...prev,
      stage: 'grid' as const,
      highlightedIndex: 0,
    }));
  }, []);

  const advanceAward = useCallback(() => {
    setState(prev => {
      if (prev.stage === 'award-liked') return { ...prev, stage: 'award-share' as const };
      return prev;
    });
  }, []);

  const goBackAward = useCallback(() => {
    setState(prev => {
      if (prev.stage === 'award-share') return { ...prev, stage: 'award-liked' as const };
      if (prev.stage === 'award-liked') return { ...prev, stage: 'grid' as const, highlightedIndex: 0 };
      return prev;
    });
  }, []);

  const selectPost = useCallback((post: LikedPost | null) => {
    setState(prev => ({ ...prev, selectedPost: post }));
  }, []);

  const exit = useCallback(() => {
    setState({
      stage: 'grid',
      selectedPost: null,
      isActive: false,
      highlightedIndex: null,
    });
  }, []);

  const setHighlightedIndex = useCallback((index: number | null) => {
    setState(prev => ({ ...prev, highlightedIndex: index }));
  }, []);

  return {
    state,
    enter,
    openSubFlow,
    returnToGrid,
    advanceAward,
    goBackAward,
    selectPost,
    exit,
    setHighlightedIndex,
  };
}
