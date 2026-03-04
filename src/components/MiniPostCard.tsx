/**
 * MiniPostCard - A tiny, text-only post card for likes/boosts notifications.
 *
 * Shows: author name, handle, timestamp, post text, view-on-Bluesky link.
 * Hides: avatar, images, video, media, follow/like/boost/reply buttons, J/K arrows.
 * Quoted posts are collapsed to a single attribution line.
 */

import type { Post } from '../types';
import { formatRelativeTime, buildBskyPostUrl } from '../lib/post-utils';

interface MiniPostCardProps {
  post: Post;
  accentColor: string;
}

export function MiniPostCard({ post, accentColor }: MiniPostCardProps) {
  const formattedTime = formatRelativeTime(post.indexedAt);
  const bskyUrl = buildBskyPostUrl(post.author.handle, post.uri);

  const quotedPost = post.embed?.record;
  const external = post.embed?.external;

  return (
    <article
      className="rounded-lg border-2 bg-[var(--memphis-bg)] overflow-hidden"
      style={{ borderColor: accentColor, maxWidth: 320 }}
    >
      {/* Compact header: name · @handle · time · ↗v */}
      <header className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 border-b border-white/10">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate leading-tight">
              {post.author.displayName || post.author.handle}
            </span>
            <time className="text-[9px] text-white/40 flex-shrink-0 leading-tight" dateTime={post.indexedAt}>
              {formattedTime}
            </time>
          </div>
          <span className="text-[9px] text-[var(--memphis-cyan)] truncate leading-tight">
            @{post.author.handle}
          </span>
        </div>

        {/* View on Bluesky */}
        {bskyUrl && (
          <a
            href={bskyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[10px] text-white/40 hover:text-[var(--memphis-cyan)] transition-colors cursor-pointer flex-shrink-0"
            title="View on Bluesky (v)"
            onClick={(e) => e.stopPropagation()}
          >
            <span>↗</span>
            <span className="font-mono opacity-60">v</span>
          </a>
        )}
      </header>

      {/* Post text */}
      <div className="px-2 py-1.5">
        {post.text && (
          <p className="text-[11px] whitespace-pre-wrap break-words leading-relaxed">
            {post.text}
          </p>
        )}

        {/* Quoted post — collapsed to single attribution line */}
        {quotedPost && (
          <div className="mt-1 text-[10px] text-white/50 flex items-center gap-1">
            <span className="text-[var(--memphis-cyan)]">↩</span>
            <span>quoted</span>
            <span className="text-[var(--memphis-cyan)] truncate">
              @{quotedPost.author.handle}
            </span>
          </div>
        )}

        {/* External link — simple text link, no preview card */}
        {external && !quotedPost && (
          <a
            href={external.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-[10px] text-[var(--memphis-cyan)] hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {external.title || external.uri}
          </a>
        )}
      </div>
    </article>
  );
}
