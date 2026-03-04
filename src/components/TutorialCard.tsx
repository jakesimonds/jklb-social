/**
 * TutorialCard - Full-screen instructional card that teaches the user a concept.
 *
 * Layout:
 * 1. Top: "Tutorial" header (large, dark text like SectionCard titles)
 * 2. Subtitle: "go to settings (hotkey: s) to toggle off these messages"
 * 3. Center: Bordered wireframe box containing title + message content
 * Background: graph-paper grid applied by the stage container (AppLayout) when tutorial is active
 *
 * j key advances past the card, k key goes back.
 */

import { useEffect, useCallback } from 'react';

interface TutorialCardProps {
  message: string;
  title?: string;
  onAdvance: () => void;
  /** Called when user presses k to go back */
  onGoBack?: () => void;
  /** Whether to register own j/k key handler. Set false when parent handles keys. */
  handleKeys?: boolean;
}

export function TutorialCard({ message, title, onAdvance, onGoBack, handleKeys = true }: TutorialCardProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'j') {
        e.preventDefault();
        onAdvance();
      }
      if (e.key === 'k' && onGoBack) {
        e.preventDefault();
        onGoBack();
      }
    },
    [onAdvance, onGoBack]
  );

  useEffect(() => {
    if (!handleKeys) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeys, handleKeyDown]);

  return (
    <div
      className="flex flex-col h-full w-full px-6 py-8"
    >
      {/* Header: "Tutorial" — large, like SectionCard titles but neutral text color */}
      <h1
        className="text-5xl font-bold tracking-tight mb-2 text-center"
        style={{ color: 'var(--memphis-text)' }}
      >
        Tutorial
      </h1>

      {/* Subtitle — muted hint about toggling tutorials off */}
      <p className="text-sm text-center mb-10" style={{ color: 'var(--memphis-text-muted)' }}>
        go to settings (hotkey: s) to toggle off these messages
      </p>

      {/* Center: Bordered wireframe box with tutorial content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          className="flex flex-col items-center justify-center px-8 py-10 w-full max-w-md"
          style={{
            border: '1.5px solid var(--memphis-text)',
            borderRadius: '4px',
            backgroundColor: 'color-mix(in srgb, var(--memphis-bg) 85%, transparent)',
          }}
        >
          {title ? (
            <>
              {/* Content title (e.g. "Actions") */}
              <h2
                className="text-3xl font-bold tracking-tight mb-4 text-center"
                style={{ color: 'var(--memphis-cyan)' }}
              >
                {title}
              </h2>
              {/* Message text */}
              <p
                className="text-lg text-center leading-relaxed"
                style={{ color: 'var(--memphis-text)' }}
              >
                {message}
              </p>
            </>
          ) : (
            /* Nav tutorial: styled j/k key buttons */
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <kbd className="px-3 py-1.5 rounded border-2 border-[var(--memphis-pink)] text-[var(--memphis-pink)] font-mono font-bold text-lg">
                  j
                </kbd>
                <span className="text-lg" style={{ color: 'var(--memphis-text)' }}>to go forward</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-3 py-1.5 rounded border-2 border-[var(--memphis-cyan)] text-[var(--memphis-cyan)] font-mono font-bold text-lg">
                  k
                </kbd>
                <span className="text-lg" style={{ color: 'var(--memphis-text)' }}>to go back</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="pt-4 pb-2 flex justify-center">
        <span className="text-sm text-[var(--memphis-text-muted)]">
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--memphis-pink)] text-[var(--memphis-pink)] text-xs">
            j
          </kbd>
          {' '}to continue
        </span>
      </div>
    </div>
  );
}
