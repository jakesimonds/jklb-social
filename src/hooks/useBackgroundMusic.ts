// useBackgroundMusic hook - Fetches Player FM liked songs and manages background audio playback
// Songs loop continuously. Music pauses when embedded video plays unmuted, resumes when video stops.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MusicSettings } from '../types';
import type { PlayerFMTrack } from '../lib/pds';
import { getPdsUrl, fetchPlayerFMLikes, resolveTrack } from '../lib/pds';
import { DEFAULT_MUSIC_SETTINGS } from '../lib/settings';

/** Module-level audio element — persists across re-renders, shared by all instances */
let audioElement: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.loop = true;
  }
  return audioElement;
}

export interface UseBackgroundMusicParams {
  did: string | null;
  isAuthenticated: boolean;
  musicSettings: MusicSettings;
  appPhase: 'beginning' | 'middle' | 'end';
}

export interface UseBackgroundMusicReturn {
  tracks: PlayerFMTrack[];
  isLoadingTracks: boolean;
}

export function useBackgroundMusic({
  did,
  isAuthenticated,
  musicSettings,
  appPhase,
}: UseBackgroundMusicParams): UseBackgroundMusicReturn {
  const [tracks, setTracks] = useState<PlayerFMTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  // Guard: fetch tracks only once per session
  const hasFetchedRef = useRef(false);

  // Track whether music was playing before a video-triggered pause
  // so we only resume if it was actually playing
  const wasPlayingBeforePauseRef = useRef(false);

  // Track the currently loaded audio URL to avoid re-setting src unnecessarily
  const currentAudioUrlRef = useRef<string | null>(null);

  // =========================================================================
  // Fetch tracks once when authenticated
  // =========================================================================
  // Reset fetch flag when music gets enabled so tracks load on demand
  useEffect(() => {
    if (musicSettings.enabled) {
      hasFetchedRef.current = false;
    }
  }, [musicSettings.enabled]);

  useEffect(() => {
    if (!isAuthenticated || !did || hasFetchedRef.current || !musicSettings.enabled) return;

    hasFetchedRef.current = true;
    setIsLoadingTracks(true);

    async function loadTracks() {
      try {
        // Resolve user's PDS URL from their DID
        const pdsUrl = await getPdsUrl(did!);

        // Fetch liked track references (skip if PDS unreachable)
        let validTracks: PlayerFMTrack[] = [];
        if (pdsUrl) {
          const likes = await fetchPlayerFMLikes(pdsUrl, did!);
          if (likes.length > 0) {
            const resolved = await Promise.all(
              likes.map((like) => resolveTrack(like.uri))
            );
            validTracks = resolved.filter(
              (t): t is PlayerFMTrack => t !== null
            );
          }
        }

        // Also resolve default tracks that aren't in the user's likes
        const defaultUris = [
          DEFAULT_MUSIC_SETTINGS.beginning,
          DEFAULT_MUSIC_SETTINGS.middle,
          DEFAULT_MUSIC_SETTINGS.end,
        ].filter((uri): uri is string => uri !== null && uri !== 'none');

        const missingDefaults = defaultUris.filter(
          (uri) => !validTracks.some((t) => t.uri === uri)
        );

        if (missingDefaults.length > 0) {
          const resolvedDefaults = await Promise.all(
            missingDefaults.map((uri) => resolveTrack(uri))
          );
          const validDefaults = resolvedDefaults.filter(
            (t): t is PlayerFMTrack => t !== null
          );
          validTracks = [...validTracks, ...validDefaults];
        }

        setTracks(validTracks);
      } catch (err) {
        console.error('[background-music] Failed to load tracks:', err);
      } finally {
        setIsLoadingTracks(false);
      }
    }

    loadTracks();
  }, [isAuthenticated, did, musicSettings.enabled]);

  // =========================================================================
  // Stop audio on logout
  // =========================================================================
  useEffect(() => {
    if (!isAuthenticated) {
      const audio = getAudioElement();
      audio.pause();
      audio.src = '';
      currentAudioUrlRef.current = null;
      pendingPlayRef.current = false;
    }
  }, [isAuthenticated]);

  // =========================================================================
  // Play/pause audio based on settings + current phase
  // =========================================================================
  useEffect(() => {
    const audio = getAudioElement();
    const trackUri = musicSettings.enabled ? musicSettings[appPhase] : null;

    if (!trackUri || trackUri === 'none') {
      // Music disabled or no track selected for this phase — pause
      audio.pause();
      currentAudioUrlRef.current = null;
      return;
    }

    // Find the matching track
    const track = tracks.find((t) => t.uri === trackUri);
    if (!track) return;

    // Only update src if it changed (avoids restarting the same song)
    if (currentAudioUrlRef.current !== track.audioUrl) {
      audio.src = track.audioUrl;
      currentAudioUrlRef.current = track.audioUrl;
    }

    audio.play().catch(() => {
      // Browser blocked autoplay — will retry on first user interaction
      pendingPlayRef.current = true;
    });
  }, [musicSettings.enabled, musicSettings.beginning, musicSettings.middle, musicSettings.end, appPhase, tracks]);

  // =========================================================================
  // Retry playback on first user interaction (browser autoplay policy)
  // When the page reloads with music enabled, audio.play() is blocked until
  // the user interacts. We keep a listener alive until playback succeeds.
  // =========================================================================
  const pendingPlayRef = useRef(false);

  useEffect(() => {
    function onInteraction() {
      if (!pendingPlayRef.current) return;
      const audio = getAudioElement();
      if (audio.src && audio.paused) {
        audio.play().then(() => {
          // Success — stop listening
          pendingPlayRef.current = false;
          document.removeEventListener('click', onInteraction);
          document.removeEventListener('keydown', onInteraction);
        }).catch(() => {
          // Still blocked — keep listening
        });
      }
    }

    document.addEventListener('click', onInteraction);
    document.addEventListener('keydown', onInteraction);

    return () => {
      document.removeEventListener('click', onInteraction);
      document.removeEventListener('keydown', onInteraction);
    };
  }, []);

  // =========================================================================
  // Listen for video pause/resume events
  // =========================================================================
  const handleMusicPause = useCallback(() => {
    const audio = getAudioElement();
    wasPlayingBeforePauseRef.current = !audio.paused;
    if (!audio.paused) {
      audio.pause();
    }
  }, []);

  const handleMusicResume = useCallback(() => {
    if (wasPlayingBeforePauseRef.current) {
      const audio = getAudioElement();
      audio.play().catch((err) => {
        console.warn('[background-music] Resume blocked:', err);
      });
      wasPlayingBeforePauseRef.current = false;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('backgroundMusicPause', handleMusicPause);
    document.addEventListener('backgroundMusicResume', handleMusicResume);

    return () => {
      document.removeEventListener('backgroundMusicPause', handleMusicPause);
      document.removeEventListener('backgroundMusicResume', handleMusicResume);
    };
  }, [handleMusicPause, handleMusicResume]);

  // =========================================================================
  // Cleanup on unmount — pause audio
  // =========================================================================
  useEffect(() => {
    return () => {
      const audio = getAudioElement();
      audio.pause();
      currentAudioUrlRef.current = null;
    };
  }, []);

  return {
    tracks,
    isLoadingTracks,
  };
}
