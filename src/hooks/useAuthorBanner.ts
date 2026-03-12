// useAuthorBanner hook - Fetches and caches author banner/cover images
// The feed API only returns basic author info (no banner).
// This hook calls getProfile() for the current post's author and caches results by DID.
// Works both authenticated (via agent) and unauthenticated (via public API).
//
// The cache is module-level so it's shared across all hook instances and can be
// pre-warmed by prefetchBanners() while the human is reading the current post.

import { useState, useEffect } from 'react';
import type { Agent } from '@atproto/api';

const PUBLIC_API = 'https://public.api.bsky.app';

// Module-level cache shared across all hook instances + prefetch calls
const bannerCache = new Map<string, string | null>();
// Track in-flight fetches to avoid duplicate requests
const inFlightFetches = new Set<string>();

interface UseAuthorBannerParams {
  agent: Agent | null;
  authorDid: string | undefined;
}

/**
 * Fetch a single author's banner and cache it.
 * Used by both the hook and the prefetch function.
 */
async function fetchAndCacheBanner(agent: Agent | null, authorDid: string): Promise<string | null> {
  if (bannerCache.has(authorDid) || inFlightFetches.has(authorDid)) {
    return bannerCache.get(authorDid) ?? null;
  }

  inFlightFetches.add(authorDid);
  try {
    let banner: string | null = null;

    if (agent) {
      const res = await agent.getProfile({ actor: authorDid });
      banner = res.data.banner ?? null;
    } else {
      const res = await fetch(
        `${PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(authorDid)}`
      );
      if (res.ok) {
        const data = await res.json();
        banner = data.banner ?? null;
      }
    }

    bannerCache.set(authorDid, banner);

    // Pre-warm the browser image cache so the banner renders instantly
    if (banner) {
      const img = new Image();
      img.src = banner;
    }

    return banner;
  } catch {
    bannerCache.set(authorDid, null);
    return null;
  } finally {
    inFlightFetches.delete(authorDid);
  }
}

/**
 * Prefetch banners for upcoming posts while the human is reading.
 * Call this when currentItemIndex changes — it pre-warms both the
 * profile cache (DID → banner URL) and the browser image cache.
 */
export function prefetchBanners(
  agent: Agent | null,
  authorDids: (string | undefined)[]
): void {
  for (const did of authorDids) {
    if (did && !bannerCache.has(did) && !inFlightFetches.has(did)) {
      fetchAndCacheBanner(agent, did);
    }
  }
}

export function useAuthorBanner({ agent, authorDid }: UseAuthorBannerParams): string | null {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authorDid) {
      setBannerUrl(null);
      return;
    }

    // Check cache first — may have been pre-warmed by prefetchBanners
    if (bannerCache.has(authorDid)) {
      setBannerUrl(bannerCache.get(authorDid) ?? null);
      return;
    }

    let cancelled = false;

    fetchAndCacheBanner(agent, authorDid).then((banner) => {
      if (!cancelled) {
        setBannerUrl(banner);
      }
    });

    return () => { cancelled = true; };
  }, [agent, authorDid]);

  return bannerUrl;
}
