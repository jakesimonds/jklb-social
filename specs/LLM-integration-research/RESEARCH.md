# LLM Feed Curation — Research Notes

## Concept

User provides freeform preferences in settings (e.g. "no politics, no Celtics spoilers, show me the big stories but skip the commentary"). We fetch ~500 posts from the algorithm, send text+author+ID to an LLM, get back an ordered list of IDs, and serve those as the curated feed.

## Current Architecture

### Feed Flow (web)
- `src/hooks/useFeed.ts` fetches from 3 tiers in parallel:
  1. **Chronological** — `agent.getTimeline()`
  2. **Chorus** — posts from recent interactors via notifications
  3. **Algorithmic** — `agent.app.bsky.feed.getFeed()` (Discover/What's Hot/For You)
- Posts are deduplicated by URI, replies filtered out, self-reply threads collapsed
- Posts wrapped as `PostFeedItem` with `{ type, uri, indexedAt, post }`

### Post Data Structure (`src/types/index.ts`)
Key fields for LLM curation:
- `uri` — unique AT URI, usable as post ID
- `text` — post content
- `author.handle` — e.g. `jake.bsky.social`
- `author.displayName` — human-readable name
- `embed` — images/video/links/quotes (LLM can't see images, but can see link card titles and quoted post text)

### Existing Backend Pattern (`functions/api/community-post.ts`)
- Cloudflare Pages Functions, auto-routed by file path
- `export const onRequest: PagesFunction<Env>` handler
- Raw `fetch()` calls (no SDKs), CORS headers, JSON responses
- Secrets accessed via `context.env.SECRET_NAME`
- KV bindings declared in `wrangler.toml`

### Settings
- Web: `src/components/SettingsPanel.tsx` — text size, music, tutorial toggles
- Mobile: `mobile/app/settings.tsx` — post budget slider, feed picker, undo modal
- No existing "preferences" or freeform text field yet

### Auth
- OAuth via `@atproto/oauth-client-browser`
- User DID and handle available from session in `useAuth()` context

## Technical Decisions

### LLM Call: Raw fetch to Anthropic API
- Matches existing pattern (no SDKs in functions/)
- `POST https://api.anthropic.com/v1/messages`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`

### Model: Claude Haiku 4.5
- 200K context window (50K input is fine)
- $0.80/M input, $4.00/M output
- ~$0.05 per curation call
- Fast enough for a "takes a minute" MVP

### Execution Time: No problem
- Cloudflare Workers have no wall-clock limit for HTTP-triggered functions
- CPU time is minimal (<100ms) — the wait is all on the Anthropic API fetch
- 30-60 second LLM calls work fine on paid plan

### Secrets
- `ANTHROPIC_API_KEY` stored via Wrangler CLI or Cloudflare dashboard
- `.dev.vars` for local dev (already gitignored)
- Add to `Env` interface in the function

### Whitelist
- Hardcoded array of DIDs (or handles) in the function, or stored in KV
- Check user's DID against whitelist before making LLM call
- Non-whitelisted users get normal feed behavior (no curation)

### User Preferences
- Freeform text box in settings panel
- Stored in localStorage
- Sent to backend with each curation request

## Data Flow (MVP)

```
1. User logs in, preferences loaded from localStorage
2. Feed hook fetches ~500 posts from algorithm (existing flow, just increase limit)
3. Client builds slim payload:
   posts.map(p => ({ id: p.uri, text: p.text, author: p.author.handle }))
4. Client POSTs to /api/curate with { posts, preference, userDid }
5. Worker checks whitelist, builds prompt, calls Anthropic API
6. LLM returns ordered array of post IDs (subset of input)
7. Worker returns { postIds: string[] }
8. Client reconstructs full posts from saved data, in LLM's order
9. First 10 posts shown from raw algorithm while waiting
10. On response, swap to curated feed starting at post 11
```

## Prompt Strategy (initial)

```
You are a social media feed curator. The user has these preferences:
"{user_preference}"

Below are posts from their feed. Each has an ID, author, and text.
Select and order the posts the user would most want to see based on their preferences.
Return ONLY a JSON array of post IDs in your recommended order.
Exclude posts that conflict with the user's preferences.
If preferences mention deduplication (e.g. "just show the main announcement"),
pick the best single post for that topic.

Posts:
[{id, author, text}, ...]
```

## Open Questions for Later (not MVP)
- Batch/chunk if post count grows past 500
- Cache curated results for some TTL to avoid re-calling on navigation
- Structured preference presets vs. freeform only
- Whether to include embed metadata (link card titles, quoted post text) for better filtering
- Mobile support (mobile feed hook is separate and simpler)
