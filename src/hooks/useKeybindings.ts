/**
 * useKeybindings - Centralized keyboard shortcut handler
 *
 * Always active. Reads ViewState to determine which keys are valid.
 * See specs/keybindings.md for the full key map.
 *
 * Panel stack: when a panel is open, j/k close it first then navigate.
 * Action keys (l/b/r/o/f) close the panel without executing.
 * See specs/app-architecture.md for the stack model.
 */

import { useEffect, useCallback } from 'react';
import type { ViewState } from '../types';
import { getPhase } from '../lib/tutorials';

interface UseKeybindingsOptions {
  /** ViewState — determines which keys are active */
  viewState: ViewState;
  /** Whether media fullscreen is currently active */
  isMediaFullscreen?: boolean;
  /** Whether the current post has media that can go fullscreen */
  currentPostHasMedia?: boolean;
  /** Whether focus is on the quoted post */
  isFocusedOnQuote?: boolean;
  /** Arrow key navigation within thread view */
  onThreadNavigate?: (direction: -1 | 1) => void;
  /** j — next in flow */
  onNextPost?: () => void;
  /** k — previous in flow */
  onPreviousPost?: () => void;
  /** Reset focus target on post change */
  onPostChange?: () => void;
  /** Enter on quoted post — drill in */
  onDrillIn?: () => void;
  /** Enter on media — toggle fullscreen */
  onToggleFullscreen?: () => void;
  /** t — enter thread view */
  onEnterThreadView?: () => void;
  /** t — exit thread view */
  onExitThreadView?: () => void;
  /** Exit fullscreen only (Escape in fullscreen) */
  onExitFullscreen?: () => void;
  /** Escape — close panels, exit thread, dismiss modals */
  onEscape?: () => void;
  /** Close just the ViewState panel (for panel stack j/k pop) */
  onClosePanel?: () => void;
  /** l — like */
  onLike?: () => void;
  /** r — reply */
  onReply?: () => void;
  /** b — boost */
  onBoost?: () => void;
  /** o — open link */
  onOpen?: () => void;
  /** Shift+O — cycle to next link */
  onCycleLink?: () => void;
  /** Shift+J — focus on quoted post (go deeper) */
  onFocusQuote?: () => void;
  /** Shift+K — unfocus quoted post (go back up) */
  onUnfocusQuote?: () => void;
  /** u — unfollow */
  onUnfollow?: () => void;
  /** f — follow/unfollow */
  onFollow?: () => void;
  /** v — view on Bluesky */
  onViewOnBluesky?: () => void;
  /** Space — toggle hotkeys panel */
  onShowHotkeys?: () => void;
  /** s — toggle settings panel */
  onSettings?: () => void;
  /** q — quote post */
  onQuote?: () => void;
  /** ? — save post to clipboard */
  onSavePost?: () => void;
  /** c — toggle cover photo z-index */
  onToggleCoverPhoto?: () => void;
  /** e — jump to ending */
  onEnd?: () => void;
}

