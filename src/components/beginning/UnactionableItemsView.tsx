/**
 * UnactionableItemsView - Paginated likes & boosts slides.
 *
 * Shows up to 2 posts per slide, each surrounded by square avatar tiles
 * of the people who liked/boosted. Likes slides come first, then boosts.
 * Avatar tiles are the same component as the Like Chorus (PerimeterCell)
 * with ProfileHover on hover.
 *
 * j/k navigation handled by parent (BeginningView).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent } from '@atproto/api';
import type { UnactionableSlide, NotificationActor } from '../../hooks/useBeginning';
import type { Post } from '../../types';
import { transformPostView } from '../../lib/feed';
import { MiniPostCard } from '../MiniPostCard';
import { PerimeterCell } from '../PerimeterCell';
import { ProfileHover, calculateHoverPosition } from '../ProfileHover';
import type { ProfileHoverData } from '../ProfileHover';

interface UnactionableItemsViewProps {
  slides: UnactionableSlide[];
  currentIndex: number;
  agent: Agent;
}

/** Distribute actors into 4 positions around a post (round-robin) */
function distributeActors(actors: NotificationActor[]): {
  top: NotificationActor[];
  right: NotificationActor[];
  bottom: NotificationActor[];
  left: NotificationActor[];
} {
  const groups = {
    top: [] as NotificationActor[],
    right: [] as NotificationActor[],
    bottom: [] as NotificationActor[],
    left: [] as NotificationActor[],
  };
  const positions = ['top', 'right', 'bottom', 'left'] as const;
  actors.forEach((actor, i) => {
    groups[positions[i % 4]].push(actor);
  });
  return groups;
}

/** A single avatar tile — same visual treatment as chorus avatars */
function AvatarTile({
  actor,
  accentColor,
  onMouseEnter,
  onMouseLeave,
}: {
  actor: NotificationActor;
  accentColor: string;
  onMouseEnter: (actor: NotificationActor, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={(e) => onMouseEnter(actor, e)}
      onMouseLeave={onMouseLeave}
    >
      <PerimeterCell
        onClick={() => window.open(`https://bsky.app/profile/${actor.handle}`, '_blank')}
        title={actor.displayName || `@${actor.handle}`}
        className={`!p-0 overflow-hidden`}
      >
        {actor.avatar ? (
          <img
            src={actor.avatar}
            alt={actor.displayName || actor.handle}
            className="w-full h-full object-cover"
            style={{ borderBottom: `3px solid ${accentColor}` }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: accentColor }}
          >
            {actor.handle.charAt(0).toUpperCase()}
          </div>
        )}
      </PerimeterCell>
    </div>
  );
}

/** Render a row/column of avatar tiles */
function AvatarGroup({
  actors,
  accentColor,
  direction,
  onMouseEnter,
  onMouseLeave,
}: {
  actors: NotificationActor[];
  accentColor: string;
  direction: 'row' | 'column';
  onMouseEnter: (actor: NotificationActor, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  if (actors.length === 0) return null;
  return (
    <div className={`flex ${direction === 'row' ? 'flex-row' : 'flex-col'} gap-1 ${direction === 'row' ? 'justify-center' : 'justify-center'}`}>
      {actors.map((actor) => (
        <AvatarTile
          key={actor.did}
          actor={actor}
          accentColor={accentColor}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      ))}
    </div>
  );
}


/** A single post card with avatars arranged around it */
function PostWithAvatars({
  actors,
  snippet,
  accentColor,
  onAvatarHoverEnter,
  onAvatarHoverLeave,
}: {
  actors: NotificationActor[];
  snippet: Post | undefined;
  accentColor: string;
  onAvatarHoverEnter: (actor: NotificationActor, e: React.MouseEvent) => void;
  onAvatarHoverLeave: () => void;
}) {
  const distributed = distributeActors(actors);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Top avatars */}
      <AvatarGroup
        actors={distributed.top}
        accentColor={accentColor}
        direction="row"
        onMouseEnter={onAvatarHoverEnter}
        onMouseLeave={onAvatarHoverLeave}
      />

      <div className="flex items-center gap-1">
        {/* Left avatars */}
        <AvatarGroup
          actors={distributed.left}
          accentColor={accentColor}
          direction="column"
          onMouseEnter={onAvatarHoverEnter}
          onMouseLeave={onAvatarHoverLeave}
        />

        {/* Post card — purpose-built mini component, no media */}
        {snippet ? (
          <MiniPostCard post={snippet} accentColor={accentColor} />
        ) : (
          <div
            className="rounded-lg border-2 bg-[var(--memphis-bg-secondary)] p-3 flex flex-col justify-center"
            style={{ borderColor: accentColor, maxWidth: 320, minHeight: 80 }}
          >
            <span className="text-[var(--memphis-text-muted)] italic text-sm text-center">
              loading...
            </span>
          </div>
        )}

        {/* Right avatars */}
        <AvatarGroup
          actors={distributed.right}
          accentColor={accentColor}
          direction="column"
          onMouseEnter={onAvatarHoverEnter}
          onMouseLeave={onAvatarHoverLeave}
        />
      </div>

      {/* Bottom avatars */}
      <AvatarGroup
        actors={distributed.bottom}
        accentColor={accentColor}
        direction="row"
        onMouseEnter={onAvatarHoverEnter}
        onMouseLeave={onAvatarHoverLeave}
      />
    </div>
  );
}

