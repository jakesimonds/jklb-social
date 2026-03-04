/**
 * Tenor GIF URL parsing and transformation utilities
 * Adapted from src/lib/tenor.ts for React Native
 *
 * Tenor GIFs are served as videos for efficiency. This module handles:
 * 1. Detecting Tenor URLs (from external embeds)
 * 2. Transforming URLs to get the video/animated version
 *
 * React Native always uses mp4 (AAAP1) since expo-av handles it natively.
 */

export interface TenorVideoInfo {
  videoUrl: string;
  thumbnail?: string;
  aspectRatio?: { width: number; height: number };
}

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
      if (filename.endsWith('.mp4') || filename.endsWith('.webm')) {
        return {
          videoUrl: urlString,
          thumbnail: urlString.replace(/\.(mp4|webm)$/, '.gif'),
        };
      }
      return null;
    }

    const h = urlp.searchParams.get('hh');
    const w = urlp.searchParams.get('ww');

    let aspectRatio: { width: number; height: number } | undefined;
    if (h && w) {
      aspectRatio = { height: Number(h), width: Number(w) };
    }

    // Always use mp4 for React Native (expo-av handles it natively)
    id = id.replace('AAAAC', 'AAAP1');
    filename = filename.replace('.gif', '.mp4');

    const videoUrl = `https://t.gifs.bsky.app/${id}/${filename}`;

    return {
      videoUrl,
      thumbnail: urlString,
      aspectRatio,
    };
  } catch {
    return null;
  }
}

export function getTenorVideoFromEmbed(
  uri: string,
  thumb?: string
): TenorVideoInfo | null {
  if (uri) {
    const fromUri = parseTenorGif(uri);
    if (fromUri) {
      if (thumb) {
        fromUri.thumbnail = thumb;
      }
      return fromUri;
    }
  }

  if (thumb) {
    const fromThumb = parseTenorGif(thumb);
    if (fromThumb) {
      return fromThumb;
    }
  }

  return null;
}