/**
 * Check if the event target is an input element where we should ignore keybindings
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

export function useKeybindings(options: UseKeybindingsOptions): void {
  const {
    viewState,
    isMediaFullscreen = false,
    currentPostHasMedia = false,
    isFocusedOnQuote = false,
    onThreadNavigate,
    onNextPost,
    onPreviousPost,
    onPostChange,
    onDrillIn,
    onToggleFullscreen,
    onEnterThreadView,
    onExitThreadView,
    onExitFullscreen,
    onEscape,
    onClosePanel,
    onLike,
    onReply,
    onBoost,
    onOpen,
    onCycleLink,
    onFocusQuote,
    onUnfocusQuote,
    onUnfollow,
    onFollow,
    onViewOnBluesky,
    onShowHotkeys,
    onSettings,
    onQuote,
    onSavePost,
    onToggleCoverPhoto,
    onEnd,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isInThreadView = viewState.stage.type === 'thread';
      const phase = getPhase(viewState.stage);
      const panelOpen = viewState.panel !== null;

      // ── Escape: always works, even in inputs ──────────────
      if (event.key === 'Escape') {
        if (isMediaFullscreen && onExitFullscreen) {
          event.preventDefault();
          onExitFullscreen();
          return;
        }
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      // ── Backspace/Delete: same as Escape except in inputs ─
      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (isInputElement(event.target)) return;
        if (isMediaFullscreen && onExitFullscreen) {
          event.preventDefault();
          onExitFullscreen();
          return;
        }
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      // Don't handle other keys in inputs
      if (isInputElement(event.target)) return;

      // ── Always active (any state, any phase) ──────────────
      if (event.key === ' ') {
        if (onShowHotkeys) {
          event.preventDefault();
          onShowHotkeys();
        }
        return;
      }
      if (event.key === 's') {
        if (onSettings) {
          event.preventDefault();
          onSettings();
        }
        return;
      }
      if (event.key === '?') {
        if (onSavePost) {
          event.preventDefault();
          onSavePost();
        }
        return;
      }
      if (event.key === ';') {
        event.preventDefault();
        document.dispatchEvent(new Event('toggleVideoSound'));
        return;
      }

      // ── Panel stack behavior ──────────────────────────────
      // When a panel is open, j/k close it then navigate.
      // Action keys close the panel without executing.
      if (panelOpen) {
        if (event.key === 'j' || event.key === 'ArrowDown') {
          event.preventDefault();
          onClosePanel?.();
          onNextPost?.();
          onPostChange?.();
          return;
        }
        if (event.key === 'k' || event.key === 'ArrowUp') {
          event.preventDefault();
          onClosePanel?.();
          onPreviousPost?.();
          onPostChange?.();
          return;
        }
        // Action keys close panel without executing
        if ('lbroqfu'.includes(event.key)) {
          event.preventDefault();
          onClosePanel?.();
          return;
        }
        // Other keys swallowed when panel is open
        return;
      }

      // ── End flow stages have their own key handlers — bail out ──
      if (phase === 'end') return;

      // ── No panel — navigation and actions ─────────────────
      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          // In thread view, ArrowDown navigates within thread
          if (event.key === 'ArrowDown' && isInThreadView && onThreadNavigate) {
            event.preventDefault();
            onThreadNavigate(1);
            break;
          }
          // Don't handle arrow in fullscreen (reserved for gallery nav)
          if (event.key === 'ArrowDown' && isMediaFullscreen) break;
          // j exits fullscreen + navigates
          if (isMediaFullscreen && onExitFullscreen) {
            event.preventDefault();
            onExitFullscreen();
            onNextPost?.();
            onPostChange?.();
            break;
          }
          if (onNextPost) {
            event.preventDefault();
            onNextPost();
            onPostChange?.();
          }
          break;

        case 'k':
        case 'ArrowUp':
          if (event.key === 'ArrowUp' && isInThreadView && onThreadNavigate) {
            event.preventDefault();
            onThreadNavigate(-1);
            break;
          }
          if (event.key === 'ArrowUp' && isMediaFullscreen) break;
          if (isMediaFullscreen && onExitFullscreen) {
            event.preventDefault();
            onExitFullscreen();
            onPreviousPost?.();
            onPostChange?.();
            break;
          }
          if (onPreviousPost) {
            event.preventDefault();
            onPreviousPost();
            onPostChange?.();
          }
          break;

        case 'Enter':
          // Fullscreen media toggle
          if (currentPostHasMedia && !isFocusedOnQuote && onToggleFullscreen) {
            event.preventDefault();
            onToggleFullscreen();
          } else if (isFocusedOnQuote && onDrillIn) {
            event.preventDefault();
            onDrillIn();
          }
          break;

        case 't':
        case 'T':
          // Thread view toggle (middle phase only)
          if (phase === 'middle') {
            if (isInThreadView && onExitThreadView) {
              event.preventDefault();
              onExitThreadView();
            } else if (!isInThreadView && onEnterThreadView) {
              event.preventDefault();
              onEnterThreadView();
            }
          }
          break;

        case 'e':
          // Jump to ending (middle phase only)
          if (phase === 'middle' && onEnd) {
            event.preventDefault();
            onEnd();
          }
          break;

        case 'c':
          // Toggle cover photo (middle + beginning phases)
          if ((phase === 'middle' || phase === 'beginning') && onToggleCoverPhoto) {
            event.preventDefault();
            onToggleCoverPhoto();
          }
          break;

        // Action keys — callbacks determine availability per phase
        case 'l':
          if (onLike) { event.preventDefault(); onLike(); }
          break;
        case 'b':
          if (onBoost) { event.preventDefault(); onBoost(); }
          break;
        case 'r':
          if (onReply) { event.preventDefault(); onReply(); }
          break;
        case 'q':
          if (onQuote) { event.preventDefault(); onQuote(); }
          break;
        case 'o':
          if (onOpen) { event.preventDefault(); onOpen(); }
          break;
        case 'O':
          // Shift+O cycles to next link
          if (onCycleLink) { event.preventDefault(); onCycleLink(); }
          break;
        case 'J':
          // Shift+J — focus on quoted post (go deeper)
          if (onFocusQuote) { event.preventDefault(); onFocusQuote(); }
          break;
        case 'K':
          // Shift+K — unfocus quoted post (go back up)
          if (onUnfocusQuote) { event.preventDefault(); onUnfocusQuote(); }
          break;
        case 'f':
          if (onFollow) { event.preventDefault(); onFollow(); }
          break;
        case 'v':
          if (onViewOnBluesky) { event.preventDefault(); onViewOnBluesky(); }
          break;
        case 'u':
          if (onUnfollow) { event.preventDefault(); onUnfollow(); }
          break;
      }
    },
    [viewState, isMediaFullscreen, currentPostHasMedia, isFocusedOnQuote,
     onThreadNavigate, onNextPost, onPreviousPost, onPostChange,
     onDrillIn, onToggleFullscreen, onEnterThreadView, onExitThreadView,
     onExitFullscreen, onEscape, onClosePanel,
     onLike, onReply, onBoost, onQuote, onOpen, onCycleLink, onFocusQuote, onUnfocusQuote, onUnfollow, onFollow,
     onViewOnBluesky, onShowHotkeys, onSettings, onSavePost,
     onToggleCoverPhoto, onEnd]
  );

  // Always active — no enabled gate
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
