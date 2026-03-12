# 02 — Adapter Implementation

## Overview

Create a `BlueskyAdapter` class that implements the `NetworkAdapter` interface from `specs/core/adapter.ts`. This is the only place AT Protocol code should live.

## File Structure

```
src/adapters/
  bluesky/
    index.ts              # Re-exports BlueskyAdapter
    adapter.ts            # BlueskyAdapter class implementing NetworkAdapter
    auth.ts               # OAuth flow (extracted from src/lib/auth.ts)
    transform.ts          # Raw AT Protocol responses -> JKLBPost/JKLBAuthor
    embed-parser.ts       # AT Protocol embed type detection (extracted from src/lib/embed-utils.ts)
    facet-parser.ts       # AT Protocol facet extraction (links, mentions, hashtags)
    thread-parser.ts      # AT Protocol thread response -> JKLBThreadPost[]
    notification-parser.ts # AT Protocol notifications -> JKLBNotification[]
    post-meta.ts          # Internal AT URI/CID lookup table
    rich-text.ts          # RichText wrapper for creating posts with facets
    types.ts              # Internal AT Protocol types (not exported outside adapter)
```

## BlueskyAdapter Class Skeleton

```typescript
import type { NetworkAdapter, NetworkCapabilities, JKLBPost, JKLBAuthor,
  JKLBSession, JKLBFeedPage, JKLBFeedOption, JKLBThreadPost,
  JKLBNotification } from '../../specs/core/adapter';

export class BlueskyAdapter implements NetworkAdapter {
  // --- Identity ---
  readonly networkName = 'Bluesky';
  readonly postNoun = 'post';
  readonly boostNoun = 'repost';
  readonly likeNoun = 'like';
  readonly nativeClientName = 'Bluesky';
  readonly nativeClientUrl = 'https://bsky.app';

  readonly capabilities: NetworkCapabilities = {
    notifications: true,
    multipleFeeds: true,
    threads: true,
    quotePosts: true,
    follow: true,
    coverPhotos: true,
    reply: true,
    mentions: true,
    hashtags: true,
  };

  // --- Internal state ---
  private agent: Agent | null = null;
  private oauthClient: BrowserOAuthClient | null = null;
  private postMeta: Map<string, BlueskyPostMeta> = new Map();

  // --- Auth ---
  async startLogin(handle: string): Promise<void> { /* OAuth redirect flow */ }
  async resumeSession(): Promise<JKLBSession | null> { /* Check for callback or stored session */ }
  async logout(): Promise<void> { /* Clear tokens */ }

  // --- Feed ---
  async fetchFeed(feedId: string | null, cursor: string | null, limit: number): Promise<JKLBFeedPage> {
    // Call agent.getTimeline() or agent.app.bsky.feed.getFeed()
    // Transform each post via transform.ts
    // Store post meta (uri, cid, likeUri, etc.) in this.postMeta
    // Return JKLBFeedPage
  }

  async getAvailableFeeds(): Promise<JKLBFeedOption[]> {
    // Fetch saved feeds from preferences
    // Transform to JKLBFeedOption[]
  }

  // --- Post Actions ---
  async toggleLike(postId: string): Promise<boolean> {
    const meta = this.postMeta.get(postId);
    // Use meta.uri, meta.cid for agent.like() or agent.deleteLike()
    // Update meta.likeUri
    // Return new liked state
  }

  async toggleBoost(postId: string): Promise<boolean> { /* Similar to toggleLike */ }

  async reply(parentPostId: string, text: string): Promise<void> {
    const meta = this.postMeta.get(parentPostId);
    // Use RichText for facet detection
    // Call agent.post() with reply ref
  }

  async quotePost(quotedPostId: string, text: string): Promise<void> { /* Similar */ }

  async toggleFollow(authorId: string): Promise<boolean> { /* Follow/unfollow by DID */ }

  // --- Thread ---
  async fetchThread(postId: string): Promise<JKLBThreadPost[]> {
    const meta = this.postMeta.get(postId);
    // Call agent.getPostThread()
    // Parse via thread-parser.ts
  }

  // --- Notifications ---
  async fetchNotifications(): Promise<JKLBNotification[]> {
    // Call agent.listNotifications()
    // Transform via notification-parser.ts
  }

  // --- URLs ---
  getPostUrl(post: JKLBPost): string {
    const meta = this.postMeta.get(post.id);
    const rkey = extractRkey(meta?.uri || post.id);
    return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
  }

  getProfileUrl(author: JKLBAuthor): string {
    return `https://bsky.app/profile/${author.handle}`;
  }
}
```

## Key Design Decisions

### Post ID = AT URI

The `JKLBPost.id` field for Bluesky will be the AT URI (`at://did:plc:xxx/app.bsky.feed.post/rkey`). It's opaque to the UI — the UI never parses it. The adapter uses it as the key into `postMeta` for looking up CIDs, like URIs, etc.

### PostMeta Cache

The adapter maintains a `Map<string, BlueskyPostMeta>` that stores AT Protocol-specific metadata stripped from `JKLBPost`. When the UI says "like post abc123", the adapter looks up `abc123` in the map to find the URI and CID needed for the AT Protocol API call.

This cache grows as the user browses. For a typical session (~50-100 posts), this is negligible. No need to prune.

### Author ID = DID

The `JKLBAuthor.id` field for Bluesky is the DID (`did:plc:xxx`). Used for follow/unfollow operations.

### Adapter as Singleton

The adapter should be a singleton — one instance per session. It holds the `Agent`, the OAuth client, and the post meta cache. It's created once and passed to the React context.

