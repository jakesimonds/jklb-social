/**
 * SessionStats — Simple stat summary panel for the End Screen.
 *
 * Shows session numbers (posts viewed, likes, boosts, replies, links opened).
 * Escape or k returns to the End grid.
 */

import { useEffect, useCallback } from 'react';

interface SessionStatsProps {
  postsViewed: number;
  likes: number;
  boosts: number;
  replies: number;
  linksOpened: number;
  onBack: () => void;
}

const STAT_ROWS: { label: string; key: keyof Omit<SessionStatsProps, 'onBack'> }[] = [
  { label: 'posts seen', key: 'postsViewed' },
  { label: 'likes', key: 'likes' },
  { label: 'boosts', key: 'boosts' },
  { label: 'replies', key: 'replies' },
  { label: 'links opened', key: 'linksOpened' },
];

export function SessionStats({
  postsViewed,
  likes,
  boosts,
  replies,
  linksOpened,
  onBack,
}: SessionStatsProps) {
  const stats: Record<string, number> = { postsViewed, likes, boosts, replies, linksOpened };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'Escape' || e.key === 'k') {
        e.preventDefault();
        onBack();
      }
    },
    [onBack],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div
        className="w-full max-w-sm rounded border border-[var(--memphis-border)] p-6"
        style={{ backgroundColor: 'var(--memphis-bg)' }}
      >
        <h2
          className="text-lg font-bold mb-6 tracking-wide"
          style={{ color: 'var(--memphis-yellow)' }}
        >
          Stats
        </h2>

        <div className="flex flex-col gap-2">
          {STAT_ROWS.map(({ label, key }) => (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <span className="text-sm" style={{ color: 'var(--memphis-text-muted)' }}>
                {label}
              </span>
              <span className="flex-1 border-b border-dotted border-white/15 mx-1 mb-1" />
              <span className="text-sm font-mono font-bold text-white tabular-nums">
                {stats[key]}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onBack}
            className="text-xs cursor-pointer transition-colors hover:text-white"
            style={{ color: 'var(--memphis-text-muted)' }}
          >
            ← back
          </button>
        </div>
      </div>
    </div>
  );
}
