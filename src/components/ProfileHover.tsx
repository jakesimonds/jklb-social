import React from 'react';

/**
 * ProfileHover - Hover card showing user profile info
 *
 * Created as part of TASK-PROFILE-01.
 * Displays on mouse hover over chorus avatars or notification avatars.
 *
 * Shows:
 * - displayName (or handle if no displayName)
 * - @handle (clickable → derived URL based on handle)
 * - bio/description (full text, no truncation - TASK-PROFILE-05)
 *   - URLs and @mentions are clickable (TASK-PROFILE-06)
 *
 * Handle click behavior (TASK-PROFILE-04):
 * - Custom domain handles (e.g. @tynanpurdy.com) → https://{handle}
 * - .bsky.social handles → bsky.app/profile/{handle}
 *
 * Avatar is clickable → links to bsky.app/profile/{handle}
 *
 * Memphis styling with navy background, pink/cyan accents.
 * Positioned near trigger element (positioning handled by parent).
 */

export interface ProfileHoverData {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  /** User's website URL from their profile record (optional override) */
  website?: string;
}

/** Card dimensions for positioning calculations */
export const PROFILE_HOVER_WIDTH = 320; // ~midpoint of min-w-[300px] max-w-[400px]
export const PROFILE_HOVER_HEIGHT = 220; // reasonable estimate for typical card

/**
 * Calculate optimal position for the hover card to ensure it stays within viewport.
 * Handles all four edges: left, right, top, bottom.
 *
 * @param triggerRect - The bounding rect of the element being hovered
 * @param options - Optional configuration
 * @returns Position object with top and left coordinates
 */
export function calculateHoverPosition(
  triggerRect: DOMRect,
  options: {
    cardWidth?: number;
    cardHeight?: number;
    offset?: number;
    padding?: number;
  } = {}
): { top: number; left: number } {
  const {
    cardWidth = PROFILE_HOVER_WIDTH,
    cardHeight = PROFILE_HOVER_HEIGHT,
    offset = 8, // gap between trigger and card
    padding = 10, // minimum distance from viewport edge
  } = options;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Default: position below trigger, aligned to left edge
  let top = triggerRect.bottom + offset;
  let left = triggerRect.left;

  // Check horizontal overflow
  const wouldOverflowRight = left + cardWidth > viewportWidth - padding;
  const wouldOverflowLeft = left < padding;

  if (wouldOverflowRight) {
    // Align to right edge of trigger, or clamp to right edge of viewport
    left = Math.max(padding, triggerRect.right - cardWidth);
    // If still overflows right, clamp to viewport right edge
    if (left + cardWidth > viewportWidth - padding) {
      left = viewportWidth - cardWidth - padding;
    }
  } else if (wouldOverflowLeft) {
    left = padding;
  }

  // Check vertical overflow (would card go below viewport?)
  const wouldOverflowBottom = top + cardHeight > viewportHeight - padding;

  if (wouldOverflowBottom) {
    // Position above the trigger instead
    top = triggerRect.top - cardHeight - offset;

    // If that would go above viewport, just clamp to bottom
    if (top < padding) {
      top = viewportHeight - cardHeight - padding;
    }
  }

  return { top, left };
}

/**
 * Derive a URL from the user's handle.
 * - Custom domain handles (not .bsky.social) → https://{handle}
 * - .bsky.social handles → https://bsky.app/profile/{handle}
 */
function getHandleUrl(handle: string): string {
  if (handle.endsWith('.bsky.social')) {
    return `https://bsky.app/profile/${handle}`;
  }
  // Custom domain - link directly to their website
  return `https://${handle}`;
}

/**
 * Parse bio text and convert URLs and @mentions to clickable links.
 *
 * URL detection is intentionally liberal - anything with a . that looks like
 * a domain gets linked (e.g., "schage.town" becomes a link). Better to
 * accidentally make a fake link than miss a legit one.
 *
 * @mentions link to bsky.app/profile/{handle}
 */
