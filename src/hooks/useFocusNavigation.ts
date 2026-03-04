/**
 * useFocusNavigation - Hook for keyboard-driven focus between main post and quoted post
 *
 * Phase 10 simplified layout: One PostCard that may contain a nested quoted post.
 * Tab key toggles focus between 'main' (the main post) and 'quote' (the quoted post).
 *
 * Focus targets:
 * - 'main': The main post content (text, media, actions)
 * - 'quote': The quoted/embedded post content (if present)
 *
 * When a post has no quoted content, focus stays on 'main'.
 * Arrow keys are no longer used for navigation (removed from Phase 10 design).
 *
 * Note: j/k keys for timeline navigation are handled by useKeybindings.
 */

import { useState, useEffect, useCallback } from 'react';

/** Focus can be on the main post or the quoted post */
export type FocusTarget = 'main' | 'quote';

interface UseFocusNavigationOptions {
  /** Whether navigation is enabled (default: true) */
  enabled?: boolean;
  /** Whether the current post has a quoted post that can be focused */
  hasQuotedPost?: boolean;
}

interface UseFocusNavigationReturn {
  /** Which content is currently focused: 'main' or 'quote' */
  focusTarget: FocusTarget;
  /** Toggle focus between main and quote (Tab key) */
  toggleFocus: () => void;
  /** Reset focus to main post (called when navigating to new post) */
  resetFocus: () => void;
  /** Focus on the quoted post (Shift+J — go deeper) */
  focusQuote: () => void;
  /** Unfocus quoted post, back to main (Shift+K — go back up) */
  unfocusQuote: () => void;
  /** @deprecated Use focusTarget instead. Kept for backward compatibility during transition. */
  highlightedSlot: number;
  /** @deprecated Use resetFocus instead */
  resetHighlight: () => void;
}

export function useFocusNavigation(
  options: UseFocusNavigationOptions = {}
): UseFocusNavigationReturn {
  const { hasQuotedPost = false } = options;

  // Focus target: 'main' or 'quote'
  const [focusTarget, setFocusTarget] = useState<FocusTarget>('main');

  // Reset focus to main post
  const resetFocus = useCallback(() => {
    setFocusTarget('main');
  }, []);

  // Toggle between main and quote (only if quote exists)
  const toggleFocus = useCallback(() => {
    if (!hasQuotedPost) return; // Can't toggle if no quoted post
    setFocusTarget((current) => (current === 'main' ? 'quote' : 'main'));
  }, [hasQuotedPost]);

  // Directional focus: Shift+J goes deeper into quoted post
  const focusQuote = useCallback(() => {
    if (!hasQuotedPost) return;
    setFocusTarget('quote');
  }, [hasQuotedPost]);

  // Directional focus: Shift+K goes back up to main post
  const unfocusQuote = useCallback(() => {
    setFocusTarget('main');
  }, []);

  // Compute effective focus target - if no quoted post exists, always focus main
  // This avoids the lint warning about synchronous setState in useEffect
  const effectiveFocusTarget: FocusTarget = hasQuotedPost ? focusTarget : 'main';

  // Tab key handler - toggle focus between main post and quoted post
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Tab when there's a quoted post to toggle to
      if (!hasQuotedPost) return;

      // Don't handle Tab in input fields (let normal tab behavior work)
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
          return;
        }
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        setFocusTarget((current) => (current === 'main' ? 'quote' : 'main'));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasQuotedPost]);

  // Map focusTarget to highlightedSlot for backward compatibility with old API
  // 'main' → 2, 'quote' → 3 (legacy slot numbers from old 6-slot grid architecture)
  const highlightedSlot = effectiveFocusTarget === 'main' ? 2 : 3;

  return {
    focusTarget: effectiveFocusTarget,
    toggleFocus,
    resetFocus,
    focusQuote,
    unfocusQuote,
    // Backward compatibility
    highlightedSlot,
    resetHighlight: resetFocus,
  };
}
