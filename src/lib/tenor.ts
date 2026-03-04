/**
 * Tenor GIF URL parsing and transformation utilities
 *
 * Copied from Bluesky's implementation:
 * https://github.com/bluesky-social/social-app/blob/main/src/lib/strings/embed-player.ts
 *
 * Tenor GIFs are served as videos for efficiency. This module handles:
 * 1. Detecting Tenor URLs (from external embeds)
 * 2. Transforming URLs to get the video/animated version
 *
 * URL transformation:
 * - Tenor media URLs contain ID patterns with "AAAAC" (static/preview)
 * - Transform to: AAAP1 (mp4 for Safari), AAAP3 (webm for others), AAAAM (gif for native)
 * - Proxy through Bluesky's CDN: t.gifs.bsky.app
 */

export interface TenorVideoInfo {
  /** The video URL (webm or mp4) */
  videoUrl: string;
  /** The thumbnail URL for the video poster */
  thumbnail?: string;
  /** Aspect ratio if available */
  aspectRatio?: { width: number; height: number };
}

/**
 * Check if a URL is a Tenor URL
 */
export function isTenorUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'tenor.com' ||
      parsed.hostname === 'www.tenor.com' ||
      parsed.hostname === 'media.tenor.com' ||
      parsed.hostname.endsWith('.tenor.com')
    );
  } catch {
    return false;
  }
}

/**
 * Detect if browser is Safari
 */
function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
}

/**
 * Parse a Tenor media URL and return video info
 * Based on Bluesky's parseTenorGif function
 *
 * Tenor URLs follow this pattern:
 * https://media.tenor.com/{id}/{filename}?hh={height}&ww={width}
 *
 * The ID contains format codes:
 * - AAAAC = static/preview
 * - AAAP1 = mp4 video
 * - AAAP3 = webm video
 * - AAAAM = animated gif
 */
function parseTenorGif(urlString: string): TenorVideoInfo | null {
  try {
    const urlp = new URL(urlString);

    if (urlp.hostname !== 'media.tenor.com') {
      return null;
    }

    const pathParts = urlp.pathname.split('/').filter(Boolean);
    let id = pathParts[0];
    let filename = pathParts[1];

    if (!id || !filename) {
      return null;
    }

    if (!id.includes('AAAAC')) {
      // Try to use as-is if it's already a video format
      if (filename.endsWith('.mp4') || filename.endsWith('.webm')) {
        return {
          videoUrl: urlString,
          thumbnail: urlString.replace(/\.(mp4|webm)$/, '.gif'),
        };
      }
      return null;
    }

    // Get dimensions from query params (Bluesky requires these)
    const h = urlp.searchParams.get('hh');
    const w = urlp.searchParams.get('ww');

    let aspectRatio: { width: number; height: number } | undefined;
    if (h && w) {
      aspectRatio = {
        height: Number(h),
        width: Number(w),
      };
    }

    // Transform based on platform (we're always web)
    if (isSafari()) {
      id = id.replace('AAAAC', 'AAAP1');
      filename = filename.replace('.gif', '.mp4');
    } else {
      id = id.replace('AAAAC', 'AAAP3');
      filename = filename.replace('.gif', '.webm');
    }

    // Use Bluesky's CDN proxy
    const videoUrl = `https://t.gifs.bsky.app/${id}/${filename}`;

    return {
      videoUrl,
      thumbnail: urlString, // Use original as thumbnail
      aspectRatio,
    };
  } catch {
    return null;
  }
}

/**
 * Try to extract video info from a Tenor external embed
 *
 * External embeds have:
 * - uri: The Tenor page URL (https://tenor.com/view/...)
 * - thumb: A CDN thumbnail URL (https://media.tenor.com/...)
 *
 * We try to transform the thumb URL to get the video version.
 */
export function getTenorVideoFromEmbed(
  uri: string,
  thumb?: string
): TenorVideoInfo | null {
  // First, try to parse the URI itself - for external embeds, the uri often IS the media.tenor.com URL
  if (uri) {
    const fromUri = parseTenorGif(uri);
    if (fromUri) {
      // Use the Bluesky-cached thumb as thumbnail if available
      if (thumb) {
        fromUri.thumbnail = thumb;
      }
      return fromUri;
    }
  }

  // Fallback: try to transform the thumb URL if it's a media.tenor.com URL
  if (thumb) {
    const fromThumb = parseTenorGif(thumb);
    if (fromThumb) {
      return fromThumb;
    }
  }

  // If neither worked, we can't get the video URL
  return null;
}