function parseBioText(text: string): React.ReactNode[] {
  // Combined regex to match:
  // 1. URLs (with or without protocol) - anything that looks like a domain
  // 2. @mentions
  //
  // URL pattern: optional protocol, then word chars/hyphens, dot, more chars
  // Liberal matching: anything.anything counts as a potential URL
  const tokenPattern = /(@[\w.-]+)|((https?:\/\/)?[\w-]+\.[\w.-]+[^\s,;:!?'")\]]*)/gi;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const isMention = match[1] !== undefined;

    if (isMention) {
      // @mention - link to bsky profile
      const handle = fullMatch.slice(1); // Remove the @
      result.push(
        <a
          key={`mention-${keyIndex++}`}
          href={`https://bsky.app/profile/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--memphis-cyan)] hover:text-[var(--memphis-pink)] transition-colors"
        >
          {fullMatch}
        </a>
      );
    } else {
      // URL - add protocol if missing
      let url = fullMatch;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      result.push(
        <a
          key={`link-${keyIndex++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--memphis-cyan)] hover:text-[var(--memphis-pink)] transition-colors underline"
        >
          {fullMatch}
        </a>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

export interface ProfileHoverProps {
  /** Profile data to display */
  profile: ProfileHoverData;
  /** Whether the hover card is visible */
  isVisible: boolean;
  /** Position style (top, left, etc.) - applied to wrapper */
  style?: React.CSSProperties;
  /** Additional className for positioning */
  className?: string;
}

/**
 * ProfileHover component
 * A hover card that displays profile information with clickable links
 */
export function ProfileHover({
  profile,
  isVisible,
  style,
  className = '',
}: ProfileHoverProps) {
  if (!isVisible) return null;

  const { handle, displayName, avatar, description, website } = profile;

  // Bluesky profile URL for avatar link
  const bskyProfileUrl = `https://bsky.app/profile/${handle}`;

  // Derive handle URL: custom domain → their website, .bsky.social → bsky profile
  // Allow explicit website prop to override the derived URL
  const handleUrl = website || getHandleUrl(handle);

  return (
    <div
      className={`
        absolute z-50
        bg-[var(--memphis-navy)] border-2 border-[var(--memphis-cyan)]
        rounded-xl p-4 shadow-lg
        min-w-[300px] max-w-[400px] max-h-[400px] overflow-y-auto
        animate-fade-in
        ${className}
      `}
      style={style}
      role="tooltip"
      aria-label={`Profile card for ${displayName || handle}`}
    >
      {/* Header: Avatar + Name/Handle */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar - clickable to bsky profile */}
        <a
          href={bskyProfileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          title={`View @${handle} on Bluesky`}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={displayName || handle}
              className="w-14 h-14 rounded-full border-2 border-[var(--memphis-pink)]"
            />
          ) : (
            <div className="w-14 h-14 rounded-full border-2 border-[var(--memphis-pink)] bg-[var(--memphis-cyan)] flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {handle.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </a>

        {/* Name and Handle */}
        <div className="flex-1 min-w-0">
          {/* Display Name */}
          <p className="font-bold text-white truncate">
            {displayName || handle}
          </p>

          {/* Handle - always clickable, links to derived URL (custom domain or bsky profile) */}
          <a
            href={handleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--memphis-cyan)] hover:text-[var(--memphis-pink)] transition-colors truncate block"
            title={`Visit ${handleUrl}`}
          >
            @{handle}
          </a>
        </div>
      </div>

      {/* Bio/Description - full text with clickable links/mentions (TASK-PROFILE-05, TASK-PROFILE-06) */}
      {description && (
        <p className="text-sm text-[var(--memphis-text)] leading-relaxed whitespace-pre-wrap">
          {parseBioText(description)}
        </p>
      )}

      {/* No action buttons yet - future task */}
    </div>
  );
}
