/**
 * NewFollowerCard - Displays a new follower notification in the Beginning flow.
 *
 * Matches the BeginningPostCard pattern:
 * - Tiled cover photo as full-stage background
 * - Big colorful "New Follower" header
 * - Profile card with colored outline and solid background
 *
 * Registers f/v action handlers via setBeginningActions for centralized keybinding routing.
 * Navigation (j/k) is handled by useKeybindings in App.tsx.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Agent } from '@atproto/api';
import type { BeginningNotification } from '../../hooks/useBeginning';
import { toggleFollow } from '../../lib/actions';
import { PROFILE_PIC_SIZE } from '../../lib/flags';

interface NewFollowerCardProps {
  follower: BeginningNotification;
  agent: Agent;
  index: number;
  total: number;
  /** Register action handlers with parent for centralized keybinding routing */
  setBeginningActions?: (actions: {
    like?: () => void;
    boost?: () => void;
    follow?: () => void;
    viewOnBluesky?: () => void;
  } | null) => void;
}

interface FollowerProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  banner?: string;
  description?: string;
  followersCount: number;
  followsCount: number;
  isFollowing: boolean;
  followUri?: string;
}

export function NewFollowerCard({ follower, agent, index, total, setBeginningActions }: NewFollowerCardProps) {
  const [profile, setProfile] = useState<FollowerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowPending, setIsFollowPending] = useState(false);

  // Fetch full profile on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const fetchProfile = async () => {
      try {
        const response = await agent.getProfile({ actor: follower.actor.did });
        if (cancelled) return;
        const data = response.data;
        setProfile({
          did: data.did,
          handle: data.handle,
          displayName: data.displayName,
          avatar: data.avatar,
          banner: data.banner,
          description: data.description,
          followersCount: data.followersCount ?? 0,
          followsCount: data.followsCount ?? 0,
          isFollowing: !!data.viewer?.following,
          followUri: data.viewer?.following,
        });
      } catch (err) {
        console.error('NewFollowerCard: Failed to fetch profile:', err);
        if (cancelled) return;
        setProfile({
          did: follower.actor.did,
          handle: follower.actor.handle,
          displayName: follower.actor.displayName,
          avatar: follower.actor.avatar,
          description: undefined,
          followersCount: 0,
          followsCount: 0,
          isFollowing: false,
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => { cancelled = true; };
  }, [agent, follower.actor.did, follower.actor.handle, follower.actor.displayName, follower.actor.avatar]);

  const handleFollow = useCallback(async () => {
    if (!profile || isFollowPending) return;

    setIsFollowPending(true);
    const originalFollowing = profile.isFollowing;
    const originalUri = profile.followUri;

    setProfile(prev => prev ? {
      ...prev,
      isFollowing: !prev.isFollowing,
      followUri: prev.isFollowing ? undefined : 'pending',
    } : prev);

    const result = await toggleFollow(agent, profile.did, profile.followUri);

    if (result.success) {
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: result.isFollowing,
        followUri: result.followUri,
      } : prev);
    } else {
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: originalFollowing,
        followUri: originalUri,
      } : prev);
    }

    setIsFollowPending(false);
  }, [agent, profile, isFollowPending]);

  const handleViewProfile = useCallback(() => {
    const handle = profile?.handle || follower.actor.handle;
    window.open(`https://bsky.app/profile/${handle}`, '_blank', 'noopener,noreferrer');
  }, [profile?.handle, follower.actor.handle]);

  // Register action handlers with parent for centralized keybinding routing
  useEffect(() => {
    setBeginningActions?.({ follow: handleFollow, viewOnBluesky: handleViewProfile });
    return () => setBeginningActions?.(null);
  }, [handleFollow, handleViewProfile, setBeginningActions]);

  const displayName = profile?.displayName || follower.actor.displayName || follower.actor.handle;
  const handle = profile?.handle || follower.actor.handle;
  const avatarUrl = profile?.avatar || follower.actor.avatar;
  if (isLoading) {
    return (
      <div className="flex flex-col w-full">
        {total > 1 && (
          <p className="text-xs text-[var(--memphis-text-muted)] text-center mb-2">
            {index + 1} of {total}
          </p>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[var(--memphis-text-muted)] text-sm italic">loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {total > 1 && (
        <p className="text-xs text-[var(--memphis-text-muted)] text-center mb-2">
          {index + 1} of {total}
        </p>
      )}

      {/* Profile card content */}
      <div className="flex w-full">
        {/* Avatar sidebar */}
        <div className="flex-shrink-0 border-r border-white/10 relative overflow-hidden">
          <a
            href={`https://bsky.app/profile/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block p-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="rounded-none border-4 border-[var(--memphis-cyan)]/50"
                style={{ width: PROFILE_PIC_SIZE, height: PROFILE_PIC_SIZE }}
                loading="lazy"
              />
            ) : (
              <div
                className="rounded-none border-4 border-[var(--memphis-cyan)]/50 bg-white/10 flex items-center justify-center"
                style={{ width: PROFILE_PIC_SIZE, height: PROFILE_PIC_SIZE }}
              >
                <span className="text-white/50 text-6xl">
                  {handle.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </a>
        </div>

        {/* Main content column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header — name, handle, actions */}
          <header className="flex items-start gap-3 px-2 sm:px-3 pt-1.5 pb-1 border-b border-white/10 flex-shrink-0">
            <div className="flex-1 min-w-0 flex items-start gap-2">
              {/* Text stack */}
              <div className="flex flex-col min-w-0">
                <span className="text-sm sm:text-base font-medium truncate leading-tight">
                  {displayName}
                </span>
                <a
                  href={`https://bsky.app/profile/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--memphis-cyan)] truncate hover:underline leading-tight"
                >
                  @{handle}
                </a>
              </div>

              {/* Action buttons — pushed right */}
              <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={isFollowPending}
                  className={`flex items-center gap-0.5 text-xs transition-colors cursor-pointer hover:opacity-80 ${
                    profile?.isFollowing
                      ? 'text-[var(--memphis-cyan)]'
                      : 'text-white/40 hover:text-[var(--memphis-cyan)]'
                  }`}
                  title={profile?.isFollowing ? 'Unfollow (f)' : 'Follow (f)'}
                >
                  <span>{profile?.isFollowing ? '✓' : '+'}</span>
                  <span className="font-mono opacity-60">f</span>
                </button>

                <a
                  href={`https://bsky.app/profile/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-xs text-white/40 hover:text-[var(--memphis-cyan)] transition-colors cursor-pointer"
                  title="View on Bluesky (v)"
                >
                  <span>↗</span>
                  <span className="font-mono opacity-60">v</span>
                </a>
              </div>
            </div>
          </header>

          {/* Bio content */}
          <div className="p-2 sm:p-3 flex-1 min-h-0 flex flex-col">
            {profile?.description && (
              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                {profile.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

