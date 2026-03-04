/**
 * QuotedPost - Nested quoted post component
 *
 * Displays quoted/embedded posts within a parent post.
 * Supports two variants:
 * - 'standard': Stacked layout for narrow viewports (default)
 * - 'wide': Two-column optimized layout for wide viewports
 */

import type { QuotedPost as QuotedPostType } from '../types';
import { formatRelativeTime, isTenorEmbed, getTenorVideo } from '../lib/post-utils';
import { MediaEmbed } from './MediaEmbed';
import { LinkPreview } from './LinkPreview';
import { RichText } from './RichText';

interface QuotedPostProps {
  quote: QuotedPostType;
  variant?: 'standard' | 'wide';
  /** URL of the currently highlighted link (for O key) */
  activeUrl?: string;
  /** Callback when an image is clicked (for fullscreen) */
  onImageClick?: () => void;
  /** Whether this quoted post is the current focus target (Shift+J/K) */
  isFocused?: boolean;
}

/**
 * Quoted post component - nested inside PostCard
 * Supports 'standard' (narrow/stacked) and 'wide' (two-column) layouts
 */
export function QuotedPost({ quote, variant = 'standard', activeUrl, onImageClick, isFocused = false }: QuotedPostProps) {
  const formattedTime = formatRelativeTime(quote.indexedAt);
  const isWide = variant === 'wide';

  // Determine what media/link to show in the quote
  const hasImages = quote.images && quote.images.length > 0;
  const hasVideo = quote.video !== undefined;
  const hasExternal = quote.external !== undefined;

  // Check if external is a Tenor GIF
  const isTenor = hasExternal && quote.external && isTenorEmbed(quote.external);
  const tenorVideo = isTenor && quote.external ? getTenorVideo(quote.external) : null;

  // Show link preview only if external exists, is NOT tenor, and there's no other media
  const showLinkPreview = hasExternal && !isTenor && !hasImages && !hasVideo && quote.external;

  // Container classes differ by variant and focus state
  const focusedBorder = 'border-2 border-[var(--memphis-yellow)] shadow-[0_0_12px_#ffeb3b4d]';
  const defaultBorder = 'border border-white/30 border-dashed';
  const borderClass = isFocused ? focusedBorder : defaultBorder;
  const containerClass = isWide
    ? `rounded-lg ${borderClass} bg-white/5 h-full flex flex-col`
    : `mt-3 rounded-lg ${borderClass} bg-white/5`;

  // Header classes: wide variant needs flex-shrink-0
  const headerClass = isWide
    ? 'flex items-center gap-2 p-2 border-b border-white/10 flex-shrink-0'
    : 'flex items-center gap-2 p-2 border-b border-white/10';

  // Content classes: wide variant needs flex-1 min-h-0
  const contentClass = isWide ? 'p-2 flex-1 min-h-0' : 'p-2';

  return (
    <div className={containerClass}>
      {/* Quote Header */}
      <div className={headerClass}>
        {/* Avatar */}
        <a
          href={`https://bsky.app/profile/${quote.author.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {quote.author.avatar ? (
            <img
              src={quote.author.avatar}
              alt={quote.author.displayName || quote.author.handle}
              className="w-8 h-8 rounded-full border border-[var(--memphis-cyan)]/50"
              loading="lazy"
            />
          ) : (
            <div className="w-8 h-8 rounded-full border border-[var(--memphis-cyan)]/50 bg-white/10 flex items-center justify-center">
              <span className="text-white/50 text-xs">
                {quote.author.handle.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </a>

        {/* Author info */}
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <span className="text-xs font-medium truncate">
            {quote.author.displayName || quote.author.handle}
          </span>
          <span className="text-[10px] text-[var(--memphis-cyan)] truncate">
            @{quote.author.handle}
          </span>
        </div>

        {/* Timestamp */}
        <time className="text-[10px] text-white/40 flex-shrink-0" dateTime={quote.indexedAt}>
          {formattedTime}
        </time>
      </div>

      {/* Quote Content */}
      <div className={contentClass}>
        {/* Text - no truncation, text is sacred */}
        {quote.text && (
          <RichText
            text={quote.text}
            linkFacets={quote.linkFacets}
            activeUrl={activeUrl}
            className="text-xs whitespace-pre-wrap break-words leading-relaxed"
          />
        )}

        {/* Media: images, video, or Tenor GIF */}
        {tenorVideo ? (
          <MediaEmbed
            video={{
              playlist: tenorVideo.playlist,
              thumbnail: tenorVideo.thumbnail,
              aspectRatio: tenorVideo.aspectRatio,
            }}
            {...(isWide ? { maxHeight: 'max-h-[45vh]' } : { compact: true })}
            onImageClick={onImageClick}
          />
        ) : (
          <MediaEmbed
            images={quote.images}
            video={quote.video}
            {...(isWide ? { maxHeight: 'max-h-[45vh]' } : { compact: true })}
            onImageClick={onImageClick}
          />
        )}

        {/* Link preview (only if no other media and not Tenor) */}
        {showLinkPreview && quote.external && (
          <LinkPreview external={quote.external} compact isHighlighted={activeUrl === quote.external.uri} />
        )}
      </div>
    </div>
  );
}
