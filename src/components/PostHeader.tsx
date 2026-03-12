/**
 * PostHeader - Author info, timestamp, and action buttons header for posts
 */

import type { PostAuthor } from '../types';
import { formatRelativeTime, buildBskyPostUrl } from '../lib/post-utils';

interface PostHeaderProps {
  author: PostAuthor;
  indexedAt: string;
  hideAvatar?: boolean; // When true, avatar is rendered elsewhere (e.g., in PostCard sidebar)
  compact?: boolean; // Smaller text and tighter spacing for sm PostCard
  // Action button props (optional - only shown when provided)
  uri?: string;
  isLiked?: boolean;
  isReposted?: boolean;
  isFollowing?: boolean;
  isFocused?: boolean;
  // Click handlers for action buttons (optional)
  onFollow?: () => void;
  onLike?: () => void;
  onBoost?: () => void;
  onReply?: () => void;
}

export function PostHeader({ author, indexedAt, hideAvatar = false, compact = false, uri, isLiked, isReposted, isFollowing, isFocused, onFollow, onLike, onBoost, onReply }: PostHeaderProps) {
  const formattedTime = formatRelativeTime(indexedAt);
  const showActions = uri !== undefined;
  const bskyUrl = showActions ? buildBskyPostUrl(author.handle, uri) : null;
  const btnSize = compact ? 'text-[9px]' : 'text-xs';

  return (
    <header className={`flex items-start ${compact ? 'gap-1.5 px-1.5 pt-1 pb-0.5' : 'gap-3 px-3 sm:px-4 pt-2 pb-1.5'} border-b border-white/10 flex-shrink-0`}>
      {/* Text info + Actions in a row */}
      <div className="flex-1 min-w-0 flex items-start gap-2">
        {/* Text stack - display name and handle tightly together */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className={`${compact ? 'text-[9px]' : 'text-sm sm:text-base'} font-medium truncate leading-tight`}>
              {author.displayName || author.handle}
            </span>
            <time className={`${compact ? 'text-[8px]' : 'text-xs'} text-white/40 flex-shrink-0 leading-tight`} dateTime={indexedAt}>
              {formattedTime}
            </time>
          </div>
          <a
            href={`https://${author.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${compact ? 'text-[8px]' : 'text-xs'} text-[var(--memphis-cyan)] truncate hover:underline leading-tight`}
            onClick={(e) => e.stopPropagation()}
          >
            @{author.handle}
          </a>
        </div>

        {/* Action buttons + Arrow nav - pushed to right */}
        {showActions && (
          <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-3'} ml-auto flex-shrink-0`}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFollow?.(); }}
              className={`flex items-center gap-0.5 ${btnSize} transition-colors cursor-pointer hover:opacity-80 ${
                isFollowing
                  ? 'text-[var(--memphis-cyan)]'
                  : 'text-white/40 hover:text-[var(--memphis-cyan)]'
              }`}
              title={isFollowing ? 'Unfollow (f)' : 'Follow (f)'}
            >
              <span>{isFollowing ? '✓' : '+'}</span>
              <span className="font-mono opacity-60">f</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLike?.(); }}
              className={`flex items-center gap-0.5 ${btnSize} transition-colors cursor-pointer hover:opacity-80 ${
                isLiked
                  ? 'text-[var(--memphis-pink)]'
                  : 'text-white/40 hover:text-[var(--memphis-pink)]'
              }`}
              title={isLiked ? 'Unlike (l)' : 'Like (l)'}
            >
              <span>{isLiked ? '♥' : '♡'}</span>
              <span className="font-mono opacity-60">l</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBoost?.(); }}
              className={`flex items-center gap-0.5 ${btnSize} transition-colors cursor-pointer hover:opacity-80 ${
                isReposted
                  ? 'text-[var(--memphis-yellow)]'
                  : 'text-white/40 hover:text-[var(--memphis-yellow)]'
              }`}
              title={isReposted ? 'Unboost (b)' : 'Boost (b)'}
            >
              <span>{isReposted ? '⟲' : '↻'}</span>
              <span className="font-mono opacity-60">b</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReply?.(); }}
              className={`flex items-center gap-0.5 ${btnSize} text-white/40 hover:text-[var(--memphis-pink)] transition-colors cursor-pointer hover:opacity-80`}
              title="Reply (r)"
            >
              <span>💬</span>
              <span className="font-mono opacity-60">r</span>
            </button>

            {bskyUrl && (
              <a
                href={bskyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-0.5 ${btnSize} text-white/40 hover:text-[var(--memphis-cyan)] transition-colors cursor-pointer`}
                title="View on Bluesky (v)"
                onClick={(e) => e.stopPropagation()}
              >
                <span>↗</span>
                <span className="font-mono opacity-60">v</span>
              </a>
            )}

            {isFocused && (
              <span className={`${btnSize} text-[var(--memphis-pink)]`}>●</span>
            )}

          </div>
        )}
      </div>

      {/* Avatar - only shown when not hidden (narrow screens or when sidebar isn't used) */}
      {!hideAvatar && (
        <a
          href={`https://bsky.app/profile/${author.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {author.avatar ? (
            <img
              src={author.avatar}
              alt={author.displayName || author.handle}
              className="w-20 h-20 rounded-full border-2 border-[var(--memphis-cyan)]/50"
              loading="lazy"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-[var(--memphis-cyan)]/50 bg-white/10 flex items-center justify-center">
              <span className="text-white/50 text-2xl">
                {author.handle.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </a>
      )}
    </header>
  );
}
