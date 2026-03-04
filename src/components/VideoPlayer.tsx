/**
 * VideoPlayer - Video player component supporting HLS and direct video files
 *
 * Features:
 * - HLS stream support via hls.js (for Bluesky native videos)
 * - Direct MP4/WebM support (for Tenor GIFs and other direct videos)
 * - Native playback fallback for Safari (which has native HLS)
 * - Autoplay when visible (muted by default for browser autoplay policies)
 * - Click to toggle sound on/off
 * - ';' key toggles sound (via global toggleVideoSound event)
 * - Speaker icon shows muted/unmuted state
 * - Max height constraint to fit viewport
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  playlist: string;
  thumbnail?: string;
  aspectRatio?: { width: number; height: number };
  maxHeight?: string;
  /** Whether video should autoplay when loaded */
  autoplay?: boolean;
}

// Check HLS support at module level (doesn't change during runtime)
const hlsJsSupported = Hls.isSupported();
const nativeHlsSupported =
  typeof document !== 'undefined' &&
  document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';

/**
 * Check if URL is a direct video file (not HLS)
 */
function isDirectVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
}

export function VideoPlayer({
  playlist,
  thumbnail,
  // Note: aspectRatio kept in interface for API compatibility, but natural video sizing is used instead
  maxHeight = 'max-h-[35vh]',
  autoplay = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Ref to track current muted state for event handlers (avoids stale closure)
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Check if this is a direct video URL (not HLS)
  const isDirectVideo = useMemo(() => isDirectVideoUrl(playlist), [playlist]);

  // Determine if HLS is supported at all (only matters for HLS streams)
  const hlsSupported = useMemo(
    () => isDirectVideo || hlsJsSupported || nativeHlsSupported,
    [isDirectVideo]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Direct video file (MP4, WebM) - just set src directly
    if (isDirectVideo) {
      video.src = playlist;
      const handleError = () => setHasError(true);
      const handleCanPlay = () => {
        if (autoplay) {
          video.play().catch((err: Error) => {
            // NotAllowedError is expected when browser blocks autoplay - not a real error
            if (err.name !== 'NotAllowedError') {
              console.warn('Video playback failed:', err.message);
            }
          });
        }
      };
      video.addEventListener('error', handleError);
      video.addEventListener('canplay', handleCanPlay);
      return () => {
        video.removeEventListener('error', handleError);
        video.removeEventListener('canplay', handleCanPlay);
      };
    }

    // Use hls.js if available (for HLS streams)
    if (hlsJsSupported) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1, // Auto quality selection
      });

      hls.loadSource(playlist);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoplay) {
          video.play().catch((err: Error) => {
            // NotAllowedError is expected when browser blocks autoplay - not a real error
            if (err.name !== 'NotAllowedError') {
              console.warn('HLS video playback failed:', err.message);
            }
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover from network error
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Try to recover from media error
              hls.recoverMediaError();
              break;
            default:
              // Cannot recover, show error state
              setHasError(true);
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (nativeHlsSupported) {
      // Native HLS support (Safari)
      video.src = playlist;
      const handleError = () => setHasError(true);
      const handleCanPlay = () => {
        if (autoplay) {
          video.play().catch((err: Error) => {
            // NotAllowedError is expected when browser blocks autoplay - not a real error
            if (err.name !== 'NotAllowedError') {
              console.warn('Native HLS video playback failed:', err.message);
            }
          });
        }
      };
      video.addEventListener('error', handleError);
      video.addEventListener('canplay', handleCanPlay);
      return () => {
        video.removeEventListener('error', handleError);
        video.removeEventListener('canplay', handleCanPlay);
      };
    }
    // If neither is supported, we handled that in render via hlsSupported check
  }, [playlist, isDirectVideo, autoplay]);

  // Toggle mute using ref to always get current state (avoids stale closure)
  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !isMutedRef.current;
    video.muted = newMuted;
    setIsMuted(newMuted);

    // Dispatch background music events when muting/unmuting a playing video
    if (!video.paused) {
      if (newMuted) {
        document.dispatchEvent(new Event('backgroundMusicResume'));
      } else {
        document.dispatchEvent(new Event('backgroundMusicPause'));
      }
    }
  }, []);

  // Listen for global toggleVideoSound event (triggered by ';' key in useKeybindings)
  useEffect(() => {
    const handler = () => handleToggleMute();
    document.addEventListener('toggleVideoSound', handler);
    return () => {
      document.removeEventListener('toggleVideoSound', handler);
    };
  }, [handleToggleMute]);

  const handleVideoEnded = () => {
    setIsPlaying(false);
    document.dispatchEvent(new Event('backgroundMusicResume'));
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    document.dispatchEvent(new Event('backgroundMusicResume'));
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    // Only pause background music if video is unmuted
    if (!isMutedRef.current) {
      document.dispatchEvent(new Event('backgroundMusicPause'));
    }
  };

  // HLS not supported at all
  if (!hlsSupported) {
    return (
      <div className="w-full min-h-[100px] rounded-md bg-black/50 flex items-center justify-center">
        <div className="text-center text-white/50">
          <span className="text-2xl block mb-1">!</span>
          <span className="text-xs">Video not supported</span>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="w-full min-h-[100px] rounded-md bg-black/50 flex items-center justify-center">
        <div className="text-center text-white/50">
          <span className="text-2xl block mb-1">!</span>
          <span className="text-xs">Video unavailable</span>
        </div>
      </div>
    );
  }

  // Video player - uses natural video sizing with max-height constraint
  // No overflow hidden, no scrollbars - video shrinks proportionally to fit
  return (
    <div className={`relative w-full rounded-md bg-black`}>
      <video
        ref={videoRef}
        className={`w-full ${maxHeight} object-contain cursor-pointer rounded-md`}
        poster={thumbnail}
        playsInline
        autoPlay
        muted={isMuted}
        loop
        onEnded={handleVideoEnded}
        onPause={handleVideoPause}
        onPlay={handleVideoPlay}
        onClick={handleToggleMute}
        aria-label="Video player - click to toggle sound"
      />

      {/* Mute/Unmute indicator - shown as a button in the corner */}
      <button
        type="button"
        onClick={handleToggleMute}
        className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--memphis-cyan)]"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? (
          // Muted speaker icon (with X)
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        ) : (
          // Unmuted speaker icon (with sound waves)
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        )}
      </button>

      {/* Click hint - show briefly when muted */}
      {isMuted && isPlaying && (
        <div className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/50 px-2 py-1 rounded pointer-events-none">
          Click or ; for sound
        </div>
      )}
    </div>
  );
}