### What Moves Into the Adapter

These existing files get absorbed into the adapter:

| Current File | Destination | What Moves |
|-------------|-------------|------------|
| `src/lib/auth.ts` | `src/adapters/bluesky/auth.ts` | OAuth flow, session management |
| `src/lib/actions.ts` | `src/adapters/bluesky/adapter.ts` | All action methods (like, repost, follow, reply, quote) |
| `src/lib/feed.ts` (transformation parts) | `src/adapters/bluesky/transform.ts` | `transformFeedViewPost()`, `transformPostView()` |
| `src/lib/feed.ts` (fetching parts) | `src/adapters/bluesky/adapter.ts` | `getTimeline()`, `getFeed()`, `getPosts()` |
| `src/lib/embed-utils.ts` | `src/adapters/bluesky/embed-parser.ts` | All `app.bsky.embed.*` type detection |
| `src/lib/thread.ts` | `src/adapters/bluesky/thread-parser.ts` | Thread response parsing |
| `src/lib/notifications.ts` (transformation) | `src/adapters/bluesky/notification-parser.ts` | Notification type mapping |
| `src/lib/saved-feeds.ts` | `src/adapters/bluesky/adapter.ts` | Feed preference fetching |
| `src/lib/pds.ts` | `src/adapters/bluesky/adapter.ts` (optional) | PDS event monitoring (Bluesky-specific feature) |

### What Stays Outside the Adapter

| File | Why It Stays |
|------|-------------|
| `src/hooks/useKeybindings.ts` | Pure UI logic, no network calls |
| `src/hooks/useFocusNavigation.ts` | Pure UI logic |
| `src/hooks/useFullscreenMedia.ts` | Pure UI logic |
| `src/hooks/useBackgroundMusic.ts` | Pure UI logic |
| `src/hooks/useEndFlow.ts` | Pure UI logic |
| `src/lib/settings.ts` | Client-side persistence |
| `src/lib/storage.ts` | Client-side persistence |
| `src/lib/session.ts` | Client-side session stats |
| `src/lib/tutorials.ts` | Pure UI content |
| `src/lib/theme.ts` | Pure UI styling |
| All components | Pure UI rendering |

### Hooks That Need Rewiring

These hooks currently accept `Agent` and make direct API calls. They need to accept the adapter instead:

| Hook | Current | After |
|------|---------|-------|
| `useFeed` | Accepts `Agent`, calls `agent.getTimeline()` | Accepts `NetworkAdapter`, calls `adapter.fetchFeed()` |
| `usePostActions` | Accepts `Agent`, calls action functions | Accepts `NetworkAdapter`, calls `adapter.toggleLike()` etc. |
| `useBeginning` | Accepts `Agent`, calls `agent.listNotifications()` | Accepts `NetworkAdapter`, calls `adapter.fetchNotifications()` |
| `useThread` | Accepts `Agent`, calls thread fetch | Accepts `NetworkAdapter`, calls `adapter.fetchThread()` |
| `useAuthorBanner` | Accepts `Agent`, calls `getProfile()` | Accepts `NetworkAdapter` or receives banner from `JKLBAuthor.bannerUrl` |
| `useAvailableFeeds` | Accepts `Agent`, calls `getPreferences()` | Accepts `NetworkAdapter`, calls `adapter.getAvailableFeeds()` |
| `useUnreadNotifications` | Accepts `Agent`, calls `listNotifications()` | Accepts `NetworkAdapter`, calls `adapter.fetchNotifications()` |

## Hydration Helpers (Beyond Core Interface)

The Beginning flow components need to fetch actual post content and profiles after categorizing notifications. These calls currently go through `Agent` directly. The adapter needs extension methods for them:

```typescript
// On BlueskyAdapter (not on NetworkAdapter interface — these are Bluesky extensions)

/** Batch-fetch posts by ID. Used by Beginning components to hydrate notification data. */
fetchPosts(postIds: string[]): Promise<JKLBPost[]>;

/** Fetch a full profile by author ID. Used by NewFollowerCard and profile hover popups. */
fetchProfile(authorId: string): Promise<JKLBAuthor>;
```

The UI calls these as `adapter.fetchPosts(ids)` / `adapter.fetchProfile(id)`. Same waterfall pattern as today — notifications first, hydration fetches second — just going through the adapter instead of reaching for `Agent`.

## Additional Adapter Capabilities (Beyond Spec)

The Bluesky implementation has features not in the core spec that should still go through the adapter:

| Feature | Current Location | Adapter Method |
|---------|-----------------|---------------|
| Author banner fetch | `useAuthorBanner.ts` | Already covered by `JKLBAuthor.bannerUrl` in post data |
| Handle typeahead | `useHandleTypeahead.ts` | `searchHandles?(query: string): Promise<JKLBAuthor[]>` |
| PDS event feed | `src/lib/pds.ts` | Bluesky-specific extension, not in adapter interface |
| Award nomination | `src/lib/actions.ts` | Bluesky-specific extension (uses `social.jklb.award.nomination` lexicon) |
| Chorus notification fetch | `src/lib/chorus.ts` | Already covered by `adapter.fetchNotifications()` |
| Profile fetch for hover | `AppLayout.tsx`, `NewFollowerCard.tsx` | `fetchProfile?(authorId: string): Promise<JKLBAuthor>` |

For Bluesky-specific extensions not in the spec, the adapter can expose additional methods beyond `NetworkAdapter`. Components that use these features would check `adapter instanceof BlueskyAdapter` or use optional chaining on extended methods.
