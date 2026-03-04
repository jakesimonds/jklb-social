/**
 * SectionCard - Full-screen transition card for Beginning, Middle, and End phases.
 *
 * All three share the same Memphis-styled layout skeleton.
 * The Middle variant includes algorithm chooser and post count slider.
 * j key advances past the card.
 */

import { useEffect, useCallback, useState } from 'react';
import { useSettings } from '../lib/SettingsContext';
import type { ResolvedFeed } from '../lib/saved-feeds';

interface SectionCardProps {
  section: 'beginning' | 'middle' | 'end';
  onAdvance: () => void;
  /** Called when user presses k to go back */
  onGoBack?: () => void;
  /** Required for Middle variant — user's available feeds */
  availableFeeds?: ResolvedFeed[];
  /** When false, SectionCard won't register its own j/k key handlers. Default: true. */
  handleKeys?: boolean;
}

const SECTION_CONFIG = {
  beginning: {
    title: 'Beginning',
    subtitle: 'People see you',
    accent: 'var(--memphis-pink)',
  },
  middle: {
    title: 'Choose Your Algorithm',
    subtitle: '',
    accent: 'var(--memphis-cyan)',
  },
  end: {
    title: 'End',
    subtitle: 'Reflect and share',
    accent: 'var(--memphis-yellow)',
  },
} as const;

export function SectionCard({ section, onAdvance, onGoBack, availableFeeds = [], handleKeys = true }: SectionCardProps) {
  const config = SECTION_CONFIG[section];

  // j key advances past the card, k key goes back
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
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
    <div className="flex flex-col items-center justify-center h-full w-full px-6">
      {/* j to continue — above title, matching Beginning style */}
      <div className="text-center pt-6 pb-2">
        <span className="text-sm text-[var(--memphis-text-muted)]">
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--memphis-pink)] text-[var(--memphis-pink)] text-xs">
            j
          </kbd>
          {' '}to continue
        </span>
      </div>

      {/* Title */}
      <h1
        className="text-5xl font-bold tracking-tight mb-3"
        style={{ color: config.accent }}
      >
        {config.title}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-[var(--memphis-text-muted)] mb-10">
        {config.subtitle}
      </p>

      {/* Middle-specific controls */}
      {section === 'middle' && (
        <MiddleControls availableFeeds={availableFeeds} />
      )}
    </div>
  );
}

/**
 * Middle-specific controls: algorithm chooser + post count slider.
 * Uses the settings context directly (same pattern as SettingsPanel).
 */
function MiddleControls({ availableFeeds }: { availableFeeds: ResolvedFeed[] }) {
  const { settings, updateFeed, updateAwardSettings } = useSettings();
  const [editingCount, setEditingCount] = useState<string | null>(null);

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Algorithm chooser — dropdown per specs/middle-flow.md */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--memphis-text-muted)]" htmlFor="algo-select">
          Algorithm
        </label>
        <select
          id="algo-select"
          value={settings.feed.algoFeed ?? '__chronological__'}
          onChange={(e) => {
            const val = e.target.value;
            updateFeed({ algoFeed: val === '__chronological__' ? null : val });
          }}
          className="w-full px-4 py-2 pr-10 rounded-md border border-[var(--memphis-cyan)] bg-[var(--bg-primary,var(--memphis-bg))] text-[var(--memphis-text)] font-mono text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--memphis-cyan)]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2300e5ff' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
        >
          <option value="__chronological__">Chronological</option>
          {availableFeeds
            .filter(f => f.type !== 'timeline')
            .map(f => (
              <option key={f.id} value={f.value}>
                {f.displayName}
              </option>
            ))}
        </select>
      </div>

      {/* Post count slider */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--memphis-text-muted)]">
          How many posts?
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const val = settings.credibleExit.postsBeforePrompt - 5;
              if (val >= 5) updateAwardSettings({ postsBeforePrompt: val });
            }}
            className="w-8 h-8 flex items-center justify-center rounded bg-[var(--memphis-bg)] border border-[var(--memphis-border)] text-[var(--memphis-text)] hover:border-[var(--memphis-cyan)] transition-colors"
          >
            -
          </button>
          <input
            type="number"
            min={5}
            max={100}
            step={5}
            value={editingCount ?? settings.credibleExit.postsBeforePrompt}
            onFocus={(e) => setEditingCount(e.target.value)}
            onChange={(e) => {
              setEditingCount(e.target.value);
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 5 && val <= 100) {
                updateAwardSettings({ postsBeforePrompt: val });
              }
            }}
            onBlur={() => {
              const val = parseInt(editingCount ?? '', 10);
              if (!isNaN(val)) {
                updateAwardSettings({ postsBeforePrompt: Math.max(5, Math.min(100, val)) });
              }
              setEditingCount(null);
            }}
            className="text-2xl font-bold text-[var(--memphis-text)] w-16 text-center bg-transparent border-b border-[var(--memphis-border)] focus:border-[var(--memphis-cyan)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => {
              const val = settings.credibleExit.postsBeforePrompt + 5;
              if (val <= 100) updateAwardSettings({ postsBeforePrompt: val });
            }}
            className="w-8 h-8 flex items-center justify-center rounded bg-[var(--memphis-bg)] border border-[var(--memphis-border)] text-[var(--memphis-text)] hover:border-[var(--memphis-cyan)] transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