export function UnactionableItemsView({ slides, currentIndex, agent }: UnactionableItemsViewProps) {
  const [snippets, setSnippets] = useState<Map<string, Post>>(new Map());

  // ProfileHover state (self-contained, same behavior as chorus hover)
  const [hoveredProfile, setHoveredProfile] = useState<ProfileHoverData | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ top: number; left: number } | null>(null);
  const profileCacheRef = useRef<Map<string, ProfileHoverData>>(new Map());
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all post texts on mount (covers all slides)
  useEffect(() => {
    if (slides.length === 0) return;

    const allUris = new Set<string>();
    for (const slide of slides) {
      for (const item of slide.items) {
        allUris.add(item.postUri);
      }
    }

    const fetchPosts = async () => {
      const uris = Array.from(allUris);
      const allSnippets = new Map<string, Post>();
      for (let i = 0; i < uris.length; i += 25) {
        const batch = uris.slice(i, i + 25);
        try {
          const response = await agent.getPosts({ uris: batch });
          for (const postView of response.data.posts) {
            const post = transformPostView(
              postView as Parameters<typeof transformPostView>[0]
            );
            allSnippets.set(post.uri, post);
          }
        } catch (err) {
          console.error('UnactionableItemsView: Failed to fetch posts:', err);
        }
      }
      setSnippets(allSnippets);
    };

    fetchPosts();
  }, [slides, agent]);

  // Avatar hover handlers (same pattern as AppLayout chorus hover)
  const handleAvatarMouseEnter = useCallback(async (
    actor: NotificationActor,
    event: React.MouseEvent
  ) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = calculateHoverPosition(rect);
    setHoverPosition(position);

    const cached = profileCacheRef.current.get(actor.did);
    if (cached) {
      setHoveredProfile(cached);
      return;
    }

    const basicProfile: ProfileHoverData = {
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName,
      avatar: actor.avatar,
    };
    setHoveredProfile(basicProfile);

    try {
      const response = await agent.getProfile({ actor: actor.did });
      const fullProfile: ProfileHoverData = {
        did: response.data.did,
        handle: response.data.handle,
        displayName: response.data.displayName,
        avatar: response.data.avatar,
        description: response.data.description,
      };
      profileCacheRef.current.set(actor.did, fullProfile);
      setHoveredProfile(fullProfile);
    } catch {
      profileCacheRef.current.set(actor.did, basicProfile);
    }
  }, [agent]);

  const handleAvatarMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredProfile(null);
      setHoverPosition(null);
    }, 150);
  }, []);

  const handleHoverCardMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleHoverCardMouseLeave = useCallback(() => {
    setHoveredProfile(null);
    setHoverPosition(null);
  }, []);

  if (slides.length === 0) return null;

  const slide = slides[currentIndex];
  if (!slide) return null;

  const accentColor = slide.type === 'like'
    ? 'var(--memphis-pink)'
    : 'var(--memphis-yellow)';

  return (
    <div className="flex flex-col w-full">
      {/* Posts with avatars — centered, side by side */}
      <div className="flex-1 flex items-center justify-center gap-8 px-4 py-4">
        {slide.items.map((item) => (
          <PostWithAvatars
            key={`${slide.type}-${item.postUri}`}
            actors={item.actors}
            snippet={snippets.get(item.postUri)}
            accentColor={accentColor}
            onAvatarHoverEnter={handleAvatarMouseEnter}
            onAvatarHoverLeave={handleAvatarMouseLeave}
          />
        ))}
      </div>

      {/* ProfileHover card (same as chorus hover) */}
      {hoveredProfile && hoverPosition && (
        <div
          className="fixed z-50"
          style={{ top: hoverPosition.top, left: hoverPosition.left }}
          onMouseEnter={handleHoverCardMouseEnter}
          onMouseLeave={handleHoverCardMouseLeave}
        >
          <ProfileHover
            profile={hoveredProfile}
            isVisible={true}
            className="relative"
          />
        </div>
      )}
    </div>
  );
}
