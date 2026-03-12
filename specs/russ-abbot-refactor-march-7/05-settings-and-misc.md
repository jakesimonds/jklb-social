# 05 — Settings, Storage, and Miscellaneous Gaps

## Settings (Spec Section 10)

### Spec-Required Settings

| Setting | Spec Default | Implementation | Status |
|---------|-------------|---------------|--------|
| Tutorial | On (first session) | `DEFAULT_TUTORIAL = true` | OK |
| Text Size | Small | Small/Medium/Large dropdown | OK |
| Background Music | Off | Off, per-phase tracks | OK |
| LLM Prompt Template | Free text, user-configurable | Hardcoded default, NO UI to edit | MISSING |

### Implementation-Only Settings (Not in Spec)

These exist in the implementation but aren't documented in the spec. They're fine to keep — the spec says implementations can extend. But they should not block the refactor.

| Setting | Purpose | Keep? |
|---------|---------|-------|
| `credibleExit` / Award Nomination | Posts-before-prompt, prompt text | Yes (Bluesky-specific extension) |
| `feed.chorusEnabled` | Toggle chorus visibility | Yes (useful, maybe propose to spec) |
| `feed.algoFeed` | Remember selected algo feed | Yes (covered by `capabilities.multipleFeeds`) |
| `feed.atmosphereEnabled` | Toggle atmosphere report | Yes (Bluesky-specific extension) |
| `feed.coverPhotoEnabled` | Toggle cover photos | Yes (maps to `capabilities.coverPhotos`) |
| `feed.coverPhotoPosition` | Cover photo z-index position | Yes (visual preference) |

### Fix: LLM Prompt Template UI

Add to `SettingsPanel.tsx`:
- A textarea input for `explanationPrompt`
- Default value from `DEFAULT_EXPLANATION_PROMPT`
- Save to settings via `updateLLMSettings()`
- Template variables: `{networkName}`, `{postText}`, `{handle}`, `{url}`

## Storage (Spec Section 9.3)

### Current Boundary

| What | Owner | Location | Status |
|------|-------|----------|--------|
| Auth session (tokens, DID) | Adapter | `saveAuthSession/loadAuthSession` in storage.ts | OK |
| User settings | Client | `saveSettings/loadSettings` in storage.ts | OK |
| Session stats | Client | `saveCurrentSession/loadCurrentSession` | OK |
| Session history | Client | `saveSessionHistory/loadSessionHistory` | OK |

**The boundary is correctly drawn.** No changes needed here except:

After refactor, the adapter should own its own storage calls internally. The `saveAuthSession`/`loadAuthSession` functions in `src/lib/storage.ts` should move into the adapter, or the adapter should call them internally so the UI never touches auth persistence.

### localStorage Key Namespace

Spec says: "Settings persist in localStorage under a namespace keyed to the implementation (e.g., `jklb_bluesky_`, `jklb_farcaster_`)."

**Check:** Verify current keys use `jklb_bluesky_` prefix or similar. If they use generic keys, namespace them. This prevents conflicts if multiple JKLB implementations run on the same domain (e.g., `jklb.social/bluesky` and `jklb.social/farcaster`).

## Beginning Flow (Spec Section 4.1)

### Notification Category Mapping

The spec defines 6 notification categories. The implementation handles all of them:

| Spec Category | Implementation Stage Type | AT Protocol Reason | Status |
|--------------|--------------------------|-------------------|--------|
| Likes | `unactionable` (combined) | `like` | OK |
| Boosts | `unactionable` (combined) | `repost` | OK |
| New Followers | `follower` | `follow` | OK |
| Quote Posts | `quote-post` | `quote` | OK |
| Replies | `reply-to-user` | `reply` | OK |
| Mentions | `mention` | `mention` | OK |

**The spec combines likes and boosts into separate categories. The implementation combines them into "unactionable."** This is an acceptable deviation — the spec says "implementations have flexibility in how notifications are presented."

### What Needs to Change

The notification processing in `useBeginning.ts` currently:
1. Imports `AppBskyNotificationListNotifications` type directly
2. Calls `agent.listNotifications()` directly
3. Maps AT Protocol notification reasons to stage types

