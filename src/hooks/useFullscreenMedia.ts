// useFullscreenMedia hook - React hook for fullscreen media state management
// Encapsulates fullscreen media state, toggle, and exit logic
// Supports drill-down to quoted post media when main post has no media

import { useState, useCallback, useMemo } from 'react';
import type { Post, PostImage, PostVideo } from '../types';

/**
 * Media content for fullscreen display
 */
export interface FullscreenMediaContent {
  images?: PostImage[];
  video?: PostVideo;
}

/**
 * Parameters for the useFullscreenMedia hook
 */
export interface UseFullscreenMediaParams {
  // Current post to extract media from
  currentPost: Post | null;
}

/**
 * Return type for the useFullscreenMedia hook
 */
export interface UseFullscreenMediaReturn {
  // Fullscreen state
  isMediaFullscreen: boolean;
  fullscreenStartTime: number;
  currentImageIndex: number;

  // Derived: does current post (or its quoted post) have media?
  currentPostHasMedia: boolean;

  // Actions
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
  getFullscreenMedia: () => FullscreenMediaContent;
  goToNextImage: () => void;
  goToPrevImage: () => void;
}

/**
 * Check if a post embed contains direct media (images or video)
 * Does NOT check quoted posts - only direct media on the post itself
 */
function hasDirectMedia(post: Post | null): boolean {
  if (!post?.embed) return false;
  const embedType = post.embed.type;
  return (
    (embedType === 'images' && !!post.embed.images?.length) ||
    (embedType === 'video' && !!post.embed.video) ||
    (embedType === 'recordWithMedia' && (!!post.embed.images?.length || !!post.embed.video))
  );
}

/**
 * Check if a quoted post has media (images or video)
 */
function quotedPostHasMedia(post: Post | null): boolean {
  const quotedPost = post?.embed?.record;
  if (!quotedPost) return false;
  return !!(quotedPost.images?.length || quotedPost.video);
}

/**
 * Custom hook for managing fullscreen media state
 *
 * This hook encapsulates:
 * - Fullscreen state (isMediaFullscreen, fullscreenStartTime)
 * - Computed currentPostHasMedia (checks main post, falls back to quoted post)
 * - toggleFullscreen (captures video time when entering)
 * - exitFullscreen
 * - getFullscreenMedia (extracts media from currentPost or its quoted post)
 *
 * Enter key behavior:
 * - If main post has media → show main post media
 * - If main post has no media but quoted post does → show quoted post media
 * - This mirrors the drill-down logic used for links in quoted posts
 *
 * @param params - Dependencies (currentPost)
 * @returns Fullscreen state and control functions
 */
export function useFullscreenMedia({
  currentPost,
}: UseFullscreenMediaParams): UseFullscreenMediaReturn {
  // Fullscreen state
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);
  const [fullscreenStartTime, setFullscreenStartTime] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  /**
   * Check if the current post (or its quoted post) has media content
   * Used to determine if Enter should toggle fullscreen
   *
   * Priority: main post media > quoted post media
   */
  const currentPostHasMedia = useMemo(() => {
    return hasDirectMedia(currentPost) || quotedPostHasMedia(currentPost);
  }, [currentPost]);

  /**
   * Get media content for fullscreen display
   * Combines main post images + quoted post images for unified navigation
   * Video: main post video only (quoted video not included in cycling)
   */
  const getFullscreenMedia = useCallback((): FullscreenMediaContent => {
    let allImages: PostImage[] = [];
    let video: PostVideo | undefined = undefined;

    // Collect main post media
    if (currentPost?.embed) {
      if (currentPost.embed.type === 'images' && currentPost.embed.images?.length) {
        allImages = [...currentPost.embed.images];
      }
      if (currentPost.embed.type === 'video' && currentPost.embed.video) {
        video = currentPost.embed.video;
      }
      if (currentPost.embed.type === 'recordWithMedia') {
        if (currentPost.embed.images?.length) {
          allImages = [...currentPost.embed.images];
        }
        if (currentPost.embed.video) {
          video = currentPost.embed.video;
        }
      }
    }

    // Append quoted post images (not video)
    const quotedPost = currentPost?.embed?.record;
    if (quotedPost?.images?.length) {
      allImages = [...allImages, ...quotedPost.images];
    }

    return {
      images: allImages.length > 0 ? allImages : undefined,
      video,
    };
  }, [currentPost]);

  /**
   * Get the total number of images available for fullscreen
   * Counts main post images + quoted post images combined
   */
  const imageCount = useMemo(() => {
    let count = 0;

    // Count main post images
    if (currentPost?.embed) {
      const embedType = currentPost.embed.type;
      if (embedType === 'images' && currentPost.embed.images?.length) {
        count += currentPost.embed.images.length;
      }
      if (embedType === 'recordWithMedia' && currentPost.embed.images?.length) {
        count += currentPost.embed.images.length;
      }
    }

    // Add quoted post images
    const quotedPost = currentPost?.embed?.record;
    if (quotedPost?.images?.length) {
      count += quotedPost.images.length;
    }

    return count;
  }, [currentPost]);

  /**
   * Toggle fullscreen media view
   * Captures current video time when entering fullscreen to maintain sync
   */
  const toggleFullscreen = useCallback(() => {
    if (currentPostHasMedia) {
      // When entering fullscreen, capture the current video time
      if (!isMediaFullscreen) {
        // Try to find video in the PostCard
        const postCard = document.querySelector('.postcard-container');
        const video = postCard?.querySelector('video');
        if (video) {
          setFullscreenStartTime(video.currentTime);
        }
        // Reset image index when entering fullscreen
        setCurrentImageIndex(0);
      }
      setIsMediaFullscreen(prev => !prev);
    }
  }, [currentPostHasMedia, isMediaFullscreen]);

  /**
   * Exit fullscreen (without navigation)
   */
  const exitFullscreen = useCallback(() => {
    setIsMediaFullscreen(false);
    setCurrentImageIndex(0);
  }, []);

  /**
   * Go to the next image in a multi-image post
   * Stops at the last image (no wrap)
   */
  const goToNextImage = useCallback(() => {
    if (imageCount > 1) {
      setCurrentImageIndex(prev => Math.min(prev + 1, imageCount - 1));
    }
  }, [imageCount]);

  /**
   * Go to the previous image in a multi-image post
   * Stops at the first image (no wrap)
   */
  const goToPrevImage = useCallback(() => {
    if (imageCount > 1) {
      setCurrentImageIndex(prev => Math.max(prev - 1, 0));
    }
  }, [imageCount]);

  return {
    // Fullscreen state
    isMediaFullscreen,
    fullscreenStartTime,
    currentImageIndex,

    // Derived
    currentPostHasMedia,

    // Actions
    toggleFullscreen,
    exitFullscreen,
    getFullscreenMedia,
    goToNextImage,
    goToPrevImage,
  };
}
