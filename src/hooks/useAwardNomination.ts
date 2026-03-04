// Hook for triggering award nomination prompts after viewing N posts
// Tracks posts viewed and triggers prompt when threshold is reached

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../lib/SettingsContext';
import { getCurrentSession, resetPostsViewed } from '../lib/session';

interface UseAwardNominationOptions {
  enabled: boolean;
  currentPostIndex: number;
}

interface UseAwardNominationReturn {
  showAwardModal: boolean;
  awardPrompt: string;
  onSaveAward: (entry: string) => void;
  onSkipAward: () => void;
  /** Progress ratio (0 to 1) for the progress bar */
  progress: number;
}

/**
 * Hook that tracks posts viewed and triggers award nomination prompt after N posts
 *
 * - Respects settings.credibleExitEnabled toggle (disables feature entirely if false)
 * - Triggers after settings.credibleExit.postsBeforePrompt posts viewed
 * - Only triggers once per threshold (not repeatedly)
 * - Tracks posts viewed via session metrics
 * - On skip: resets postsViewed counter to 0 so prompt triggers again after N more posts
 * - Exposes progress (0-1) for the always-visible progress bar
 */
export function useAwardNomination({
  enabled,
  currentPostIndex,
}: UseAwardNominationOptions): UseAwardNominationReturn {
  const { settings } = useSettings();
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [postsViewed, setPostsViewed] = useState(0);

  // Track how many times we've prompted (to handle multiple thresholds)
  // e.g., if threshold=20 and postsViewed=40, promptCount should be 2
  const promptCountRef = useRef(0);

  // Track previous postsBeforePrompt to detect budget changes
  const prevPostsBeforePromptRef = useRef(settings.credibleExit.postsBeforePrompt);

  // Reset promptCountRef when budget changes
  useEffect(() => {
    const prevBudget = prevPostsBeforePromptRef.current;
    const currentBudget = settings.credibleExit.postsBeforePrompt;

    prevPostsBeforePromptRef.current = currentBudget;

    if (prevBudget !== currentBudget) {
      promptCountRef.current = 0;
    }
  }, [settings.credibleExit.postsBeforePrompt]);

  // Check if we should show the award nomination prompt based on postsViewed
  // NOTE: We only READ postsViewed here - useFeed.ts owns incrementing the counter
  useEffect(() => {
    // Not authenticated — reset everything
    if (!enabled) {
      setPostsViewed(0);
      setShowAwardModal(false);
      promptCountRef.current = 0;
      return;
    }

    // Read current session to get postsViewed (incremented by useFeed)
    const session = getCurrentSession();
    if (!session) {
      // Session cleared (logout) — reset progress bar
      setPostsViewed(0);
      setShowAwardModal(false);
      promptCountRef.current = 0;
      return;
    }

    const viewed = session.metrics.postsViewed;
    const threshold = settings.credibleExit.postsBeforePrompt;

    // Update postsViewed state for progress bar
    setPostsViewed(viewed);

    // Calculate which prompt threshold we should have reached
    const expectedPromptCount = Math.floor(viewed / threshold);

    // If we've crossed a new threshold and haven't shown the prompt yet
    if (expectedPromptCount > promptCountRef.current && viewed > 0) {
      promptCountRef.current = expectedPromptCount;

      // Schedule modal display using queueMicrotask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setShowAwardModal(true);
      });
    }
  }, [enabled, currentPostIndex, settings.credibleExit.postsBeforePrompt]);

  // Handle saving an award nomination entry
  const onSaveAward = useCallback((_entry: string) => {
    setShowAwardModal(false);
  }, []);

  // Handle skipping the award nomination prompt
  const onSkipAward = useCallback(() => {
    setShowAwardModal(false);
    resetPostsViewed();
    promptCountRef.current = 0;
    setPostsViewed(0);
  }, []);

  const threshold = settings.credibleExit.postsBeforePrompt;
  const progress = threshold > 0
    ? Math.min(postsViewed / threshold, 1)
    : 0;

  return {
    showAwardModal,
    awardPrompt: settings.credibleExit.prompt,
    onSaveAward,
    onSkipAward,
    progress,
  };
}
