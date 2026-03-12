# 03 — Import Boundary

## The Rule

After refactoring, `@atproto/api` and `@atproto/oauth-client-browser` should ONLY be imported in files under `src/adapters/bluesky/`. Zero exceptions.

## Current State: Full Inventory

Every file that currently imports from `@atproto/*`, what it imports, and what needs to happen.

### Direct `Agent` Type Imports (20 files)

These files import `Agent` from `@atproto/api` and pass it around. After refactor, they should accept `NetworkAdapter` instead.

| File | Import | What It Does | Action |
|------|--------|-------------|--------|
| `src/lib/auth.ts` | `Agent`, `BrowserOAuthClient`, `OAuthSession` | OAuth flow, creates Agent | **Move to** `src/adapters/bluesky/auth.ts` |
| `src/lib/AuthContext.tsx` | `Agent` type | React context providing Agent | **Change to** provide `NetworkAdapter` instead |
| `src/lib/actions.ts` | `Agent`, `RichText` | All write actions (like, repost, follow, reply) | **Move to** `src/adapters/bluesky/adapter.ts` |
| `src/lib/feed.ts` | `Agent` | Feed fetching + transformation | **Split:** fetch -> adapter, transform -> adapter, hook logic stays |
| `src/lib/thread.ts` | `Agent` | Thread fetching + parsing | **Move to** `src/adapters/bluesky/thread-parser.ts` |
| `src/lib/chorus.ts` | `Agent` type | Notification fetch for chorus | **Rewire** to use `adapter.fetchNotifications()` |
| `src/lib/saved-feeds.ts` | *(indirect via Agent)* | Preference fetching | **Move to** adapter |
| `src/hooks/useFeed.ts` | `Agent` type | Feed hook params | **Change param** from `Agent` to `NetworkAdapter` |
| `src/hooks/usePostActions.ts` | `Agent` type | Action hook params | **Change param** to `NetworkAdapter` |
| `src/hooks/useBeginning.ts` | `Agent`, `AppBskyNotificationListNotifications` | Notification processing | **Rewire** to `adapter.fetchNotifications()` |
| `src/hooks/useThread.ts` | `Agent` type | Thread hook params | **Change param** to `NetworkAdapter` |
| `src/hooks/useAuthorBanner.ts` | `Agent` type | Profile/banner fetching | **Rewire** — banner comes from `JKLBAuthor.bannerUrl` or adapter call |
| `src/hooks/useAvailableFeeds.ts` | `Agent` type | Feed list fetching | **Change param** to `NetworkAdapter` |
| `src/hooks/useUnreadNotifications.ts` | `Agent` type | Unread check | **Rewire** to adapter |
| `src/components/NotificationHover.tsx` | `Agent` type | Fetch thread for hover | **Rewire** to adapter |
| `src/components/beginning/BeginningView.tsx` | `Agent` type | Passed to child components | **Change prop** to `NetworkAdapter` |
| `src/components/beginning/BeginningPostCard.tsx` | `Agent` type | Fetch posts by URI | **Rewire** to adapter |
| `src/components/beginning/NewFollowerCard.tsx` | `Agent` type | Fetch follower profile | **Rewire** to adapter |
| `src/components/beginning/UnactionableItemsView.tsx` | `Agent` type | Fetch posts and profiles | **Rewire** to adapter |
| `src/claim/main.ts` | `Agent`, OAuth client | Claim page (separate entry point) | **Move to** adapter or keep isolated |

### AT Protocol Lexicon String Literals

These files contain hardcoded `app.bsky.*` or `com.atproto.*` namespace strings:

| File | Strings Used | Action |
|------|-------------|--------|
| `src/lib/embed-utils.ts` | `app.bsky.embed.images#view`, `app.bsky.embed.video#view`, `app.bsky.embed.external#view`, `app.bsky.embed.record#view`, `app.bsky.embed.recordWithMedia#view` | **Move to** `src/adapters/bluesky/embed-parser.ts` |
| `src/lib/thread.ts` | `app.bsky.feed.defs#threadViewPost` | **Move to** `src/adapters/bluesky/thread-parser.ts` |
| `src/lib/feed.ts` | `app.bsky.feed.defs#reasonRepost`, `app.bsky.feed.defs#threadViewPost` | **Move to** adapter |
| `src/lib/pds.ts` | `app.bsky.*`, `chat.bsky.*` | **Keep** — PDS is Bluesky-specific feature, could live in adapter extensions |
| `src/components/PDSEventCard.tsx` | Lexicon type display mapping | **Keep** — Bluesky-specific component |

### Direct HTTP Calls to AT Protocol APIs

| File | Endpoint | Action |
|------|----------|--------|
| `src/hooks/useAuthorBanner.ts` | `/xrpc/app.bsky.actor.getProfile` | **Move to** adapter (public profile fallback) |
| `src/hooks/useHandleTypeahead.ts` | `/xrpc/app.bsky.actor.searchActorsTypeahead` | **Move to** adapter |

### Low-Level `com.atproto.repo.*` Calls

| File | Call | What For | Action |
|------|------|----------|--------|
| `src/lib/actions.ts` | `agent.com.atproto.repo.listRecords()` | Find follow record for unfollow | **Move to** adapter |
| `src/lib/actions.ts` | `agent.com.atproto.repo.createRecord()` | Create JKLB Award nomination | **Move to** adapter |

## Migration Order

The order matters because of dependencies. Move bottom-up:

1. **Types first** — Define `JKLBPost` etc. in `src/adapters/types.ts`
2. **Parsers** — embed-parser, thread-parser, notification-parser, facet-parser (pure functions, no side effects)
3. **Auth** — Move OAuth flow into adapter
4. **Adapter class** — Wire up parsers + auth + Agent
5. **Hooks** — Change params from `Agent` to `NetworkAdapter`, rewire calls
6. **Components** — Update props, remove `Agent` imports
7. **Context** — Change `AuthContext` to provide `NetworkAdapter`
8. **Cleanup** — Delete now-empty files, verify no `@atproto` imports outside adapter

## Verification

After each step, run:
```bash
# Should return ONLY files under src/adapters/bluesky/
grep -r "@atproto" src/ --include="*.ts" --include="*.tsx" -l

# Should return nothing outside adapter
grep -r "app\.bsky\." src/ --include="*.ts" --include="*.tsx" -l | grep -v "src/adapters/"
```
