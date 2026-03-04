/**
 * MediaEmbed - Media display component for posts
 *
 * Handles rendering of images or video content embedded in posts.
 * Uses MediaGrid for image layouts and VideoPlayer for video.
 */

import type { PostImage, PostVideo } from '../types';
import { MediaGrid } from './MediaGrid';
import { VideoPlayer } from './VideoPlayer';

interface MediaEmbedProps {
  images?: PostImage[];
  video?: PostVideo;
  maxHeight?: string;
  compact?: boolean;
  onImageClick?: (index: number) => void;
}

export function MediaEmbed({
  images,
  video,
  maxHeight = 'max-h-[35vh]',
  compact = false,
  onImageClick,
}: MediaEmbedProps) {
  // Determine final maxHeight: respect explicit maxHeight, only use compact default if no maxHeight override
  // This allows callers to pass maxHeight AND compact without the compact overriding their explicit value
  const effectiveMaxHeight = maxHeight !== 'max-h-[35vh]'
    ? maxHeight
    : (compact ? 'max-h-[40vh]' : maxHeight);

  // Video takes priority
  if (video) {
    return (
      <div className="mt-2">
        <VideoPlayer
          playlist={video.playlist}
          thumbnail={video.thumbnail}
          aspectRatio={video.aspectRatio}
          maxHeight={effectiveMaxHeight}
        />
      </div>
    );
  }

  // Images
  if (images && images.length > 0) {
    return (
      <div className="mt-2">
        <MediaGrid
          images={images}
          maxHeight={effectiveMaxHeight}
          onImageClick={onImageClick}
        />
      </div>
    );
  }

  return null;
}
