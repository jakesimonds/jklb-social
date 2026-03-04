/**
 * LikedPostsGrid - Full-page grid for picking a favorite liked post.
 *
 * Part of the End flow: users review what they liked and pick a favorite
 * ("best thing I saw") which carries forward to the Share step.
 *
 * Layout: 4 rows, columns extend rightward as needed. Scrolls horizontally.
 * Posts fill column-by-column (top-to-bottom, then next column).
 * Skip cell is always the last content cell.
 * Arrow keys navigate, j advances, k goes back.
 * Memphis styling with grid lines and bold accents.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LikedPost } from '../types';

const ROWS = 4;
const CELL_WIDTH = 220; // px — fixed width for horizontal scroll

interface LikedPostsGridProps {
  likedPosts: LikedPost[];
  /** Called when the user selects (or deselects) a post as their favorite */
  onSelectPost: (post: LikedPost | null) => void;
  /** URI of the currently selected favorite post (for highlight) */
  selectedPostUri?: string;
  /** Called to advance past the grid — only when a selection has been made */
  onAdvance: () => void;
  /** Called to go back to atmosphere report */
  onGoBack: () => void;
}

export function LikedPostsGrid({
  likedPosts,
  onSelectPost,
  selectedPostUri,
  onAdvance,
  onGoBack,
}: LikedPostsGridProps) {
  const displayPosts = likedPosts; // show ALL likes, scroll to see them
  const totalCells = displayPosts.length + 1; // posts + skip cell
  const columns = Math.ceil(totalCells / ROWS);
  const gridCells = columns * ROWS; // total grid slots (some may be empty)
  const skipIndex = displayPosts.length; // skip cell immediately after posts
  const navigableCells = displayPosts.length + 1;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track whether user chose "skip" (no favorite)
  const [skipped, setSkipped] = useState(false);
  // Arrow-key focus index (0-based, covers post cells + skip cell only)
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const hasSelection = !!selectedPostUri || skipped || likedPosts.length === 0;

  // Select a post by index (or skip if it's the skip cell)
  const selectAtIndex = useCallback((index: number) => {
    if (index === skipIndex) {
      // Skip cell — toggle
      setSkipped(prev => {
        const next = !prev;
        if (next) onSelectPost(null); // Clear any post selection
        return next;
      });
    } else if (index < displayPosts.length) {
      const post = displayPosts[index];
      setSkipped(false);
      if (selectedPostUri === post.uri) {
        onSelectPost(null); // Deselect
      } else {
        onSelectPost(post);
      }
    }
  }, [displayPosts, skipIndex, selectedPostUri, onSelectPost]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'j': {
          e.preventDefault();
          if (hasSelection) {
            onAdvance();
          }
          break;
        }
        case 'k': {
          e.preventDefault();
          onGoBack();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const nextD = focusIndex === null ? 0 : Math.min(focusIndex + 1, navigableCells - 1);
          setFocusIndex(nextD);
          selectAtIndex(nextD);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const nextU = focusIndex === null ? 0 : Math.max(focusIndex - 1, 0);
          setFocusIndex(nextU);
          selectAtIndex(nextU);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusIndex === null) {
            setFocusIndex(0);
            selectAtIndex(0);
          } else {
            const next = focusIndex + ROWS;
            if (next < navigableCells) {
              setFocusIndex(next);
              selectAtIndex(next);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusIndex === null) {
            setFocusIndex(0);
            selectAtIndex(0);
          } else {
            const next = focusIndex - ROWS;
            if (next >= 0) {
              setFocusIndex(next);
              selectAtIndex(next);
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focusIndex !== null) {
            selectAtIndex(focusIndex);
          }
          break;
        }
      }
    },
    [hasSelection, onAdvance, onGoBack, navigableCells, focusIndex, selectAtIndex]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleCellClick = (index: number) => {
    setFocusIndex(index);
    selectAtIndex(index);
  };

  // Scroll focused cell into view
  useEffect(() => {
    if (focusIndex === null || !scrollRef.current) return;
    const col = Math.floor(focusIndex / ROWS);
    const target = scrollRef.current.children[0]?.children[col * ROWS] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [focusIndex]);

  // Empty state — no likes, just skip
  if (likedPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full px-6">
        <div
          className="w-24 h-1 mb-8 rounded-full"
          style={{ backgroundColor: 'var(--memphis-yellow)' }}
        />
        <h2
          className="text-3xl font-bold tracking-tight mb-3"
          style={{ color: 'var(--memphis-yellow)' }}
        >
          No likes this session
        </h2>
        <p className="text-sm text-[var(--memphis-text-muted)] mb-10">
          You didn't like any posts. That's okay.
        </p>
        <div className="mt-auto pb-6">
          <span className="text-sm text-[var(--memphis-text-muted)]">
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--memphis-border)] text-[var(--memphis-text)] text-xs">
              j
            </kbd>
            {' '}to continue
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-1 rounded-full"
            style={{ backgroundColor: 'var(--memphis-yellow)' }}
          />
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--memphis-yellow)' }}
          >
            Liked Posts
          </h2>
        </div>
        <span className="text-sm text-[var(--memphis-text-muted)]">
          {selectedPostUri
            ? 'Favorite selected'
            : skipped
              ? 'Skipping — no favorite'
              : 'Pick a favorite or skip'}
        </span>
      </div>

      {/* Grid — 4 rows, scrolls horizontally */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden scrollbar-thin"
        style={{ scrollbarColor: 'var(--memphis-pink) transparent' }}
      >
        <div
          className="grid gap-px h-full"
          style={{
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            gridTemplateColumns: `repeat(${columns}, ${CELL_WIDTH}px)`,
            gridAutoFlow: 'column',
            backgroundColor: 'var(--memphis-border)',
            width: `${columns * CELL_WIDTH + (columns - 1)}px`,
          }}
        >
        {Array.from({ length: gridCells }, (_, i) => {
          // Post cell
          if (i < displayPosts.length) {
            const post = displayPosts[i];
            const isSelected = selectedPostUri === post.uri;
            return (
              <button
                key={post.uri}
                onClick={() => handleCellClick(i)}
                className="relative flex flex-col p-3 text-left transition-colors"
                style={{
                  backgroundColor: isSelected
                    ? 'rgba(255, 255, 100, 0.08)'
                    : 'var(--memphis-bg)',
                  outline: isSelected
                    ? '2px solid var(--memphis-yellow)'
                    : 'none',
                  outlineOffset: '-2px',
                  overflow: 'hidden',
                }}
              >
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: 'var(--memphis-text)',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {post.textPreview || '(no text)'}
                </p>
                <p
                  className="text-xs mt-1 truncate flex-shrink-0"
                  style={{
                    color: isSelected
                      ? 'var(--memphis-yellow)'
                      : 'var(--memphis-text-muted)',
                  }}
                >
                  @{post.authorHandle}
                </p>
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: 'var(--memphis-yellow)' }}
                  />
                )}
              </button>
            );
          }

          // Skip cell — immediately after posts
          if (i === skipIndex) {
            return (
              <button
                key="__skip__"
                onClick={() => handleCellClick(skipIndex)}
                className="relative flex flex-col items-center justify-center p-3 text-center transition-colors overflow-hidden"
                style={{
                  backgroundColor: skipped
                    ? 'rgba(255, 255, 100, 0.08)'
                    : 'var(--memphis-bg)',
                  outline: skipped
                    ? '2px solid var(--memphis-yellow)'
                    : 'none',
                  outlineOffset: '-2px',
                }}
              >
                <span
                  className="text-lg font-bold tracking-tight"
                  style={{
                    color: skipped
                      ? 'var(--memphis-yellow)'
                      : 'var(--memphis-text-muted)',
                  }}
                >
                  Skip
                </span>
                <span className="text-xs mt-1" style={{ color: 'var(--memphis-text-muted)' }}>
                  no favorite
                </span>
                {skipped && (
                  <div
                    className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: 'var(--memphis-yellow)' }}
                  />
                )}
              </button>
            );
          }

          // Empty cell
          return (
            <div
              key={`empty-${i}`}
              style={{ backgroundColor: 'var(--memphis-bg)' }}
            />
          );
        })}
        </div>
      </div>

      {/* Footer: hints */}
      <div className="flex items-center justify-between mt-3 flex-shrink-0">
        <span className="text-xs text-[var(--memphis-text-muted)]">
          {displayPosts.length} post{displayPosts.length !== 1 ? 's' : ''}
        </span>

        <span className="text-sm text-[var(--memphis-text-muted)]">
          {hasSelection ? (
            <>
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--memphis-border)] text-[var(--memphis-text)] text-xs">
                j
              </kbd>
              {' '}to continue
            </>
          ) : (
            'select a post or skip'
          )}
          {' / '}
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--memphis-border)] text-[var(--memphis-text)] text-xs">
            k
          </kbd>
          {' '}back
        </span>
      </div>
    </div>
  );
}
