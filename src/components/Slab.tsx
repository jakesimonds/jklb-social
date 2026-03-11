/**
 * Slab - A wrapper component that replaces overlay modals
 *
 * Renders in the same position as PostCard (centered, max-width 600px)
 * with Memphis styling. Used for Settings, Hotkeys, Journal, Stats,
 * Explanation, and Composers.
 *
 * Features:
 * - Solid background (no transparency issues)
 * - Optional title header
 * - Built-in close button (X) in top-right
 * - Esc/Delete key handling to close
 * - Same border treatment as PostCard (Memphis pink)
 */

import { useEffect, useCallback } from 'react';

interface SlabProps {
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
  /** Hide the X button and Esc/Delete key handler */
  hideClose?: boolean;
  /** Optional accent color (CSS value) for border, shadow, and title */
  accentColor?: string;
}

const noop = () => {};

export function Slab({ children, title, onClose = noop, hideClose, accentColor }: SlabProps) {
  // Handle Escape and Delete keys to close the panel
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (hideClose) return;
      if (event.key === 'Escape' || event.key === 'Delete') {
        event.preventDefault();
        onClose();
      }
    },
    [onClose, hideClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <article
      className={`
        border-2 ${accentColor ? '' : 'border-[var(--memphis-pink)]'}
        bg-[var(--memphis-surface,var(--memphis-bg))]
        flex flex-col max-h-full overflow-hidden
        ${accentColor ? '' : 'shadow-lg shadow-[var(--memphis-pink)]/20'}
      `}
      style={{
        borderRadius: 'var(--card-radius)',
        ...(accentColor ? {
          borderColor: accentColor,
          boxShadow: `0 10px 15px -3px color-mix(in srgb, ${accentColor} 20%, transparent)`,
        } : {}),
      }}
    >
      {/* Header with optional title and close button */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5 flex-shrink-0">
        {title ? (
          <h2
            className={`text-sm font-semibold ${accentColor ? '' : 'text-[var(--memphis-cyan)]'}`}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {title}
          </h2>
        ) : (
          <span />
        )}
        {!hideClose && (
          <button
            onClick={onClose}
            className="
              w-7 h-7 flex items-center justify-center
              rounded-full
              text-white/50 hover:text-white
              hover:bg-white/10
              transition-colors
            "
            aria-label="Close"
            title="Close (Esc)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </header>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {children}
      </div>
    </article>
  );
}
