// useAuthorBanner hook - Fetches and caches author banner/cover images
// The feed API only returns basic author info (no banner).
// This hook calls getProfile() for the current post's author and caches results by DID.
// Works both authenticated (via agent) and unauthenticated (via public API).

import { useState, useEffect, useRef } from 'react';
import type { Agent } from '@atproto/api';

const PUBLIC_API = 'https://public.api.bsky.app';

interface UseAuthorBannerParams {
  agent: Agent | null;
  authorDid: string | undefined;
}

export function useAuthorBanner({ agent, authorDid }: UseAuthorBannerParams): string | null {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!authorDid) {
      setBannerUrl(null);
      return;
    }

    // Check cache first
    if (cacheRef.current.has(authorDid)) {
      setBannerUrl(cacheRef.current.get(authorDid) ?? null);
      return;
    }

    let cancelled = false;

    const fetchBanner = async () => {
      try {
        let banner: string | null = null;

        if (agent) {
          // Authenticated — use agent
          const res = await agent.getProfile({ actor: authorDid });
          banner = res.data.banner ?? null;
        } else {
          // Unauthenticated — use public API
          const res = await fetch(
            `${PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(authorDid)}`
          );
          if (res.ok) {
            const data = await res.json();
            banner = data.banner ?? null;
          }
        }

        if (cancelled) return;
        cacheRef.current.set(authorDid, banner);
        setBannerUrl(banner);
      } catch {
        if (cancelled) return;
        cacheRef.current.set(authorDid, null);
        setBannerUrl(null);
      }
    };

    fetchBanner();

    return () => { cancelled = true; };
  }, [agent, authorDid]);

  return bannerUrl;
}
