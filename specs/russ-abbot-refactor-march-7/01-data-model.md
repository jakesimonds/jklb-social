# 01 — Data Model Mapping

## Overview

The current `Post` type in `src/types/index.ts` is AT Protocol-native. It needs to become `JKLBPost` from `specs/core/adapter.ts`. This document maps every field.

## Post Type: Current -> JKLBPost

| Current Field | Current Type | JKLBPost Field | JKLBPost Type | Notes |
|--------------|-------------|---------------|--------------|-------|
| `uri` | `string` | `id` | `string` | AT URI format -> opaque string. Adapter stores mapping internally if needed for API calls |
| `cid` | `string` | *(removed)* | — | AT Protocol Content ID. Adapter stores internally for like/repost operations |
| `author` | `PostAuthor` | `author` | `JKLBAuthor` | See Author mapping below |
| `text` | `string` | `text` | `string` | Same |
| `indexedAt` | `string` | `createdAt` | `string` | Rename only. Both ISO 8601 |
| `embed` | `PostEmbed` | `media` + `quotedPost` | `JKLBMedia \| null` + `JKLBPost \| null` | Embed splits into two fields. See Media mapping |
| `isLiked` | `boolean` | `isLiked` | `boolean` | Same |
| `isReposted` | `boolean` | `isBoosted` | `boolean` | Rename: "reposted" -> "boosted" |
| `likeUri` | `string?` | *(removed)* | — | AT URI of like record. Adapter stores internally |
| `repostUri` | `string?` | *(removed)* | — | AT URI of repost record. Adapter stores internally |
| `linkFacets` | `RichLinkFacet[]` | `linkFacets` | `JKLBLinkFacet[]` | Minor field differences. See Facets |
| *(missing)* | — | `mentionFacets` | `JKLBMentionFacet[]` | Currently not extracted as separate type |
| *(missing)* | — | `hashtagFacets` | `JKLBHashtagFacet[]` | Currently not extracted as separate type |
| `replyParent` | `{ uri, author }` | `replyParentId` | `string \| null` | Flatten to just the ID |
| `replyRoot` | `{ uri }` | *(removed)* | — | Not in spec. Adapter uses internally for reply threading |
| `repostReason` | `{ by, indexedAt }` | `repostBy` | `JKLBAuthor \| null` | Keep just the author |
| *(missing)* | — | `nativeUrl` | `string` | Adapter must generate this (escape hatch URL) |

## Author Type: Current -> JKLBAuthor

| Current Field | JKLBAuthor Field | Notes |
|--------------|-----------------|-------|
| `did` | `id` | Rename. Opaque string |
| `handle` | `handle` | Same |
| `displayName` | `displayName` | Same (make non-optional, default to handle) |
| `avatar` | `avatarUrl` | Rename |
| `banner` | `bannerUrl` | Rename |
| *(missing)* | `bio` | Adapter should populate from profile data |
| *(missing)* | `profileUrl` | Adapter generates: `https://bsky.app/profile/${handle}` |
| `isFollowing` | *(removed)* | Not on JKLBAuthor. Track separately in adapter state |
| `followUri` | *(removed)* | AT Protocol specific. Adapter internal |

## Embed Type: Current -> JKLBMedia + quotedPost

The current `PostEmbed` type has 5 variants. The spec has 3 media types + a separate `quotedPost` field.

| Current `embed.type` | Maps To | Notes |
|---------------------|---------|-------|
| `'images'` | `media: { type: 'images', images: JKLBImage[] }` | Direct map |
| `'video'` | `media: { type: 'video', video: JKLBVideo }` | Direct map |
| `'external'` | `media: { type: 'link-preview', preview: JKLBLinkPreview }` | Rename "external" -> "link-preview" |
| `'record'` | `quotedPost: JKLBPost` (media = null) | Quoted post is top-level, not inside embed |
| `'recordWithMedia'` | `media: JKLBMedia` + `quotedPost: JKLBPost` | Split into both fields |

## Image Type: Current -> JKLBImage

| Current | JKLBImage | Notes |
|---------|-----------|-------|
| `thumb` | `thumbnailUrl` | Rename |
| `fullsize` | `url` | Rename |
| `alt` | `alt` | Same |
| `aspectRatio` | `aspectRatio` | Current is `{ width, height }`, spec is `number` (width/height). Compute ratio |

## Video Type: Current -> JKLBVideo

| Current | JKLBVideo | Notes |
|---------|-----------|-------|
| `playlist` | `url` | HLS playlist URL |
| `thumbnail` | `thumbnailUrl` | Rename |
| `alt` | `alt` | Same |
| `aspectRatio` | `aspectRatio` | Same computation as images |

## Link Preview: Current -> JKLBLinkPreview

| Current (`PostExternal`) | JKLBLinkPreview | Notes |
|-------------------------|-----------------|-------|
| `uri` | `url` | Rename |
| `title` | `title` | Same |
| `description` | `description` | Same |
| `thumb` | `imageUrl` | Rename |

## Facets: Current -> JKLBLinkFacet / JKLBMentionFacet / JKLBHashtagFacet

Current `RichLinkFacet`:
```typescript
{ uri: string; text: string; byteStart: number; byteEnd: number }
```

Maps directly to `JKLBLinkFacet` (same fields, same names).

**New extractions needed:**
- `JKLBMentionFacet`: Currently mentions are handled in `embed-utils.ts` via AT Protocol facet type checking. Need to extract `{ userId, text, profileUrl, byteStart, byteEnd }` during transformation.
- `JKLBHashtagFacet`: Same — extract `{ tag, url, byteStart, byteEnd }` from AT Protocol facets.

## Internal Adapter State

The adapter needs to maintain internal state for fields removed from `JKLBPost` but needed for API calls:

```typescript
// BlueskyAdapter internal mapping
interface BlueskyPostMeta {
  uri: string;        // AT URI (needed for like/repost/reply API calls)
  cid: string;        // Content ID (needed for like/repost API calls)
  likeUri?: string;    // URI of existing like record (needed for unlike)
  repostUri?: string;  // URI of existing repost record (needed for unrepost)
  followUri?: string;  // URI of follow record (needed for unfollow)
  replyRoot?: string;  // Root URI (needed for reply API calls)
}

// Map from JKLBPost.id -> BlueskyPostMeta
private postMeta: Map<string, BlueskyPostMeta>
```

This is the key insight: the adapter transforms to `JKLBPost` for the UI, but keeps a private lookup table so it can make API calls when the UI says "like post X" — it looks up X's AT URI and CID from the map.

## Migration Strategy

1. Copy `JKLBPost` and related types from `specs/core/adapter.ts` into `src/adapters/types.ts` (or import directly)
2. Build transformation functions in the adapter that take raw AT Protocol responses and produce `JKLBPost`
3. Update `src/types/index.ts` to re-export `JKLBPost` as the canonical `Post` type (aliased for gradual migration)
4. Update consumers one file at a time: `post.uri` -> `post.id`, `post.indexedAt` -> `post.createdAt`, etc.
5. Remove `PostAuthor`, `PostEmbed`, `PostImage`, etc. once all consumers use `JKLBAuthor`, `JKLBMedia`, etc.
