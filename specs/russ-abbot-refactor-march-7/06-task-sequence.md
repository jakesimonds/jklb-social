# 06 — Task Sequence

## Overview

These are ordered Ralph tasks for executing the refactor. Each task is designed to be a single PR. Dependencies flow downward — each task builds on the ones above it.

The refactor is split into 4 phases:
- **Phase 1:** Foundation (types + adapter skeleton)
- **Phase 2:** Migration (move AT Protocol code into adapter)
- **Phase 3:** Rewire (hooks and components use adapter instead of Agent)
- **Phase 4:** Cleanup (naming, UI text, polish)

---

## Phase 1: Foundation

### TASK-R01: Copy spec types into the codebase

**What:** Copy `JKLBPost`, `JKLBAuthor`, `JKLBMedia`, and all related types from `specs/core/adapter.ts` into `src/adapters/types.ts`. Also copy the `NetworkAdapter` interface and `NetworkCapabilities`.

**Why:** These types are the contract. Everything else builds on them.

**Files to create:**
- `src/adapters/types.ts` — re-export all types from the spec

**Files to read:**
- `specs/core/adapter.ts`

**Acceptance:** Types compile. No runtime changes. Nothing else imports them yet.

---

### TASK-R02: Create adapter directory structure and BlueskyAdapter skeleton

**What:** Create `src/adapters/bluesky/` with an `index.ts` that exports a `BlueskyAdapter` class. The class should implement `NetworkAdapter` with stub methods that throw "not implemented" errors. Fill in the identity fields (`networkName`, `postNoun`, `capabilities`, etc.).

**Why:** Establishes the shape. Every subsequent task fills in one or more methods.

**Files to create:**
- `src/adapters/bluesky/index.ts`
- `src/adapters/bluesky/adapter.ts`
- `src/adapters/bluesky/post-meta.ts` — the `Map<string, BlueskyPostMeta>` cache

**Files to read:**
- `specs/core/adapter.ts` (interface to implement)
- `src/adapters/types.ts` (types from R01)

**Acceptance:** `BlueskyAdapter` class exists, implements `NetworkAdapter`, compiles with stubs.

---

### TASK-R03: Build the post transformation layer

**What:** Create `src/adapters/bluesky/transform.ts` with functions that transform raw AT Protocol `FeedViewPost` / `PostView` shapes into `JKLBPost` objects. This is the core of the adapter.

**Why:** This is where `uri` becomes `id`, `indexedAt` becomes `createdAt`, `did` becomes `author.id`, embeds become `media` + `quotedPost`, and `nativeUrl` gets generated.

**Files to create:**
- `src/adapters/bluesky/transform.ts`
- `src/adapters/bluesky/embed-parser.ts` (move logic from `src/lib/embed-utils.ts`)
- `src/adapters/bluesky/facet-parser.ts` (extract link/mention/hashtag facets)

**Files to read:**
- `src/lib/feed.ts` — `transformFeedViewPost()`, `transformPostView()` (the functions being moved)
- `src/lib/embed-utils.ts` — all `app.bsky.embed.*` type detection
- `src/types/index.ts` — current `Post`, `PostAuthor`, `PostEmbed` types

**Key mapping (see 01-data-model.md):**
- `uri` -> `id`
- `cid` -> stored in PostMeta cache
- `did` -> `author.id`
- `indexedAt` -> `createdAt`
- `embed` -> split into `media` + `quotedPost`
- `isReposted` -> `isBoosted`
- `likeUri`/`repostUri` -> stored in PostMeta cache
- Generate `nativeUrl`: `https://bsky.app/profile/${handle}/post/${rkey}`
- Generate `author.profileUrl`: `https://bsky.app/profile/${handle}`
- Extract `mentionFacets` and `hashtagFacets` from AT Protocol facets

**Acceptance:** Unit test: feed the existing fixture data through the transformer, validate output with `validateJKLBPost()` from the spec. All fields populated correctly. PostMeta cache stores uri/cid/likeUri/repostUri for each transformed post.

---

### TASK-R04: Build thread and notification parsers

**What:** Create parsers that transform AT Protocol thread and notification responses into spec types.

