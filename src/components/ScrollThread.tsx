/**
 * ScrollThread - Vertical scrolling thread viewer
 *
 * Displays thread posts in a vertical scrolling list with:
 * - All cards same size as feed view
 * - Focused post centered vertically
 * - Up/down arrow navigation moves focus one post at a time
 * - Finger/trackpad scrolling with snap-to-post
 * - Depth-based indentation for nested replies
 * - No hero card or U2 album card
 *
 * Props:
 * - posts: Array of posts in the thread
 * - depths: Parallel array of depth values for indentation
 * - currentIndex: Currently focused post index
 * - onNavigate: Callback when navigation changes
 * - originalPostIndex: Index of the post that opened the thread (for highlighting)
 */

import { useRef, useEffect, useCallback } from 'react';
import type { Post } from '../types';
import { PostCard } from './PostCard';

interface ScrollThreadProps {
  posts: Post[];
  depths: number[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  originalPostIndex: number;
}

// Indent per depth level in pixels
const DEPTH_INDENT = 24;
// Max indent to prevent posts from being too narrow
const MAX_INDENT = 120;

export function ScrollThread({ posts, depths, currentIndex, onNavigate, originalPostIndex }: ScrollThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The main author of the thread is the author of the first post (root)
  const mainAuthorDid = posts.length > 0 ? posts[0].author.did : null;

  // Minimum depth in the thread (for relative indentation)
  const minDepth = depths.length > 0 ? Math.min(...depths) : 0;

  // Scroll the focused post to center when index changes
  useEffect(() => {
    const item = itemRefs.current[currentIndex];
    if (item && !isScrollingRef.current) {
      item.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  // Handle scroll events to detect which post is closest to center and snap
  const handleScroll = useCallback(() => {
    isScrollingRef.current = true;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // After scrolling stops, snap to nearest post
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;

      let closestIndex = currentIndex;
      let closestDistance = Infinity;

      itemRefs.current.forEach((item, index) => {
        if (!item) return;
        const itemRect = item.getBoundingClientRect();
        const itemCenterY = itemRect.top + itemRect.height / 2;
        const distance = Math.abs(itemCenterY - centerY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      if (closestIndex !== currentIndex) {
        onNavigate(closestIndex);
      } else {
        // Snap back to current if already closest
        const item = itemRefs.current[currentIndex];
        if (item) {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 150);
  }, [currentIndex, onNavigate]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="scroll-thread-container">
      {/* Dark background */}
      <div className="scroll-thread-backdrop" />

      {/* Thread position indicator */}
      <div className="scroll-thread-indicator">
        <span className="text-[var(--memphis-cyan)]">Thread</span>
        <span className="text-white/80">
          {currentIndex + 1}/{posts.length}
        </span>
      </div>

      {/* Scrollable post list */}
      <div
        ref={containerRef}
        className="scroll-thread-list"
      >
        {/* Top spacer to allow first post to be centered */}
        <div className="scroll-thread-spacer" />

        {posts.map((post, index) => {
          const relativeDepth = depths[index] - minDepth;
          const indent = Math.min(relativeDepth * DEPTH_INDENT, MAX_INDENT);
          const isFocused = index === currentIndex;
          const isOriginal = index === originalPostIndex;

          return (
            <div
              key={post.uri}
              ref={(el) => { itemRefs.current[index] = el; }}
              className={`scroll-thread-item ${isFocused ? 'scroll-thread-item-focused' : ''} ${isOriginal ? 'scroll-thread-item-original' : ''}`}
              style={{ marginLeft: indent }}
              onClick={() => onNavigate(index)}
            >
              <PostCard
                post={post}
                isFocused={isFocused}
                isInThread={true}
                threadMainAuthorDid={mainAuthorDid}
                isFirstInThread={index === 0}
              />
            </div>
          );
        })}

        {/* Bottom spacer to allow last post to be centered */}
        <div className="scroll-thread-spacer" />
      </div>

      {/* Navigation hint */}
      <div className="scroll-thread-hint">
        <span className="text-[var(--memphis-text-muted)]">
          ↑ ↓ navigate thread • t/j/k exit thread
        </span>
      </div>
    </div>
  );
}
