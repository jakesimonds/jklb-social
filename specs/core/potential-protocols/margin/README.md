# Margin Protocol Integration Spec

## What is Margin?

Margin (margin.at) is a **web annotation platform** built on AT Protocol. It lets users "write in the margins of the internet" — annotating, highlighting, bookmarking, and commenting on any URL on the web. Think of it as a decentralized Hypothesis/Medium-style annotation layer.

**Created by**: @scanash.com
**Bluesky handle**: @margin.at (DID: `did:plc:rjqn3agdb74cszhqcpii4sne`)
**Source code**: https://tangled.org/margin.at/margin (Tangled repo)

### Architecture

Margin runs as a full-stack application:
- **Frontend**: Astro 5 (SSR) + React 19 + Tailwind CSS (port 8080)
- **Backend**: Go API server with Chi router + SQLite (port 8081)
- **Browser Extension**: Built with WXT framework for in-page annotation
- **Avatar Worker**: Cloudflare Worker for avatar proxying

### Content Types

Margin is NOT a microblogging platform. Its content model is fundamentally different from Bluesky:

- **Annotations**: Comments attached to specific URLs, with W3C Web Annotation Data Model selectors (text quotes, CSS selectors, XPath, fragments)
- **Highlights**: Lightweight marks on web content (annotation without body text)
- **Bookmarks**: Saved URLs with optional tags and descriptions
- **Collections**: Named folders for organizing annotations (like notebooks)
- **Replies**: Threaded replies to annotations
- **Likes**: Social interaction on annotations/replies

## AT Protocol Compatibility

### The Good News

Margin is built on standard AT Protocol. It uses:
- Standard DID system (`did:plc:` via PLC directory)
- Standard PDS infrastructure (users store Margin records in their existing ATProto PDS)
- Standard `com.atproto.repo.listRecords` / `getRecord` for data access
- TID-keyed records (standard ATProto record keys)
- Self-labels via `com.atproto.label.defs#selfLabels`

### Data Storage

