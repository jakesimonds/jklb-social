# Community Account Infrastructure

**Skyboard**: 3mg34tg (idea only → scaffolded)
**Effort**: Medium (Ralph-able once accounts exist)

## Overview

Two community Bluesky accounts that users can post photos to from the end-of-session flow. Photos auto-delete after 48 hours.

- **feelingcute.jklb.social** — selfies (front camera)
- **postcards.jklb.social** — what you're looking at (back camera)

## Prerequisites (Jake must do manually)

1. **Create two Bluesky accounts** on bsky.app
   - Need email addresses — use Gmail `+` aliases or jklb.social catch-all
   - e.g. `jake+feelingcute@whatever.com` and `jake+postcards@whatever.com`
   - Pick temporary handles, then set custom handles via DNS

2. **Set custom handles via DNS** (same as you've done before)
   - Add `_atproto.feelingcute` TXT record → `did=did:plc:xxxxx`
   - Add `_atproto.postcards` TXT record → `did=did:plc:yyyyy`

3. **Generate app passwords** for both accounts
   - Settings → App Passwords → create one for each
   - These become CF Worker secrets

4. **Store secrets in Cloudflare**
   ```bash
   wrangler pages secret put FEELINGCUTE_APP_PASSWORD --project-name=jklb
   wrangler pages secret put POSTCARDS_APP_PASSWORD --project-name=jklb
   wrangler pages secret put FEELINGCUTE_DID --project-name=jklb
   wrangler pages secret put POSTCARDS_DID --project-name=jklb
   wrangler pages secret put FEELINGCUTE_HANDLE --project-name=jklb
   wrangler pages secret put POSTCARDS_HANDLE --project-name=jklb
   ```

## Implementation

### 1. CF Pages Function: `/api/community-post`

**File**: `functions/api/community-post.ts`

Accepts an image + metadata from the client, posts it to the appropriate community account.

**POST body** (multipart/form-data):
- `image`: the photo file
- `account`: `"feelingcute"` or `"postcards"`
- `userHandle`: the poster's Bluesky handle (for attribution in alt text)

**Flow**:
1. Validate inputs
2. Create an ATProto agent, log in with the community account's app password
3. Upload the image blob via `agent.uploadBlob()`
4. Read image dimensions from the blob (or accept from client) for `aspectRatio`
5. Create a post with `app.bsky.embed.images` embed
6. Post text: something simple like "📸 via @{userHandle} on jklb"
7. Return `{ ok: true, uri: post.uri }`

**Env bindings needed**:
```typescript
interface Env {
  NOMINATIONS: KVNamespace;
  COMMUNITY_POSTS: KVNamespace; // track post URIs for cleanup
  FEELINGCUTE_APP_PASSWORD: string;
  FEELINGCUTE_DID: string;
  FEELINGCUTE_HANDLE: string;
  POSTCARDS_APP_PASSWORD: string;
  POSTCARDS_DID: string;
  POSTCARDS_HANDLE: string;
}
```

### 2. KV Namespace: COMMUNITY_POSTS

Track posted URIs with timestamps so the cron can find and delete them.

**Key format**: `{account}:{rkey}` (e.g. `feelingcute:3abc123`)
**Value**: `{ uri: string, cid: string, createdAt: string }`

Create the KV namespace:
```bash
wrangler kv namespace create COMMUNITY_POSTS
# Add the ID to wrangler.toml
```

### 3. Cron: 48-hour cleanup

**File**: `functions/api/community-cleanup.ts`

This is trickier with CF Pages Functions — Pages doesn't support cron triggers natively. Options:

**Option A (simplest)**: Run cleanup on every POST request. Before posting, scan KV for entries older than 48h and delete them. Piggyback cleanup on traffic.

**Option B**: Separate CF Worker (not Pages Function) with a cron trigger. More correct but adds a second deployment target.

**Option C**: External cron (GitHub Actions scheduled workflow) that hits a cleanup endpoint.

**Recommendation**: Option A for now. It's minimal, works without extra infra, and community post volume will be low enough that scanning KV on each post is fine.

**Cleanup logic**:
1. List all keys in COMMUNITY_POSTS KV
2. For each entry, check `createdAt`
3. If older than 48 hours:
   - Delete the post via ATProto `deleteRecord`
   - Delete the KV entry

## Platform Note

The community post flow is triggered from the **mobile app's end flow** (React Native / Expo), not the web app. The CF Pages Function serves both platforms, but the initial integration is mobile-only. The mobile end flow is a separate implementation from the web's `useEndFlow.ts` / `CredibleExitPanel.tsx`.

## Ralph Tasks

### Task 1: Create KV namespace and update wrangler.toml
- `wrangler kv namespace create COMMUNITY_POSTS`
- Add binding to `wrangler.toml`

### Task 2: Build `functions/api/community-post.ts`
- Follow the existing `nominations.ts` pattern exactly
- ATProto agent creation using `@atproto/api` (already a dependency)
- Image upload → post creation → KV tracking → cleanup sweep
- CORS headers same as nominations endpoint

### Task 3: Client-side helper
- `postToCommunityAccount(account, imageFile, userHandle)` function
- POSTs multipart form data to `/api/community-post`
- Returns success/failure
- Lives in `mobile/lib/actions.ts` (or shared if the function is platform-agnostic)

## Dependencies

- `@atproto/api` — already in the project, but needs to be available in the CF Worker context too. It's a browser-compatible package so it should work in Workers.

## Done when

- POST to `/api/community-post` with an image creates a post on the correct community account
- Posts appear on the community account's Bluesky profile
- Old posts get cleaned up (eventually, via piggyback)
