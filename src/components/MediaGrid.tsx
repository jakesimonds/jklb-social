/**
 * MediaGrid - Displays images in a responsive grid layout
 *
 * Layout logic:
 * - 1 image: Full width with 4:3 aspect ratio, center-cropped (object-fit: cover)
 * - 2 images: Side by side (2 columns), center-cropped
 * - 3 images: 2x2 grid with 3rd image spanning bottom, center-cropped
 * - 4 images: 2x2 grid, all center-cropped
 *
 * Features:
 * - Center-cropping (object-fit: cover) for consistent, attractive display
 * - Lazy loading for performance
 * - Alt text support for accessibility
 * - Click handler for lightbox/fullscreen functionality
 * - Highlight indicator for arrow key navigation
 */

import type { PostImage } from '../types';

interface MediaGridProps {
  images: PostImage[];
  onImageClick?: (index: number) => void;
  maxHeight?: string;
  /** Index of the highlighted image (for arrow navigation) */
  highlightedIndex?: number;
}

export function MediaGrid({
  images,
  onImageClick,
  maxHeight = 'max-h-[35vh]',
  highlightedIndex,
}: MediaGridProps) {
  if (!images || images.length === 0) {
    return null;
  }

  const handleClick = (index: number) => {
    if (onImageClick) {
      onImageClick(index);
    }
  };

  // Helper to get highlight classes for an image
  const getHighlightClasses = (index: number) => {
    if (highlightedIndex === index) {
      return 'ring-2 ring-[var(--memphis-cyan)] ring-offset-1 ring-offset-[var(--memphis-bg)]';
    }
    return '';
  };

  // Single image - show full image with max-height constraint
  // Uses object-contain to show entire image without cropping
  // Press Enter to view fullscreen
  if (images.length === 1) {
    const img = images[0];
    return (
      <button
        type="button"
        onClick={() => handleClick(0)}
        className={`relative w-full rounded-md bg-black/20 focus:outline-none transition-all duration-150 overflow-hidden ${getHighlightClasses(0)}`}
      >
        <img
          src={img.thumb}
          alt={img.alt || 'Post image'}
          loading="lazy"
          className={`w-full ${maxHeight} object-contain rounded-md`}
        />
        {highlightedIndex === 0 && (
          <div className="absolute bottom-1 right-1 text-[var(--memphis-cyan)] text-xs bg-black/50 px-1 rounded">◆</div>
        )}
      </button>
    );
  }

  // Multi-image: use fixed smaller height to prevent overflow
  const multiImageHeight = 'h-[25vh]';

  // 2 images - side by side, strictly constrained
  if (images.length === 2) {
    return (
      <div className={`${multiImageHeight} grid grid-cols-2 gap-1 rounded-md overflow-hidden`}>
        {images.map((img, index) => (
          <button
            key={img.thumb}
            type="button"
            onClick={() => handleClick(index)}
            className={`relative w-full h-full overflow-hidden focus:outline-none rounded-sm transition-all duration-150 ${getHighlightClasses(index)}`}
          >
            <img
              src={img.thumb}
              alt={img.alt || `Image ${index + 1}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {highlightedIndex === index && (
              <div className="absolute bottom-1 right-1 text-[var(--memphis-cyan)] text-xs bg-black/50 px-1 rounded">◆</div>
            )}
          </button>
        ))}
      </div>
    );
  }

  // 3 images - 2 on top, 1 spanning bottom, strictly constrained
  if (images.length === 3) {
    return (
      <div
        className={`${multiImageHeight} grid grid-cols-2 gap-1 rounded-md overflow-hidden`}
        style={{ gridTemplateRows: '1fr 1fr' }}
      >
        {/* Top row */}
        <button
          type="button"
          onClick={() => handleClick(0)}
          className={`relative w-full h-full overflow-hidden focus:outline-none rounded-sm transition-all duration-150 ${getHighlightClasses(0)}`}
        >
          <img
            src={images[0].thumb}
            alt={images[0].alt || 'Image 1'}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          {highlightedIndex === 0 && (
            <div className="absolute bottom-1 right-1 text-[var(--memphis-cyan)] text-xs bg-black/50 px-1 rounded">◆</div>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleClick(1)}
          className={`relative w-full h-full overflow-hidden focus:outline-none rounded-sm transition-all duration-150 ${getHighlightClasses(1)}`}
        >
          <img
            src={images[1].thumb}
            alt={images[1].alt || 'Image 2'}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          {highlightedIndex === 1 && (
            <div className="absolute bottom-1 right-1 text-[var(--memphis-cyan)] text-xs bg-black/50 px-1 rounded">◆</div>
          )}
        </button>
        {/* Bottom row - 3rd image spans or sits left */}
        <button
          type="button"
          onClick={() => handleClick(2)}
          className={`relative col-span-2 w-full h-full overflow-hidden focus:outline-none rounded-sm transition-all duration-150 ${getHighlightClasses(2)}`}
        >
          <img
            src={images[2].thumb}
            alt={images[2].alt || 'Image 3'}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          {highlightedIndex === 2 && (
            <div className="absolute bottom-1 right-1 text-[var(--memphis-cyan)] text-xs bg-black/50 px-1 rounded">◆</div>
          )}
        </button>
      </div>
    );
  }

  // 4 images - 2x2 grid, strictly constrained
  return (
    <div
      className={`${multiImageHeight} grid grid-cols-2 gap-1 rounded-md overflow-hidden`}
      style={{ gridTemplateRows: '1fr 1fr' }}
    >
      {images.slice(0, 4).map((img, index) => (
        <button
          key={img.thumb}
          type="button"
          onClick={() => handleClick(index)}
          className={`relative w-full h-full overflow-hidden focus:outline-none rounded-sm transition-all duration-150 ${getHighlightClasses(index)}`}
        >
          <img
            src={img.thumb}
            alt={img.alt || `Image ${index + 1}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          {highlightedIndex === index && (
            <div className="absolute bottom-1 right-1 text-[var(--memphis-cyan)] text-xs bg-black/50 px-1 rounded">◆</div>
          )}
        </button>
      ))}
    </div>
  );
}
