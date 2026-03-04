/**
 * Post utility functions adapted from src/lib/post-utils.ts for React Native
 * Pure utility functions — no DOM dependencies.
 */

import type { PostExternal } from './types';
import { isTenorUrl, getTenorVideoFromEmbed } from './tenor';

export function extractRkey(uri: string): string | null {
  const parts = uri.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function isTenorEmbed(external: PostExternal): boolean {
  return isTenorUrl(external.uri) || (external.thumb ? isTenorUrl(external.thumb) : false);
}

export function getTenorVideo(external: PostExternal): { playlist: string; thumbnail?: string; aspectRatio?: { width: number; height: number } } | null {
  const tenorInfo = getTenorVideoFromEmbed(external.uri, external.thumb);
  if (!tenorInfo) return null;
  return {
    playlist: tenorInfo.videoUrl,
    thumbnail: tenorInfo.thumbnail,
    aspectRatio: tenorInfo.aspectRatio,
  };
}
