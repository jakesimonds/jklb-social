/**
 * PostCard - Displays an individual post with full nesting support
 *
 * Features:
 * - Author avatar, handle, displayName, and timestamp
 * - Post text (full text shown, never truncated - "text is sacred")
 * - Media embed (images or video) via MediaEmbed component
 * - Link preview for external links via LinkPreview component
 * - Quoted post nesting (QuotedPost can also have media/links)
 * - Visual indicators for liked/reposted state
 * - Focus indicator for keyboard navigation (pink border when selected)
 */

import { useState, useEffect } from 'react';
import type { Post } from '../types';
import { isTenorEmbed, getTenorVideo } from '../lib/post-utils';
import { MediaEmbed } from './MediaEmbed';
import { LinkPreview } from './LinkPreview';
import { QuotedPost } from './QuotedPost';
import { PostHeader } from './PostHeader';
import { RichText } from './RichText';
import { PROFILE_PIC_SIZE } from '../lib/flags';
import { useSettings } from '../lib/SettingsContext';

const WIDE_MODE_BREAKPOINT = 900;

// Avatar sizes for thread view hierarchy
const THREAD_MAIN_AVATAR_SIZE = 300; // Main author gets full size
const THREAD_OTHER_AVATAR_SIZE = 40; // Other authors get small size

// Size configuration for sm/md/lg PostCard variants
const SIZE_CONFIG = {
  sm: {
    text: 'text-[10px] sm:text-xs',
    headerText: 'text-[9px]',
    padding: 'p-1.5 sm:p-2',
    avatarSize: 60,
    avatarPadding: 'p-1.5',
    avatarBorder: 'border-2',
    gap: 'gap-1',
    maxHeight: 'max-h-[180px]',
    mediaMaxHeight: 'max-h-[100px]',
    borderWidth: 'border',
  },
  md: {
    text: 'text-xs sm:text-sm',
    headerText: 'text-[10px] sm:text-xs',
    padding: 'p-2 sm:p-2.5',
    avatarSize: 100,
    avatarPadding: 'p-2',
    avatarBorder: 'border-3',
    gap: 'gap-2',
    maxHeight: 'max-h-[280px]',
    mediaMaxHeight: 'max-h-[160px]',
    borderWidth: 'border-[1.5px]',
  },
  lg: {
    text: 'text-xs sm:text-sm',
    headerText: 'text-xs',
    padding: 'p-2 sm:p-3',
    avatarSize: null as number | null, // uses PROFILE_PIC_SIZE
    avatarPadding: 'p-3',
    avatarBorder: 'border-4',
    gap: 'gap-2',
    maxHeight: 'max-h-full',
    mediaMaxHeight: '',
    borderWidth: 'border-2',
  },
} as const;

interface PostCardProps {
  post: Post;
  /** Display size: 'sm' for notification cards, 'md' for intermediate, 'lg' (default) for normal */
  size?: 'sm' | 'md' | 'lg';
  isFocused?: boolean;
  isInThread?: boolean; // Forces solid background for thread view
  threadMainAuthorDid?: string | null; // DID of thread's main author (for avatar sizing)
  isFirstInThread?: boolean; // Is this the first post in the thread?
  // Action handlers for clickable buttons
  onFollow?: () => void;
  onLike?: () => void;
  onBoost?: () => void;
  onReply?: () => void;
  onImageClick?: () => void;
  hideActions?: boolean; // Hide action buttons (f/l/b/r/v) — used for read-only parent context
  /** URL of the currently highlighted link (for O key) */
  activeUrl?: string;
  /** Whether the quoted post is the current focus target (Shift+J/K) */
  isFocusedOnQuote?: boolean;
}

