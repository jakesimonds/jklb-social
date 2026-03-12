/**
 * TileFrame — Renders a Web Tile (DASL) in the feed content area.
 *
 * Two rendering modes:
 * 1. Card mode (default): Shows tile metadata (name, description, screenshot)
 *    via the @dasl/tiles renderCard() API. No iframe, no Service Worker.
 * 2. Active mode (on click): Replaces the card with a sandboxed interactive
 *    iframe via renderContent(). Requires the public loading server at
 *    load.webtil.es to serve the Service Worker shuttle.
 *
 * Falls back to PDSEventCard on error.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { loadTile } from '../lib/tiles';
import { PDSEventCard } from './PDSEventCard';
import type { PDSRecord } from '../lib/pds';
import type { Tile } from '@dasl/tiles/loader';

interface TileFrameProps {
  record: PDSRecord;
  handle?: string;
  isFocused?: boolean;
}

export function TileFrame({ record, handle, isFocused = false }: TileFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<Tile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'card' | 'active'>('card');
  const [tileName, setTileName] = useState<string | null>(null);

  // Load the tile and render card mode
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const tile = await loadTile(record.uri);
        if (cancelled) return;

        if (!tile) {
          setError('Tile not found');
          setLoading(false);
          return;
        }

        tileRef.current = tile;
        setTileName(tile.manifest?.name || null);

        if (mode === 'card') {
          const cardEl = await tile.renderCard();
          if (cancelled) return;
          container.innerHTML = '';
          container.appendChild(cardEl);
        } else {
          const height = tile.manifest?.sizing?.height
            ? Math.min(Math.max(tile.manifest.sizing.height, 300), 600)
            : 400;
          const iframeEl = tile.renderContent(height);
          if (cancelled) return;
          container.innerHTML = '';
          container.appendChild(iframeEl);
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('TileFrame: failed to load tile', err);
          setError(String(err));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [record.uri, mode]);

  // Switch to active mode
  const activateTile = useCallback(() => {
    if (mode === 'active') return;
    setMode('active');
  }, [mode]);

  // If error, fall back to PDSEventCard
  if (error) {
    return <PDSEventCard record={record} handle={handle} isFocused={isFocused} />;
  }

  const displayName = tileName || (record.record as { name?: string })?.name || 'Web Tile';

  return (
    <article
      className={`
        border-2 transition-all duration-200
        flex flex-col overflow-hidden
        ${isFocused
          ? 'border-[var(--memphis-cyan)] bg-[var(--memphis-cyan)]/5 shadow-lg shadow-[var(--memphis-cyan)]/20'
          : 'border-[var(--memphis-cyan)]/50 bg-white/5 hover:border-[var(--memphis-cyan)]'
        }
      `}
      style={{ borderRadius: 'var(--card-radius)' }}
      data-record-uri={record.uri}
    >
      {/* Header: tile name + author */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded bg-[var(--memphis-cyan)]/20 text-[var(--memphis-cyan)] border border-[var(--memphis-cyan)]/30">
            Web Tile
          </span>
          <span className="text-sm font-bold text-white truncate">{displayName}</span>
        </div>
        {handle && (
          <span className="text-xs text-[var(--memphis-yellow)] flex-shrink-0">@{handle}</span>
        )}
      </div>

      {/* Tile content area */}
      <div className="relative min-h-[200px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--memphis-bg)]/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-8 w-8 text-[var(--memphis-cyan)]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-[var(--memphis-text-muted)]">Loading tile...</span>
            </div>
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full [&>div]:w-full [&>div]:rounded-none [&>iframe]:w-full [&>iframe]:border-0"
          style={{ minHeight: '200px' }}
        />
      </div>

      {/* Footer: mode toggle + open link */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--memphis-cyan)]/20">
        {mode === 'card' ? (
          <button
            onClick={activateTile}
            className="text-xs text-[var(--memphis-pink)] hover:text-[var(--memphis-pink)]/80 transition-colors font-mono"
          >
            Launch tile
          </button>
        ) : (
          <span className="text-xs text-[var(--memphis-text-muted)] font-mono">
            interactive
          </span>
        )}
        <a
          href={`https://webtil.es/browser/?tile=${encodeURIComponent(record.uri)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--memphis-cyan)] hover:text-[var(--memphis-cyan)]/80 transition-colors"
        >
          Open in WebTil.es <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </article>
  );
}
