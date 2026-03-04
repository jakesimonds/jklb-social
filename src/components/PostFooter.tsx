/**
 * PostFooter - Action buttons for posts with hotkey indicators
 */

import { buildBskyPostUrl } from '../lib/post-utils';

interface PostFooterProps {
  uri: string;
  handle: string;
  isLiked: boolean;
  isReposted: boolean;
  isFocused: boolean;
}

export function PostFooter({ uri, handle, isLiked, isReposted, isFocused }: PostFooterProps) {
  const bskyUrl = buildBskyPostUrl(handle, uri);

  return (
    <footer className="flex items-center gap-4 sm:gap-6 px-2 sm:px-3 py-1.5 sm:py-2 border-t border-white/10 flex-shrink-0">
      <span
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLiked
            ? 'text-[var(--memphis-pink)]'
            : 'text-white/40 hover:text-white/60'
        }`}
        title={isLiked ? 'Unlike (l)' : 'Like (l)'}
      >
        <span>{isLiked ? '♥' : '♡'}</span>
        <span className="font-mono text-xs opacity-60">l</span>
      </span>

      <span
        className={`flex items-center gap-1 text-sm transition-colors ${
          isReposted
            ? 'text-[var(--memphis-yellow)]'
            : 'text-white/40 hover:text-white/60'
        }`}
        title={isReposted ? 'Unboost (b)' : 'Boost (b)'}
      >
        <span>{isReposted ? '⟲' : '↻'}</span>
        <span className="font-mono text-xs opacity-60">b</span>
      </span>

      <span
        className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors"
        title="Reply (r)"
      >
        <span>💬</span>
        <span className="font-mono text-xs opacity-60">r</span>
      </span>

      {bskyUrl && (
        <a
          href={bskyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-white/40 hover:text-[var(--memphis-cyan)] transition-colors cursor-pointer"
          title="View on Bluesky (v)"
          onClick={(e) => e.stopPropagation()}
        >
          <span>↗</span>
          <span className="font-mono text-xs opacity-60">v</span>
        </a>
      )}

      {isFocused && (
        <div className="ml-auto text-xs text-[var(--memphis-pink)]">
          ●
        </div>
      )}
    </footer>
  );
}