**Files to create:**
- `src/adapters/bluesky/thread-parser.ts` — AT Protocol thread response -> `JKLBThreadPost[]`
- `src/adapters/bluesky/notification-parser.ts` — AT Protocol notifications -> `JKLBNotification[]`

**Files to read:**
- `src/lib/thread.ts` — current thread parsing logic (move the `app.bsky.feed.defs#threadViewPost` checks)
- `src/hooks/useBeginning.ts` — notification categorization logic
- `src/lib/chorus.ts` — chorus notification extraction

**Acceptance:** Parsers compile, produce correct spec types. Thread parser handles `$type` checks internally. Notification parser maps AT Protocol reasons to `JKLBNotificationType`.

---

## Phase 2: Migration

### TASK-R05: Implement auth methods on BlueskyAdapter

**What:** Move OAuth flow from `src/lib/auth.ts` into `src/adapters/bluesky/auth.ts`. Implement `startLogin()`, `resumeSession()`, `logout()` on `BlueskyAdapter`.

**Files to create:**
- `src/adapters/bluesky/auth.ts`

**Files to read:**
- `src/lib/auth.ts` — current OAuth flow
- `src/lib/storage.ts` — auth session persistence

**Key change:** The adapter internally creates and holds the `Agent` instance. Nothing outside the adapter touches `Agent` directly. `resumeSession()` returns `JKLBSession` (with `JKLBAuthor` user info) instead of exposing the `Agent`.

**Acceptance:** Login flow works end-to-end through the adapter. `Agent` is private to the adapter.

---

### TASK-R06: Implement feed and action methods on BlueskyAdapter

**What:** Implement `fetchFeed()`, `getAvailableFeeds()`, `toggleLike()`, `toggleBoost()`, `reply()`, `quotePost()`, `toggleFollow()` on the adapter.

**Files to read:**
- `src/lib/actions.ts` — current action implementations
- `src/lib/feed.ts` — feed fetching logic
- `src/lib/saved-feeds.ts` — feed preference fetching

**Key changes:**
- `toggleLike(postId)` looks up PostMeta for uri/cid, calls `agent.like()` or `agent.deleteLike()`, updates PostMeta
- `toggleBoost(postId)` same pattern
- `reply()` and `quotePost()` handle `RichText` facet detection internally
- `fetchFeed()` calls `agent.getTimeline()` or `agent.app.bsky.feed.getFeed()`, transforms via `transform.ts`, returns `JKLBFeedPage`
- `getAvailableFeeds()` wraps saved feed preferences

**Acceptance:** All adapter methods work. Can like, boost, reply, quote, follow/unfollow through the adapter.

---

### TASK-R07: Implement thread, notification, and URL methods on BlueskyAdapter

**What:** Implement `fetchThread()`, `fetchNotifications()`, `getPostUrl()`, `getProfileUrl()` on the adapter.

**Files to read:**
- `src/lib/thread.ts` — thread fetching
- `src/hooks/useBeginning.ts` — notification fetching
- `src/lib/chorus.ts` — chorus notification fetching
- `src/App.tsx` — `buildBskyUrl()` function

**Acceptance:** All remaining adapter methods work. `getPostUrl()` generates correct Bluesky URLs. Thread and notification responses are properly typed.

---

## Phase 3: Rewire

### TASK-R08: Replace AuthContext — provide adapter instead of Agent

**What:** Change `src/lib/AuthContext.tsx` to provide `NetworkAdapter` (specifically `BlueskyAdapter`) instead of `Agent`. Update `App.tsx` to create the adapter and pass it through context.

**Files to modify:**
- `src/lib/AuthContext.tsx` — context type changes from `Agent | null` to `NetworkAdapter | null`
- `src/App.tsx` — create `BlueskyAdapter`, use it for auth, pass through context

**Key change:** Every component/hook that currently reads `Agent` from context will get `NetworkAdapter` instead. This is the pivot point — after this, downstream rewiring begins.

**Acceptance:** App boots, auth works through the adapter, context provides `NetworkAdapter`.

---

### TASK-R09: Rewire feed hooks to use adapter

**What:** Update `useFeed` and `useAvailableFeeds` to accept `NetworkAdapter` instead of `Agent`. Replace direct `agent.getTimeline()` calls with `adapter.fetchFeed()`.

