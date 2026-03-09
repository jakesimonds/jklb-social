/**
 * CuratorCard - First card in Beginning flow for Premium users.
 *
 * Textarea for feed preference paragraph + range slider for curated post count (1-50).
 * Both pre-filled from localStorage via CuratorContext.
 * Enter submits: kicks off curator in background, advances Beginning.
 */

import { useState, useCallback } from 'react';
import { useCurator } from '../../lib/CuratorContext';

interface CuratorCardProps {
  onSubmit: () => void;
}

export function CuratorCard({ onSubmit }: CuratorCardProps) {
  const { userPrompt, requestedCount, startCuration } = useCurator();
  const [prompt, setPrompt] = useState(userPrompt);
  const [count, setCount] = useState(requestedCount);

  const handleSubmit = useCallback(() => {
    // Save to localStorage immediately
    localStorage.setItem('jklb-feed-preference', prompt);
    localStorage.setItem('jklb-curator-count', String(count));
    // Kick off curation in background
    startCuration(prompt, count);
    // Advance to next Beginning stage
    onSubmit();
  }, [prompt, count, startCuration, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="flex flex-col h-full w-full px-6 py-8">
      {/* Header */}
      <h1
        className="text-5xl font-bold tracking-tight mb-2 text-center"
        style={{ color: 'var(--memphis-pink)' }}
      >
        Curator
      </h1>

      <p className="text-sm text-center mb-8" style={{ color: 'var(--memphis-text-muted)' }}>
        tell the curator what you want — it&apos;ll pick posts for you
      </p>

      {/* Center: config box */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          className="flex flex-col gap-6 px-8 py-10 w-full max-w-md"
          style={{
            border: '1.5px solid var(--memphis-pink)',
            borderRadius: 'var(--card-radius)',
            backgroundColor: 'color-mix(in srgb, var(--memphis-bg) 85%, transparent)',
          }}
        >
          {/* Preference textarea */}
          <div>
            <label
              className="block text-xs mb-2"
              style={{ color: 'var(--memphis-text-muted)' }}
            >
              What do you want to see?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to see — e.g. 'no politics, some funny stuff, at least 10 recent posts'"
              rows={4}
              className="w-full bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded px-3 py-2 text-sm text-[var(--memphis-text)] placeholder:text-[var(--memphis-text-muted)] focus:border-[var(--memphis-pink)] focus:outline-none resize-none"
            />
          </div>

          {/* Post count slider */}
          <div>
            <label
              className="block text-xs mb-2"
              style={{ color: 'var(--memphis-text-muted)' }}
            >
              How many curated posts?
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10))}
                className="flex-1 accent-[var(--memphis-pink)]"
              />
              <span
                className="text-2xl font-bold w-10 text-center"
                style={{ color: 'var(--memphis-text)' }}
              >
                {count}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="pt-4 pb-2 flex justify-center">
        <span className="text-sm text-[var(--memphis-text-muted)]">
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--memphis-pink)] text-[var(--memphis-pink)] text-xs">
            Enter
          </kbd>
          {' '}to submit &amp; continue
        </span>
      </div>
    </div>
  );
}