After refactor:
1. Adapter's `fetchNotifications()` returns `JKLBNotification[]`
2. `useBeginning` receives generic notifications, no AT Protocol types
3. Stage type mapping works on `JKLBNotificationType` enum (`like | boost | follow | reply | quote | mention`)

## Chorus (Spec Section 7)

### Current State

- `ChorusMember` type is already fairly generic (`did`, `handle`, `displayName`, `avatar`, `interactionType`)
- But `fetchNotificationsForChorus()` calls `agent.listNotifications()` directly
- Interaction type mapping uses AT Protocol notification reasons

### What Needs to Change

1. Chorus population should use `adapter.fetchNotifications()` → `JKLBNotification[]`
2. Map `JKLBNotification.type` to chorus interaction type (colors)
3. `ChorusMember` field `did` should be renamed to `id` (generic)

### Chorus Member Type Mapping

| Current `ChorusMember` | After |
|------------------------|-------|
| `did: string` | `id: string` |
| `handle: string` | `handle: string` |
| `displayName: string` | `displayName: string` |
| `avatar: string` | `avatarUrl: string \| null` |
| `interactionType: string` | `interactionType: JKLBNotificationType` |

## End Flow (Spec Section 4.3)

The End flow is mostly spec-compliant. No major changes needed.

### Minor Items

- Award nomination button writes a `social.jklb.award.nomination` record via `com.atproto.repo.createRecord()`. This is Bluesky-specific and should go through the adapter.
- Session stats display is generic and stays as-is.
- "Copy ? posts" button is a client-side clipboard operation — no adapter involvement.

## Composer (Spec Section 6.5)

### Character Limit

Currently hardcoded to 300 (Bluesky's limit). Should come from adapter:

```typescript
// In adapter
readonly maxPostLength: number | null; // Bluesky: 300, Mastodon: 500, Farcaster: 320
```

### Panel Stack Integration

The composer already integrates with the panel stack (`PanelView` type includes `composer-reply` and `composer-quote`). This is correct per spec. No changes needed to the panel model.

### Rich Text / Facet Detection

Currently uses `RichText` from `@atproto/api` in the composer to detect mentions and links. After refactor, the adapter should provide a method for this:

```typescript
// Optional adapter extension
interface BlueskyAdapterExtensions {
  detectFacets(text: string): Promise<{ mentions: string[], links: string[] }>;
}
```

Or simpler: the adapter's `reply()` and `quotePost()` methods accept plain text and handle facet detection internally. The UI doesn't need to know about facets when composing — only when displaying.

## Tutorial System (Spec Section 5)

No changes needed. The tutorial system is already generic:
- Content registry in `tutorials.ts`
- `TutorialCard.tsx` renders generic content
- Settings toggle works
- No AT Protocol dependencies

## Fullscreen Media

No changes needed. Already generic:
- Arrow key navigation for multi-image
- Escape to close
- `;` for video sound
- No AT Protocol dependencies

## Background Music

No changes needed. Already generic:
- Per-phase tracks (beginning, middle, end)
- Auto-pause when video plays
- plyr.fm integration is network-independent

## PDS Events / Atmosphere Report

These are **Bluesky-specific features** not in the core spec:
- `src/lib/pds.ts` — monitors PDS repository events
- `src/components/PDSEventCard.tsx` — displays AT Protocol record types
- `src/components/AtmosphereReport.tsx` — atmospheric summary

**Decision:** Keep these as Bluesky-specific extensions. They can live in `src/adapters/bluesky/extensions/` or stay in their current location with a clear comment that they're network-specific. They don't need to go through the `NetworkAdapter` interface.

## Handle Typeahead

`src/hooks/useHandleTypeahead.ts` makes direct fetch calls to Bluesky's public API (`/xrpc/app.bsky.actor.searchActorsTypeahead`). This should be an optional adapter method:

```typescript
interface NetworkAdapter {
  // ... existing ...

  /** Search for users by partial handle. Optional — used in composer for @-mention autocomplete. */
  searchHandles?(query: string): Promise<JKLBAuthor[]>;
}
```