export function PostCard({
  post,
  size = 'lg',
  isFocused = false,
  isInThread = false,
  threadMainAuthorDid = null,
  isFirstInThread = false,
  onFollow,
  onLike,
  onBoost,
  onReply,
  onImageClick,
  hideActions = false,
  activeUrl,
  isFocusedOnQuote = false,
}: PostCardProps) {
  const { settings } = useSettings();
  const textSizeClass = settings.feed.postTextSize !== 'small' ? `post-text-${settings.feed.postTextSize}` : '';
  const sizeConfig = SIZE_CONFIG[size];

  const [isWideViewport, setIsWideViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= WIDE_MODE_BREAKPOINT : false
  );

  // Determine avatar size for thread view
  // - First post in thread: full size (main author prominent)
  // - Same author as main: no avatar (they're already established)
  // - Different author: small avatar (secondary visual hierarchy)
  const isMainAuthor = threadMainAuthorDid && post.author.did === threadMainAuthorDid;
  const showThreadAvatar = isInThread && !isFirstInThread && !isMainAuthor;
  const threadAvatarSize = showThreadAvatar ? THREAD_OTHER_AVATAR_SIZE : THREAD_MAIN_AVATAR_SIZE;

  // For thread view, only show avatar sidebar for first post OR different authors
  const showAvatarInThread = isInThread && (isFirstInThread || !isMainAuthor);

  useEffect(() => {
    const handleResize = () => {
      setIsWideViewport(window.innerWidth >= WIDE_MODE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const embed = post.embed;
  const images = embed?.images;
  const video = embed?.video;
  const external = embed?.external;
  const quotedPost = embed?.record;

  const isTenor = external && isTenorEmbed(external);
  const tenorVideo = isTenor ? getTenorVideo(external) : null;

  const hasImages = images && images.length > 0;
  const hasVideo = video !== undefined;
  const hasQuote = quotedPost !== undefined;
  const hasMedia = hasImages || hasVideo || tenorVideo;
  const showLinkPreview = external && !isTenor && !hasImages && !hasVideo;
  const useTwoColumnLayout = isWideViewport && hasQuote && hasMedia;

  // Check if the external link preview is the active link
  const isLinkPreviewActive = !!(activeUrl && external?.uri === activeUrl);

  return (
    <article
      className={`
        rounded-lg ${sizeConfig.borderWidth} transition-all duration-200
        flex ${sizeConfig.maxHeight} overflow-hidden ${textSizeClass}
        ${isInThread
          ? 'border-[var(--memphis-cyan)]/50 bg-[var(--memphis-navy)] shadow-lg'
          : isFocused
            ? 'border-[var(--memphis-pink)] bg-[var(--memphis-bg)] shadow-lg shadow-[var(--memphis-pink)]/20'
            : 'border-white/20 bg-[var(--memphis-bg)] hover:border-white/30'
        }
      `}
      data-post-uri={post.uri}
    >
      {/* Avatar sidebar - only on wide screens, with thread-aware sizing */}
      {isWideViewport && (!isInThread || showAvatarInThread) && (
        <a
          href={`https://bsky.app/profile/${post.author.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-shrink-0 border-r border-white/10 flex items-start cursor-pointer hover:opacity-80 transition-opacity ${
            isInThread && !isFirstInThread ? 'p-2' : sizeConfig.avatarPadding
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {post.author.avatar ? (
            <img
              src={post.author.avatar}
              alt={post.author.displayName || post.author.handle}
              className={`rounded-none border-[var(--memphis-cyan)]/50 ${
                isInThread && !isFirstInThread ? 'border-2' : sizeConfig.avatarBorder
              }`}
              style={{
                width: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : (sizeConfig.avatarSize ?? PROFILE_PIC_SIZE),
                height: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : (sizeConfig.avatarSize ?? PROFILE_PIC_SIZE),
              }}
              loading="lazy"
            />
          ) : (
            <div
              className={`rounded-none border-[var(--memphis-cyan)]/50 bg-white/10 flex items-center justify-center ${
                isInThread && !isFirstInThread ? 'border-2' : sizeConfig.avatarBorder
              }`}
              style={{
                width: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : (sizeConfig.avatarSize ?? PROFILE_PIC_SIZE),
                height: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : (sizeConfig.avatarSize ?? PROFILE_PIC_SIZE),
              }}
            >
              <span className={`text-white/50 ${isInThread && !isFirstInThread ? 'text-lg' : 'text-6xl'}`}>
                {post.author.handle.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </a>
      )}

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {post.repostReason && (
          <div className="px-2 sm:px-3 py-1 text-xs flex items-center gap-1.5 bg-white/5 text-white/50 border-b border-white/10 flex-shrink-0">
            <span className="text-[var(--memphis-yellow)]">↻</span>
            <span>Boosted by</span>
            <span className="text-[var(--memphis-yellow)] font-medium truncate">
              {post.repostReason.by.displayName || `@${post.repostReason.by.handle}`}
            </span>
          </div>
        )}

        <PostHeader
          author={post.author}
          indexedAt={post.indexedAt}
          hideAvatar={true}
          uri={hideActions ? undefined : post.uri}
          isLiked={post.isLiked}
          isReposted={post.isReposted}
          isFollowing={post.author.isFollowing}
          isFocused={isFocused}
          compact={size === 'sm'}
          onFollow={onFollow}
          onLike={onLike}
          onBoost={onBoost}
          onReply={onReply}
        />

      {post.replyParent && (
        <div className="px-2 sm:px-3 py-1 text-xs flex items-center gap-1 bg-white/5 text-white/50 flex-shrink-0">
          <span className="text-[var(--memphis-cyan)]">↩</span>
          <span>Replying to</span>
          <span className="text-[var(--memphis-cyan)] truncate">
            {post.replyParent.author.handle && !post.replyParent.author.handle.startsWith('did:')
              ? `@${post.replyParent.author.handle}`
              : 'you'}
          </span>
        </div>
      )}

      <div className={`${sizeConfig.padding} flex-1 min-h-0 flex flex-col overflow-y-auto`}>
        {post.text && (
          <RichText
            text={post.text}
            linkFacets={post.linkFacets}
            activeUrl={activeUrl}
            className={`${sizeConfig.text} whitespace-pre-wrap break-words leading-relaxed`}
          />
        )}

        {useTwoColumnLayout ? (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="min-w-0">
              {tenorVideo ? (
                <MediaEmbed
                  video={{
                    playlist: tenorVideo.playlist,
                    thumbnail: tenorVideo.thumbnail,
                    aspectRatio: tenorVideo.aspectRatio,
                  }}
                  maxHeight="max-h-[40vh]"
                />
              ) : (
                <MediaEmbed images={images} video={video} maxHeight="max-h-[40vh]" onImageClick={onImageClick ? () => onImageClick() : undefined} />
              )}
            </div>
            <div className="min-w-0">
              {quotedPost && <QuotedPost quote={quotedPost} variant="wide" activeUrl={activeUrl} onImageClick={onImageClick} isFocused={isFocusedOnQuote} />}
            </div>
          </div>
        ) : (
          <>
            {tenorVideo ? (
              <MediaEmbed
                video={{
                  playlist: tenorVideo.playlist,
                  thumbnail: tenorVideo.thumbnail,
                  aspectRatio: tenorVideo.aspectRatio,
                }}
                {...(sizeConfig.mediaMaxHeight ? { maxHeight: sizeConfig.mediaMaxHeight } : {})}
              />
            ) : (
              <MediaEmbed
                images={images}
                video={video}
                {...(sizeConfig.mediaMaxHeight ? { maxHeight: sizeConfig.mediaMaxHeight } : {})}
                onImageClick={onImageClick ? () => onImageClick() : undefined}
              />
            )}

            {showLinkPreview && external && (
              <LinkPreview external={external} isHighlighted={isLinkPreviewActive} />
            )}

            {hasQuote && quotedPost && (
              <QuotedPost quote={quotedPost} activeUrl={activeUrl} onImageClick={onImageClick} isFocused={isFocusedOnQuote} />
            )}
          </>
        )}

        {useTwoColumnLayout && showLinkPreview && external && (
          <LinkPreview external={external} isHighlighted={isLinkPreviewActive} />
        )}
      </div>

        {/* Avatar below content - only on narrow screens, with thread-aware sizing */}
        {/* Uses flex-shrink so avatar compresses before header disappears */}
        {!isWideViewport && (!isInThread || showAvatarInThread) && (
          <a
            href={`https://bsky.app/profile/${post.author.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex justify-center border-t border-white/10 cursor-pointer hover:opacity-80 transition-opacity flex-shrink ${
              isInThread && !isFirstInThread ? 'p-2' : sizeConfig.avatarPadding
            }`}
            style={{ minHeight: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {post.author.avatar ? (
              <img
                src={post.author.avatar}
                alt={post.author.displayName || post.author.handle}
                className={`rounded-none border-[var(--memphis-cyan)]/50 max-h-full object-contain ${
                  isInThread && !isFirstInThread ? 'border-2' : sizeConfig.avatarBorder
                }`}
                style={{
                  width: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : Math.min(sizeConfig.avatarSize ?? PROFILE_PIC_SIZE, 150),
                  height: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : Math.min(sizeConfig.avatarSize ?? PROFILE_PIC_SIZE, 150),
                }}
                loading="lazy"
              />
            ) : (
              <div
                className={`rounded-none border-[var(--memphis-cyan)]/50 bg-white/10 flex items-center justify-center ${
                  isInThread && !isFirstInThread ? 'border-2' : sizeConfig.avatarBorder
                }`}
                style={{
                  width: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : Math.min(sizeConfig.avatarSize ?? PROFILE_PIC_SIZE, 150),
                  height: isInThread ? (isFirstInThread ? THREAD_MAIN_AVATAR_SIZE : threadAvatarSize) : Math.min(sizeConfig.avatarSize ?? PROFILE_PIC_SIZE, 150),
                }}
              >
                <span className={`text-white/50 ${isInThread && !isFirstInThread ? 'text-lg' : 'text-6xl'}`}>
                  {post.author.handle.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </a>
        )}
      </div>
    </article>
  );
}
