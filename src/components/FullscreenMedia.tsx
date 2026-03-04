/**
 * FullscreenMedia - Fullscreen overlay for viewing media content
 *
 * Displays images or video in TRUE fullscreen - media fills the entire viewport.
 *
 * Controls:
 * - Escape: Exit fullscreen without navigation
 * - j/k: Exit fullscreen and navigate to next/previous post
 * - Click anywhere: Exit fullscreen
 */

import { useEffect, useRef, useState } from 'react';
import type { PostImage, PostVideo } from '../types';
import Hls from 'hls.js';

interface FullscreenMediaProps {
  /** Images to display */
  images?: PostImage[];
  /** Video to display */
  video?: PostVideo;
  /** Start time for video (to sync with slot video) */
  startTime?: number;
  /** Current image index for multi-image posts */
  currentImageIndex?: number;
  /** Callback to go to next image */
  onNextImage?: () => void;
  /** Callback to go to previous image */
  onPrevImage?: () => void;
  /** Callback to close fullscreen */
  onClose: () => void;
}

// Check if URL is a direct video file (not HLS)
function isDirectVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
}

export function FullscreenMedia({
  images,
  video,
  startTime = 0,
  currentImageIndex = 0,
  onNextImage,
  onPrevImage,
  onClose,
}: FullscreenMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  // Track if we have multiple images
  const imageCount = images?.length || 0;
  const hasMultipleImages = imageCount > 1;

  // Handle keyboard events for image navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasMultipleImages) {
        if (e.key === 'ArrowRight' && onNextImage) {
          e.preventDefault();
          onNextImage();
        } else if (e.key === 'ArrowLeft' && onPrevImage) {
          e.preventDefault();
          onPrevImage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMultipleImages, onNextImage, onPrevImage]);

  // Set up HLS or direct video playback
  useEffect(() => {
    if (!video || !videoRef.current) return;

    const videoEl = videoRef.current;
    const isDirectVideo = isDirectVideoUrl(video.playlist);

    const seekAndPlay = () => {
      // Seek to the start time to sync with slot video
      if (startTime > 0) {
        videoEl.currentTime = startTime;
      }
      videoEl.play().catch((err: Error) => {
        // NotAllowedError is expected when browser blocks autoplay - not a real error
        if (err.name !== 'NotAllowedError') {
          console.warn('Fullscreen video playback failed:', err.message);
        }
      });
    };

    if (isDirectVideo) {
      // Direct video file
      videoEl.src = video.playlist;
      videoEl.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    } else if (Hls.isSupported()) {
      // HLS with hls.js
      const hls = new Hls();
      hls.loadSource(video.playlist);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, seekAndPlay);
      hlsRef.current = hls;
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      videoEl.src = video.playlist;
      videoEl.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video, startTime]);

  // Don't render if no media
  if (!images?.length && !video) {
    return null;
  }

  const handleVideoPlay = () => {
    // Only pause background music if video is unmuted
    if (videoRef.current && !videoRef.current.muted) {
      document.dispatchEvent(new Event('backgroundMusicPause'));
    }
  };

  const handleVideoPause = () => {
    document.dispatchEvent(new Event('backgroundMusicResume'));
  };

  const handleVideoEnded = () => {
    document.dispatchEvent(new Event('backgroundMusicResume'));
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);

      // Dispatch background music events when muting/unmuting a playing video
      if (!videoRef.current.paused) {
        if (newMuted) {
          document.dispatchEvent(new Event('backgroundMusicResume'));
        } else {
          document.dispatchEvent(new Event('backgroundMusicPause'));
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black cursor-pointer"
      onClick={onClose}
    >
      {/* Video - FILLS ENTIRE SCREEN */}
      {video && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          poster={video.thumbnail}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onEnded={handleVideoEnded}
        />
      )}

      {/* Images - FILLS ENTIRE SCREEN */}
      {!video && images && images.length > 0 && (
        <>
          <img
            src={images[currentImageIndex]?.fullsize || images[0].fullsize}
            alt={images[currentImageIndex]?.alt || 'Fullscreen image'}
            className="absolute inset-0 w-full h-full object-contain"
          />
          {/* Image counter for multi-image posts */}
          {hasMultipleImages && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white bg-black/60 px-4 py-2 rounded-lg z-10 font-mono">
              {currentImageIndex + 1} / {imageCount}
            </div>
          )}
          {/* Navigation arrows for multi-image posts */}
          {hasMultipleImages && (
            <>
              {/* Left arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrevImage?.();
                }}
                disabled={currentImageIndex === 0}
                className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 flex items-center justify-center transition-colors z-10 ${
                  currentImageIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80'
                }`}
                aria-label="Previous image"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {/* Right arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNextImage?.();
                }}
                disabled={currentImageIndex === imageCount - 1}
                className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 flex items-center justify-center transition-colors z-10 ${
                  currentImageIndex === imageCount - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80'
                }`}
                aria-label="Next image"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </>
      )}

      {/* Sound toggle for video */}
      {video && (
        <button
          onClick={toggleMute}
          className="absolute bottom-16 right-4 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors z-10"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      )}

      {/* Keyboard hints */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-lg z-10">
        <span className="text-[var(--memphis-cyan)]">Esc</span> close
        <span className="mx-3">•</span>
        <span className="text-[var(--memphis-cyan)]">j/k</span> navigate posts
        {hasMultipleImages && (
          <>
            <span className="mx-3">•</span>
            <span className="text-[var(--memphis-cyan)]">←/→</span> navigate images
          </>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 z-10"
        aria-label="Close fullscreen"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