**Files to modify:**
- `src/hooks/useFeed.ts` — param type, API calls
- `src/hooks/useAvailableFeeds.ts` — param type, API calls

**Also update:** Any component that passes `Agent` to these hooks.

**Acceptance:** Feed loads through the adapter. Posts are `JKLBPost` objects.

---

### TASK-R10: Rewire action hooks to use adapter

**What:** Update `usePostActions` to accept `NetworkAdapter` instead of `Agent`. Replace direct action function calls with adapter methods.

**Files to modify:**
- `src/hooks/usePostActions.ts`

**Acceptance:** Like, boost, reply, quote, follow all work through the adapter.

---

### TASK-R11: Rewire Beginning flow to use adapter

**What:** Update `useBeginning` to use `adapter.fetchNotifications()` instead of `agent.listNotifications()`. Remove `AppBskyNotificationListNotifications` import. Update all Beginning components.

**Files to modify:**
- `src/hooks/useBeginning.ts` — notification fetching + processing
- `src/components/beginning/BeginningView.tsx` — prop type
- `src/components/beginning/BeginningPostCard.tsx` — prop type, fetch calls
- `src/components/beginning/NewFollowerCard.tsx` — prop type, fetch calls
- `src/components/beginning/UnactionableItemsView.tsx` — prop type, fetch calls

**This is the highest-risk task.** The Beginning flow has the most complex data transformation. Test thoroughly:
- All notification categories render correctly
- Empty categories are skipped
- Chorus populates progressively
- Actionable notifications (replies, quotes, mentions) allow like/boost

**Acceptance:** Beginning flow works identically through the adapter. No `@atproto` imports in any Beginning file.

---

### TASK-R12: Rewire Chorus and remaining hooks

**What:** Update chorus, thread, author banner, unread notifications, and notification hover to use the adapter.

**Files to modify:**
- `src/lib/chorus.ts` — use `adapter.fetchNotifications()` for chorus population
- `src/hooks/useThread.ts` — use `adapter.fetchThread()`
- `src/hooks/useAuthorBanner.ts` — use `JKLBAuthor.bannerUrl` or adapter method
- `src/hooks/useUnreadNotifications.ts` — use adapter
- `src/components/NotificationHover.tsx` — use adapter for thread context

**Acceptance:** All hooks work through adapter. No `Agent` imports outside `src/adapters/`.

---

### TASK-R13: Update types/index.ts — swap Post for JKLBPost

**What:** Replace the current `Post`, `PostAuthor`, `PostEmbed`, etc. types with re-exports of `JKLBPost`, `JKLBAuthor`, `JKLBMedia` from the adapter types. If any component still references old field names, update them.

**Files to modify:**
- `src/types/index.ts` — replace types
- Any component referencing `post.uri`, `post.cid`, `post.indexedAt`, `post.isReposted`, `author.did`, `author.avatar`, `embed.type === 'external'`, etc.

**Search patterns:**
- `post.uri` -> `post.id`
- `post.cid` -> remove (not on JKLBPost)
- `post.indexedAt` -> `post.createdAt`
- `post.isReposted` -> `post.isBoosted`
- `post.likeUri` -> remove
- `post.repostUri` -> remove
- `author.did` -> `author.id`
- `author.avatar` -> `author.avatarUrl`
- `author.banner` -> `author.bannerUrl`
- `embed?.type === 'external'` -> `media?.type === 'link-preview'`
- `embed?.type === 'record'` -> `quotedPost !== null`

**This is a wide-reaching change.** Every component that renders post data will be touched. But each individual change is a simple rename.

**Acceptance:** All old type names removed. `src/types/index.ts` re-exports spec types. App compiles and works.

---

## Phase 4: Cleanup

### TASK-R14: Remove old files, verify import boundary

**What:** Delete or empty out files whose logic has been fully moved to the adapter:
- `src/lib/auth.ts` — replaced by adapter auth
- `src/lib/actions.ts` — replaced by adapter methods
- `src/lib/embed-utils.ts` — replaced by adapter embed-parser
- `src/lib/thread.ts` — replaced by adapter thread-parser

