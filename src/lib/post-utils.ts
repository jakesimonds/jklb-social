/**
 * Post utility functions extracted from PostCard
 *
 * These are pure utility functions for working with post data:
 * - URL building and parsing
 * - Time formatting
 * - Tenor GIF detection
 */

import type { PostExternal } from '../types';
import { isTenorUrl, getTenorVideoFromEmbed } from './tenor';

/**
 * Extract the rkey (post ID) from an AT URI
 * Format: at://did:plc:xxx/app.bsky.feed.post/rkey
 */
export function extractRkey(uri: string): string | null {
  const parts = uri.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/**
 * Build the bsky.app URL for a post
 */
export function buildBskyPostUrl(handle: string, uri: string): string | null {
  const rkey = extractRkey(uri);
  if (!rkey) return null;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

/**
 * Extract the domain from a URL for display
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Format a timestamp as relative time (e.g., "2h ago", "3d ago")
 */
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

/**
 * Check if an external embed is a Tenor GIF (handled as video)
 */
export function isTenorEmbed(external: PostExternal): boolean {
  return isTenorUrl(external.uri) || (external.thumb ? isTenorUrl(external.thumb) : false);
}

/**
 * Get video info from a Tenor external embed
 */
export function getTenorVideo(external: PostExternal): { playlist: string; thumbnail?: string; aspectRatio?: { width: number; height: number } } | null {
  const tenorInfo = getTenorVideoFromEmbed(external.uri, external.thumb);
  if (!tenorInfo) return null;
  return {
    playlist: tenorInfo.videoUrl,
    thumbnail: tenorInfo.thumbnail,
    aspectRatio: tenorInfo.aspectRatio,
  };
}

/**
 * Info about a link in a post, with enough info to highlight and open it
 */
export interface LinkInfo {
  url: string;
  /** Where this link appears */
  location: 'main-external' | 'main-text' | 'quote-external' | 'quote-text';
  /** For text links: byte positions for highlighting (UTF-8 offsets from AT Proto) */
  byteStart?: number;
  byteEnd?: number;
}

/**
 * Collect ALL links from a post in priority order.
 * Used for O key (open first) and Shift+O (cycle through).
 *
 * Order:
 * 1. Main post external link (LinkPreview)
 * 2. Main post text links (from facets, in order)
 * 3. Quoted post external link
 * 4. Quoted post text links (from facets, in order)
 */
export function getAllLinks(post: {
  embed?: {
    external?: { uri: string };
    record?: {
      external?: { uri: string };
      linkFacets?: Array<{ url: string; byteStart: number; byteEnd: number }>;
      text?: string;
    };
  };
  linkFacets?: Array<{ url: string; byteStart: number; byteEnd: number }>;
  text?: string;
}): LinkInfo[] {
  const links: LinkInfo[] = [];

  // 1. Main post external link (LinkPreview)
  if (post.embed?.external?.uri) {
    links.push({
      url: post.embed.external.uri,
      location: 'main-external',
    });
  }

  // 2. Main post text links (from facets)
  if (post.linkFacets?.length) {
    for (const facet of post.linkFacets) {
      links.push({
        url: facet.url,
        location: 'main-text',
        byteStart: facet.byteStart,
        byteEnd: facet.byteEnd,
      });
    }
  }

  // 3. Quoted post external link
  if (post.embed?.record?.external?.uri) {
    links.push({
      url: post.embed.record.external.uri,
      location: 'quote-external',
    });
  }

  // 4. Quoted post text links (from facets)
  if (post.embed?.record?.linkFacets?.length) {
    for (const facet of post.embed.record.linkFacets) {
      links.push({
        url: facet.url,
        location: 'quote-text',
        byteStart: facet.byteStart,
        byteEnd: facet.byteEnd,
      });
    }
  }

  return links;
}

/** @deprecated Use getAllLinks instead */
export interface ActiveLinkInfo {
  url: string;
  source: 'external' | 'text' | 'quote-external' | 'quote-text';
}

/** @deprecated Use getAllLinks instead - kept for backward compatibility */
export function getActiveLink(post: {
  embed?: {
    external?: { uri: string };
    record?: {
      external?: { uri: string };
      linkFacets?: Array<{ url: string }>;
      text?: string;
    };
  };
  linkFacets?: Array<{ url: string }>;
  text?: string;
}): ActiveLinkInfo | null {
  const links = getAllLinks(post as Parameters<typeof getAllLinks>[0]);
  if (links.length === 0) return null;

  const first = links[0];
  // Map new location to old source format
  const sourceMap: Record<LinkInfo['location'], ActiveLinkInfo['source']> = {
    'main-external': 'external',
    'main-text': 'text',
    'quote-external': 'quote-external',
    'quote-text': 'quote-text',
  };
  return { url: first.url, source: sourceMap[first.location] };
}
