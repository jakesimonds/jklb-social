/**
 * TutorialCard - Full-screen instructional card that teaches the user a concept.
 *
 * Layout:
 * 1. Top: "Tutorial" header (large, dark text like SectionCard titles)
 * 2. Subtitle: "go to settings (hotkey: s) to toggle off these messages"
 * 3. Center: Bordered wireframe box containing tutorial-specific content
 * Background: graph-paper grid applied by the stage container (AppLayout) when tutorial is active
 *
 * j key advances past the card, k key goes back.
 */

import { useEffect, useCallback } from 'react';
import { FOOTER_LINKS } from '../lib/config';

interface TutorialCardProps {
  /** Tutorial ID — determines which custom content to render */
  id?: string;
  message: string;
  title?: string;
  onAdvance: () => void;
  /** Called when user presses k to go back */
  onGoBack?: () => void;
  /** Whether to register own j/k key handler. Set false when parent handles keys. */
  handleKeys?: boolean;
}

/** Styled key badge */
function Key({ children, color = 'var(--memphis-pink)' }: { children: string; color?: string }) {
  return (
    <kbd
      className="px-3 py-1.5 rounded border-2 font-mono font-bold text-lg"
      style={{ borderColor: color, color }}
    >
      {children}
    </kbd>
  );
}

/** Renders the inner content box for a specific tutorial ID */
function TutorialContent({ id }: { id?: string }) {
  switch (id) {
    // Card 1: Welcome
    case 'nav':
      return (
        <div className="flex flex-col items-center gap-5">
          <h2
            className="text-3xl font-bold tracking-tight text-center"
            style={{ color: 'var(--memphis-cyan)' }}
          >
            Welcome to jklb.social!
          </h2>
          <p className="text-lg text-center leading-relaxed" style={{ color: 'var(--memphis-text)' }}>
            First (&amp; only) thing you need to know:
          </p>
          <div className="flex items-center gap-2">
            <Key>j</Key>
            <span className="text-lg" style={{ color: 'var(--memphis-text)' }}>to go forward.</span>
          </div>
          <div className="flex items-center gap-2">
            <Key color="var(--memphis-cyan)">space</Key>
            <span className="text-lg" style={{ color: 'var(--memphis-text)' }}>to see all hotkeys</span>
          </div>
        </div>
      );

    // Card 2: Philosophy + like/boost
    case 'actions':
      return (
        <div className="flex flex-col items-center gap-5">
          <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--memphis-text-muted)' }}>
            jklb.social is about reducing friction to sociable behaviors and increasing friction to mindless scrolling.
            Consider liking more posts!
          </p>
          <div className="flex flex-col items-center gap-4 mt-2">
            <div className="flex items-center gap-3">
              <Key>l</Key>
              <span className="text-xl" style={{ color: 'var(--memphis-text)' }}>likes a post</span>
            </div>
            <div className="flex items-center gap-3">
              <Key color="var(--memphis-cyan)">b</Key>
              <span className="text-xl" style={{ color: 'var(--memphis-text)' }}>boosts (reposts)</span>
            </div>
            <p className="text-base text-center mt-1 flex items-center gap-1.5 flex-wrap justify-center" style={{ color: 'var(--memphis-text)' }}>
              <span>(why not</span>
              <Key color="var(--memphis-yellow)">r</Key>
              <span>for re-post? Because</span>
              <Key color="var(--memphis-yellow)">r</Key>
              <span>is for reply)</span>
            </p>
          </div>
        </div>
      );

    // Card 3: More keys
    case 'moreKeys':
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Key>q</Key>
            <span className="text-lg" style={{ color: 'var(--memphis-text)' }}>to quote-post</span>
          </div>
          <div className="flex items-center gap-2">
            <Key color="var(--memphis-cyan)">v</Key>
            <span className="text-lg" style={{ color: 'var(--memphis-text)' }}>to view any post on Bluesky</span>
          </div>
          <div className="flex items-center gap-2">
            <Key color="var(--memphis-yellow)">o</Key>
            <span className="text-lg" style={{ color: 'var(--memphis-text)' }}>opens hyperlinks</span>
          </div>
        </div>
      );

    // Fallback: generic title + message
    default:
      return null;
  }
}

export function TutorialCard({ id, message, title, onAdvance, onGoBack, handleKeys = true }: TutorialCardProps) {
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

  // Check if this tutorial has custom content
  const hasCustomContent = id && ['nav', 'actions', 'moreKeys'].includes(id);

  return (
    <div
      className="flex flex-col w-full px-6 py-4"
    >
      {/* Subtitle — muted hint about toggling tutorials off */}
      <p className="text-sm text-center mb-6 flex items-center justify-center gap-1.5" style={{ color: 'var(--memphis-text-muted)' }}>
        <span>go to settings</span>
        <kbd
          className="px-1.5 py-0.5 rounded border font-mono font-bold text-xs"
          style={{ borderColor: 'var(--memphis-cyan)', color: 'var(--memphis-cyan)' }}
        >
          s
        </kbd>
        <span>to toggle off these messages</span>
      </p>

      {/* Center: Bordered wireframe box with tutorial content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          className="flex flex-col items-center justify-center px-8 py-10 w-full max-w-md"
          style={{
            border: '1.5px solid var(--memphis-text)',
            borderRadius: 'var(--card-radius)',
            backgroundColor: 'color-mix(in srgb, var(--memphis-bg) 85%, transparent)',
          }}
        >
          {hasCustomContent ? (
            <TutorialContent id={id} />
          ) : title ? (
            <>
              <h2
                className="text-3xl font-bold tracking-tight mb-4 text-center"
                style={{ color: 'var(--memphis-cyan)' }}
              >
                {title}
              </h2>
              <p
                className="text-lg text-center leading-relaxed"
                style={{ color: 'var(--memphis-text)' }}
              >
                {message}
              </p>
            </>
          ) : (
            <p
              className="text-lg text-center leading-relaxed"
              style={{ color: 'var(--memphis-text)' }}
            >
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Blog & feature request links */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <a
          href={FOOTER_LINKS.blog}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline hover:text-[var(--memphis-cyan)]"
          style={{ color: 'var(--memphis-text-muted)' }}
        >
          Blog
        </a>
        <span style={{ color: 'var(--memphis-text-muted)' }}>·</span>
        <a
          href={FOOTER_LINKS.featureRequestBugReport}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline hover:text-[var(--memphis-cyan)]"
          style={{ color: 'var(--memphis-text-muted)' }}
        >
          Feature Requests/Bug Reports
        </a>
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
