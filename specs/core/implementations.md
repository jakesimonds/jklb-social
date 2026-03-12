# JKLB Implementations

## Current Implementations

### Bluesky (AT Protocol) — Tier 3

The original. Full three-act experience with Chorus, notifications, End screen, and all write actions.

- **Repo:** `russAbbot` (this repository)
- **Live:** [jklb.social](https://jklb.social)
- **Network:** Any AT Protocol PDS (not just bsky.social)
- **Auth:** OAuth 2.0 with DPoP
- **Status:** Production

### Farcaster — Tier 1 (in progress)

Read-only port targeting the Farcaster network via Neynar/Hub APIs.

- **Repo:** `farcaster-jklb` (sibling directory)
- **Network:** Farcaster (Ethereum L2)
- **Auth:** Not yet implemented (signer key flow planned)
- **Status:** Fixture data + feed browsing working. Write actions pending.

### The Forkiverse (ActivityPub / Mastodon) — Tier 1 (in progress)

Read-only port targeting The Forkiverse, a Mastodon instance.

- **Repo:** `forkiverse-jklb` (sibling directory)
- **Network:** ActivityPub / Mastodon (theforkiverse.com)
- **Auth:** Not yet implemented (Mastodon OAuth planned)
- **Status:** Implementation plan written. Build pending.

---

## Implementation Tiers

| Tier | Name | Requirements |
|------|------|-------------|
| **Tier 1** | Reader | Feed browsing + J/K navigation. Middle flow only. Read-only. Valid as a development milestone, not a shipping state. |
| **Tier 2** | Participant | Auth + like + boost + reply. The minimum for a JKLB-compliant release. |
| **Tier 3** | Full JKLB | All three acts, Chorus, notifications, End screen. The complete experience. |

All implementations must reach **Tier 2** to be considered JKLB-compliant and listed as an official implementation.

---

## Want to Build One?

If your network has posts, auth, and a feed, it can probably support JKLB. Here's the process:

### 1. Check network compatibility

Your network needs (at minimum):
- A public or authenticated API for fetching posts
- Some form of user authentication
- Ability to like/favorite and boost/repost via API
- Ability to post replies via API
- CORS support for browser-based API calls (or a simple proxy)

### 2. Implement the adapter

See [adapter.ts](./adapter.ts). This is the TypeScript interface your implementation must fulfill. The adapter is the **only network-specific code** — everything else (UI, keybindings, layout, state management) comes from the shared JKLB codebase.

The fastest path: copy an existing implementation (the Forkiverse port is the simplest starting point), swap in your adapter, and adjust branding.

### 3. Reach out

Message Jake (jakesimonds.com on Bluesky, or open an issue on the repo). We're very open to new implementations. If it looks good and meets Tier 2, it gets:
- Listed here as an official implementation
- Hosted under the jklb.social domain (e.g., jklb.social/farcaster)
- Included in the JKLB family

### 4. What "looks good" means

- Follows the JKLB Specification (jklb-spec.md)
- Memphis aesthetic intact (dark background, bold accents)
- Keyboard-first — all primary actions via hotkeys
- Single viewport, no scrolling
- Text is sacred (never truncated)
- No engagement counts displayed
- Static site, deployable to Cloudflare Pages or similar

---

## Network Comparison

How different networks map to JKLB concepts:

| Concept | AT Protocol (Bluesky) | Farcaster | ActivityPub (Mastodon) |
|---------|----------------------|-----------|----------------------|
| Post | Post record | Cast | Status |
| Like | Like | Like/reaction | Favourite |
| Boost | Repost | Recast | Reblog/Boost |
| Reply | Reply record | Cast with parent | Status with in_reply_to |
| Quote | Embed record | Cast with embed | Status with quote |
| Follow | Follow record | Link message | Follow activity |
| User ID | DID (did:plc:xxx) | FID (number) | Account ID (numeric) |
| Handle | alice.bsky.social | alice (username) | alice@instance.com |
| Text format | Plain text + facets | Plain text + FID mentions | HTML (needs parsing) |
| Timestamp | Unix seconds | Farcaster epoch | ISO 8601 |
| Algo feeds | Feed generators | Neynar feeds | N/A (chronological only) |
| Auth | OAuth 2.0 + DPoP | Signer keys | OAuth 2.0 |
| CORS | Needs proxy | Needs proxy (Neynar) | Varies by instance |

---

*This list is maintained by Jake Simonds. Last updated March 2026.*