Margin records live in the user's PDS under `at.margin.*` collections. This means:
- **No separate server needed to read data** — it's in the same PDS as Bluesky data
- Records are accessible via `com.atproto.repo.listRecords` (same as JKLB's existing PDS query code in `src/lib/pds.ts`)
- Records appear on the ATProto firehose/relay (they're standard repo commits)
- JKLB's `discoverCollections()` would already detect `at.margin.*` collections

### Authentication

**Auth is already solved.** Since Margin writes to the user's standard ATProto PDS:
- The existing ATProto OAuth session works
- Same DID, same PDS, same tokens
- No additional auth flow needed for reading
- Writing Margin records requires the same `transition:generic` scope JKLB already requests
- No Margin-specific API keys needed for PDS access

### What Margin's Go Backend Does

Margin's Go backend is an **indexer/aggregator**, not a PDS. It:
- Watches the firehose for `at.margin.*` records
- Indexes annotations by URL (so you can see all annotations on a given page)
- Provides aggregated views (feed of recent annotations, per-URL annotation threads)
- Serves the Astro SSR frontend

For JKLB, we would NOT need to talk to Margin's backend server. We can read directly from user PDSes.

## Margin Lexicons (Complete Reference)

All lexicons use the `at.margin.*` namespace. Registered under DID `did:plc:rjqn3agdb74cszhqcpii4sne`.

### at.margin.annotation (core record type)

W3C Web Annotation Data Model implementation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target.source` | string (URI) | Yes | URL being annotated |
| `target.selector` | union | No | W3C selector (TextQuote, TextPosition, CSS, XPath, Fragment, Range) |
| `target.title` | string | No | Page title at annotation time |
| `target.sourceHash` | string | No | SHA256 hash of normalized URL |
| `target.state` | object | No | TimeState (cached URL, source date) |
| `body.value` | string | No | Annotation text (max 10,000 chars / 3,000 graphemes) |
| `body.format` | string | No | MIME type (default: "text/plain") |
| `body.language` | string | No | BCP47 language tag |
| `body.uri` | string | No | External body reference |
| `tags` | string[] | No | Up to 10 categorization tags |
| `motivation` | string | No | W3C motivation: commenting, highlighting, bookmarking, tagging, describing, linking, replying, editing, questioning, assessing |
| `labels` | ref | No | com.atproto.label.defs#selfLabels |
| `rights` | string (URI) | No | License URI |
| `generator` | object | No | Client info (id, name, homepage) |
| `createdAt` | datetime | Yes | Creation timestamp |

### at.margin.bookmark

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string (URI) | Yes | Bookmarked URL |
| `title` | string | No | Page title (max 500 chars) |
| `description` | string | No | Note (max 1,000 chars / 300 graphemes) |
| `tags` | string[] | No | Up to 10 tags |
| `sourceHash` | string | No | SHA256 of normalized URL |
| `labels` | ref | No | Self-labels |
| `rights` | string (URI) | No | License URI |
| `generator` | object | No | Client info |
| `createdAt` | datetime | Yes | Creation timestamp |

### at.margin.highlight

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | ref | Yes | References at.margin.annotation#target |
| `color` | string | No | Hex or named color (max 20 chars) |
| `tags` | string[] | No | Up to 10 tags |
| `labels` | ref | No | Self-labels |
| `rights` | string (URI) | No | License URI |
| `generator` | object | No | Client info |
| `createdAt` | datetime | Yes | Creation timestamp |

### at.margin.reply

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `root` | ReplyRef | Yes | Root annotation (uri + cid) |
| `parent` | ReplyRef | Yes | Parent annotation or reply (uri + cid) |
| `text` | string | Yes | Reply text (max 10,000 chars / 3,000 graphemes) |
| `format` | string | No | MIME type (default: "text/plain") |
| `createdAt` | datetime | Yes | Creation timestamp |

### at.margin.like

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | ref | Yes | Annotation or reply being liked (uri + cid) |
| `createdAt` | datetime | Yes | Creation timestamp |

### at.margin.collection

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Collection name (max 100 chars / 50 graphemes) |
| `icon` | string | No | Emoji or icon identifier (max 100 chars) |
| `description` | string | No | Description (max 500 chars / 150 graphemes) |
| `createdAt` | datetime | Yes | Creation timestamp |

### at.margin.collectionItem

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collection` | string (AT-URI) | Yes | Collection reference |
| `annotation` | string (AT-URI) | Yes | Annotation/highlight/bookmark reference |
| `position` | integer | No | Sort order (min 0) |
| `createdAt` | datetime | Yes | Creation timestamp |

### at.margin.profile

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bio` | string | No | Biography (max 5,000 chars) |
| `displayName` | string | No | Display name (max 640 chars) |
| `website` | string | No | Website URL (max 1,000 chars) |
| `avatar` | blob | No | Avatar image (PNG/JPEG, max 1MB) |
| `links` | string[] | No | Up to 20 links |
| `createdAt` | datetime | Yes | Creation timestamp |

## What JKLB Margin Integration Would Look Like

### This Is NOT a New Protocol

The critical insight: **Margin is just another ATProto app writing to the same PDS.** JKLB already has all the infrastructure needed:

1. `src/lib/pds.ts` already queries user PDSes for non-Bluesky collections
2. `discoverCollections()` already finds `at.margin.*` records
3. `filterInterestingCollections()` already passes them through (they're not `app.bsky.*`)
4. `fetchRecentRecords()` already fetches them
5. The Atmosphere Report already surfaces this data

### What Would Need to Change

#### Phase 1: Display Margin Records in Atmosphere Report (Minimal)

JKLB's Atmosphere Report already shows non-Bluesky PDS records from chorus members. Margin records would show up automatically. The only work is:

- Add human-readable rendering for `at.margin.annotation`, `at.margin.bookmark`, and `at.margin.highlight` record types
- Show the target URL, annotation text, and any tags
- Currently these show as raw JSON in the Atmosphere Report — give them proper card rendering

**Estimated scope**: Small. A rendering component and a type guard.

#### Phase 2: "Annotations" Tab/View (Medium)

A dedicated view showing Margin annotations from the user and their chorus:

- Fetch `at.margin.annotation` and `at.margin.bookmark` collections from chorus member PDSes
- Display as a feed of annotated URLs with commentary
- Group by URL when multiple people annotate the same page
- Allow clicking through to the annotated URL

**New code needed**:
- `src/lib/margin.ts` — Margin-specific record type definitions and fetch helpers
- A rendering component for annotation cards (URL + text + selector context)
- Feed integration (new FeedItem type or extend PDSFeedItem rendering)

**Estimated scope**: Medium. Mostly UI work — the data fetching infrastructure exists.

#### Phase 3: Create Annotations from JKLB (Larger)

Allow users to annotate URLs directly from JKLB:

- When viewing a post with a link, offer "Annotate this link"
- Write `at.margin.annotation` records to the user's PDS via `com.atproto.repo.createRecord`
- Support basic text annotations (skip W3C selectors — those need the browser extension)
- Support bookmarking URLs

**New code needed**:
- Composer mode for annotations (URL + text input)
- `com.atproto.repo.createRecord` calls with `at.margin.annotation` collection
- Integration with post link detection

**Estimated scope**: Medium-large. Needs new composer UI and write path.

#### Phase 4: Margin Likes and Replies (Optional)

- Like annotations from within JKLB
- Reply to annotations
- These use the same write patterns as Phase 3

### What Does NOT Need to Change

- **Authentication**: Existing ATProto OAuth works as-is
- **Session management**: Same DID, same PDS, same Agent
- **PDS resolution**: Same `getPdsUrl()` and `discoverCollections()` flow
- **Record fetching**: Same `com.atproto.repo.listRecords` calls
- **Core feed infrastructure**: Posts stay posts; Margin data is supplementary

## Feasibility Assessment

### Difficulty: Low to Medium

This is **by far the easiest** of the three potential protocols (Margin, GitHub, Strava):

- **No new auth flow** — uses existing ATProto OAuth
- **No new API client** — uses existing PDS query code
- **No API keys or rate limits** — it's just PDS reads
- **No new protocol** — it IS ATProto
- **Data already discoverable** — `discoverCollections()` finds it today
- **Records already fetched** — Atmosphere Report pulls them already

### Gotchas and Considerations

1. **Content model mismatch**: Margin annotations are URL-centric, not microblogging. They don't fit neatly into a "post" paradigm. JKLB needs a distinct rendering path, not just "show it in the feed."

2. **Margin's backend provides aggregation JKLB can't**: Margin's Go server indexes by URL — "show me all annotations on this URL." JKLB can only do per-user queries via PDS. To see "what has everyone annotated on nytimes.com/article-x" you'd need to hit Margin's API at `margin.at`, which is a separate service dependency.

3. **W3C Selectors are complex**: The full annotation model supports TextQuoteSelector, CssSelector, XPath, etc. For JKLB, ignore selectors initially — just show "User X annotated [URL] with [text]."

4. **Adoption is small**: Margin has ~537 followers on Bluesky. The user's chorus members may not be using it, meaning the Atmosphere Report would be empty. This is fine — it's additive, not required.

5. **Browser extension overlap**: Margin's primary UX is a browser extension that lets you annotate while browsing. JKLB's value-add is surfacing annotations in a feed context and enabling annotation from a keyboard-first client — complementary, not competitive.

6. **No feed generator**: Unlike Bluesky, Margin doesn't have feed generators. There's no "Margin feed" you can subscribe to via `app.bsky.feed.getFeed`. You discover Margin content by querying individual PDSes.

### Recommended Approach

Start with Phase 1 (render Margin records nicely in Atmosphere Report). This is almost zero new code — it's adding a case to the existing PDS record renderer. If chorus members start using Margin, expand to Phase 2.

## Key Files in JKLB Codebase

| File | Relevance |
|------|-----------|
| `src/lib/pds.ts` | PDS query infrastructure — already fetches non-Bluesky records |
| `src/lib/feed.ts` | Feed management — PDSFeedItem type already exists |
| `src/lib/auth.ts` | ATProto OAuth — works for Margin with zero changes |
| `src/hooks/useAtmosphereReport.ts` | Atmosphere Report hook — where Margin records already surface |
| `src/types/index.ts` | Type definitions — may need Margin-specific types |

## References

- Margin website: https://margin.at
- Margin source code: https://tangled.org/margin.at/margin
- Margin Bluesky profile: https://bsky.app/profile/margin.at
- Lexicon definitions: https://lexicon.garden/lexicon/did:plc:rjqn3agdb74cszhqcpii4sne/at.margin.annotation
- W3C Web Annotation Data Model: https://www.w3.org/TR/annotation-model/
- ATProto Lexicon docs: https://atproto.com/guides/lexicon