Keep files that still have generic client-side logic (storage, settings, session, tutorials).

Run verification:
```bash
grep -r "@atproto" src/ --include="*.ts" --include="*.tsx" -l | grep -v "src/adapters/"
# Should return nothing

grep -r "bsky\.app" src/ --include="*.ts" --include="*.tsx" -l | grep -v "src/adapters/"
# Should return nothing
```

**Acceptance:** Zero `@atproto` imports outside `src/adapters/`. Zero `bsky.app` URLs outside `src/adapters/`. App builds and deploys.

---

### TASK-R15: UI naming and text cleanup

**What:** Rename Bluesky-specific function names and UI text to generic equivalents.

**Changes:**
- `handleViewOnBluesky` -> `handleViewOnPlatform`
- `onViewOnBluesky` -> `onViewOnPlatform`
- "View on Bluesky" tooltip -> `"View on " + adapter.nativeClientName`
- Composer 300-char limit -> read from `adapter.maxPostLength`
- Chorus member `did` field -> `id`
- Remove `u` key (unfollow) if decided, or document as extension
- Add LLM prompt template textarea to SettingsPanel

**Acceptance:** No Bluesky-specific naming in generic UI code. Composer limit is adapter-driven.

---

### TASK-R16: Handle typeahead and profile fetch via adapter

**What:** Move `useHandleTypeahead.ts` direct fetch calls and scattered `agent.getProfile()` calls through adapter methods.

**Files to modify:**
- `src/hooks/useHandleTypeahead.ts` — use `adapter.searchHandles?()`
- `src/components/AppLayout.tsx` — profile fetch for hover popup
- `src/components/beginning/NewFollowerCard.tsx` — should already be done in R11

**Add to adapter (optional extension methods):**
```typescript
searchHandles?(query: string): Promise<JKLBAuthor[]>;
fetchProfile?(authorId: string): Promise<JKLBAuthor>;
```

**Acceptance:** No direct HTTP calls to `/xrpc/` endpoints outside the adapter.

---

### TASK-R17: Final verification and fixture validation

**What:** Run the `validateJKLBPost()` function from the spec against live data. Verify the full app flow works end-to-end:
- Login
- Beginning flow (all notification categories)
- Middle flow (browse feed, like, boost, reply, quote, follow, thread view)
- End flow (stats, award nomination, another session, log out)
- Settings panel
- Fullscreen media
- Chorus population
- Keyboard navigation (all keys from spec section 6)

**Create:** `src/adapters/bluesky/__tests__/validate.test.ts` that runs fixture data through the transformer and validates output.

**Acceptance:** All flows work. Fixture validation passes. App deploys to Cloudflare Pages and works identically to pre-refactor.

---

## Task Dependency Graph

```
Phase 1 (Foundation):
  R01 (types) -> R02 (skeleton) -> R03 (transform) -> R04 (parsers)

Phase 2 (Migration):
  R03 + R04 -> R05 (auth) -> R06 (feed + actions) -> R07 (thread + notifs + URLs)

Phase 3 (Rewire):
  R07 -> R08 (context) -> R09 (feed hooks)
                       -> R10 (action hooks)
                       -> R11 (beginning)     [HIGHEST RISK]
                       -> R12 (chorus + misc)
         R09-R12 all -> R13 (type swap)      [WIDEST REACH]

Phase 4 (Cleanup):
  R13 -> R14 (delete old files)
      -> R15 (naming cleanup)
      -> R16 (typeahead + profile)
      -> R17 (final verification)
```

## Estimated Effort

- **Phase 1:** 4 tasks, mostly new file creation. Low risk.
- **Phase 2:** 3 tasks, moving existing code. Medium risk.
- **Phase 3:** 6 tasks, rewiring everything. High risk (especially R11 and R13).
- **Phase 4:** 4 tasks, cleanup and verification. Low risk.

**Total:** 17 tasks. Each is a single PR.

## What NOT to Do During This Refactor

- Do not add new features
- Do not change the visual design
- Do not refactor CSS or component structure
- Do not optimize performance (unless something breaks)
- Do not update dependencies
- Do not change the build system
- Do not touch the mobile app (separate refactor later)
- Do not modify the spec (if you find spec bugs, document them separately)
