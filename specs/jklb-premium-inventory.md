# JKLB Premium — Full Inventory & Status

**Date:** 2026-03-09
**Status:** Shelved. Premium whitelist emptied. All code remains in codebase but is inert (no users qualify as premium).

---

## What Is JKLB Premium?

A whitelisted user tier that gates access to an LLM-curated feed experience. Premium users get:

1. **Curator Card** in the Beginning flow — "What do you want to see?" prompt + post count slider
2. **Ghost Middle** — browse the normal feed while the curator works in the background
3. **Curator Indicator** — pulsing pink dot (working) / green checkmark (ready) in bottom-left corner
4. **Real Middle** — click the checkmark to swap the feed with curated posts + progress bar

Non-premium users see zero changes. The gate is a simple handle whitelist in `src/lib/flags.ts`.

---

## How Premium Users Are Identified

```
src/lib/flags.ts
  const JKLB_PREMIUM_HANDLES: string[] = [];  // was ['jakesimonds.com']
  export function isJklbPremium(handle): boolean

src/hooks/usePremium.ts
  export function usePremium(): { isPremium: boolean }
  Reads profile.handle from AuthContext, checks against whitelist
```

---

## Frontend Files (React)

### Components
| File | Purpose | Premium-only? |
|------|---------|---------------|
| `src/components/beginning/CuratorCard.tsx` | Prompt textarea + post count slider in Beginning flow | Yes, entirely |
| `src/components/CuratorIndicator.tsx` | Pulsing status dot + ready checkmark button | Yes, entirely |

### Context & State
| File | Purpose | Premium-only? |
|------|---------|---------------|
| `src/lib/CuratorContext.tsx` | Global curator state (status, URIs, prompt, count) | Yes, entirely |
| `src/lib/curator-test-fixtures.ts` | 50 real post URIs for faking curator output | Yes, entirely |
| `src/lib/flags.ts` | Premium whitelist + `isJklbPremium()` | Mixed — also has UI_TESTING_MODE, etc. |

### Hooks
| File | Purpose | Premium-only? |
|------|---------|---------------|
| `src/hooks/usePremium.ts` | React hook wrapping `isJklbPremium()` | Yes, entirely |
| `src/hooks/useBeginning.ts` | Beginning flow stages — adds 'curator' stage if premium | Mixed |

### App-Level Integration
| File | What's premium-related |
|------|----------------------|
| `src/App.tsx` | Ghost Middle logic (prevents end-transition while curating), Real Middle logic (fetch curated posts, swap feed) |
| `src/main.tsx` | `<CuratorProvider>` wrapping the app |
| `src/components/AppLayout.tsx` | Renders `<CuratorIndicator />` for premium users |
| `src/components/beginning/BeginningView.tsx` | Routes `stage === 'curator'` to `<CuratorCard />` |
| `src/components/SettingsPanel.tsx` | Premium feed settings section (textarea + post count stepper) |

### localStorage Keys
- `jklb-feed-preference` — user's curation prompt text
- `jklb-curator-count` — requested post count (1-50)

---

## Curator Backend Server (`curator/`)

A separate Express server (port 3847) that fetches Bluesky posts and shells out to `claude -p` for curation. **Not connected to the frontend yet** — the frontend uses a fake 8-second delay with test fixtures.

| File | Purpose |
|------|---------|
| `curator/server/index.ts` | Express server, POST /curate + GET /log/:logId |
| `curator/server/feeds.ts` | Fetches 150-post candidate pool from user's follows (unauthenticated) |
| `curator/server/agent.ts` | Shells out to `claude -p`, constructs prompt, parses response |
| `curator/server/types.ts` | TypeScript types (CurationRequest, CandidatePost, etc.) |
| `curator/web/index.html` | Test frontend (vanilla HTML/JS) |
| `curator/package.json` | Dependencies: @atproto/api, express |
| `curator/tsconfig.json` | TypeScript config |
| `curator/IMPLEMENTATION_PLAN.md` | Task breakdown for server (TASK-CUR-1 through CUR-6) |

---

## Planning Documents

| File | What's there |
|------|-------------|
| `IMPLEMENTATION_PLAN.md` | TASK-PREMIUM-1/2/3 (done), TASK-CURFE-1 through CURFE-5 (done) |
| `IMPLEMENTATION_FUTURE.md` | TASK-CURFE-6: Wire frontend to real curator server |
| `specs/LLM-integration-research/IMPLEMENTATION_PLAN.md` | Phase 1 (Premium frontend) + Phase 2 (Cloudflare Function backend) — unstarted |
| `specs/LLM-integration-research/RESEARCH.md` | Research notes on LLM integration approaches |

---

## Git History (CURFE commits, newest first)

| Commit | Task | Summary |
|--------|------|---------|
| 04635a2 | CURFE-5 | Real Middle — curated posts with progress bar |
| b5dea38 | CURFE-4 | CuratorIndicator component |
| 1d6207c | CURFE-3 | Ghost Middle — browse while curator works |
| 896013a | CURFE-2 | Curator Card in Beginning flow |
| 4a21b2f | CURFE-1 | CuratorContext with test fixtures |

---

## What's NOT Built Yet

1. **Cloudflare Pages Function** (`functions/api/curate.ts`) — planned but doesn't exist
2. **Real frontend-to-server wiring** — CuratorContext still fakes it with setTimeout
3. **Mobile integration** — no premium/curator code in `mobile/` at all

---

## If You Want to Remove It All Later

**Files to delete entirely:**
- `src/components/beginning/CuratorCard.tsx`
- `src/components/CuratorIndicator.tsx`
- `src/lib/CuratorContext.tsx`
- `src/lib/curator-test-fixtures.ts`
- `src/hooks/usePremium.ts`
- `curator/` (entire directory)

**Files to edit (remove premium branches):**
- `src/lib/flags.ts` — remove `JKLB_PREMIUM_HANDLES` + `isJklbPremium()`
- `src/App.tsx` — remove Ghost/Real Middle logic
- `src/main.tsx` — remove `<CuratorProvider>`
- `src/components/AppLayout.tsx` — remove `<CuratorIndicator />`
- `src/components/beginning/BeginningView.tsx` — remove curator stage routing
- `src/hooks/useBeginning.ts` — remove curator stage injection
- `src/components/SettingsPanel.tsx` — remove premium feed settings section
