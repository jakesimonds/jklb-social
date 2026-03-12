# 00 — Executive Summary

## Current State

The Bluesky reference implementation works great as a product but is tightly coupled to AT Protocol internals. The `@atproto/api` package is imported in **20+ files** across hooks, components, and lib code. The core `Post` type uses AT Protocol field names (`uri`, `cid`, `did`, `indexedAt`) rather than the universal `JKLBPost` format. There is no adapter layer — network calls are made directly from React hooks and even some components.

## What's Good (Don't Touch)

These things already match the spec and should be preserved as-is:

- **Keybinding system** — centralized in `useKeybindings.ts`, reads ViewState, no component-level handlers
- **ViewState model** — `{ stage, panel }` structure matches spec section 12 exactly
- **Panel stack behavior** — J/K pops panel then navigates, action keys close panel without executing
- **Stage types** — all spec-defined types present
- **Beginning flow logic** — dynamic stage sequence, empty categories skipped, chorus progressive fill
- **End flow grid** — pluggable button system, required buttons present
- **Tutorial system** — extensible registry, on by default, togglable
- **Settings/storage boundary** — auth session separate from UI settings
- **Fullscreen media** — arrow key navigation, escape to close
- **Layout** — two-zone grid, responsive degradation, single viewport

## What Needs to Change

### Layer 1: Data Types (Foundation)
The `Post` type in `src/types/index.ts` uses AT Protocol field names. Every downstream consumer depends on these names. This is the single biggest change — rename/restructure to match `JKLBPost`.

### Layer 2: Adapter Class (New Code)
Create `src/adapters/bluesky/` with a `BlueskyAdapter` class implementing the `NetworkAdapter` interface from `specs/core/adapter.ts`. This class wraps all `@atproto/api` usage.

### Layer 3: Import Boundary (Migration)
Move all `@atproto/api` imports out of hooks, components, and generic lib files into the adapter. Currently **20+ files** import directly from `@atproto/api`.

### Layer 4: UI Cleanup (Polish)
Remove hardcoded `bsky.app` URLs, rename `onViewOnBluesky` to generic names, make character limits adapter-driven.

## Success Criteria

1. `grep -r "@atproto/api" src/` returns ONLY files under `src/adapters/bluesky/`
2. `grep -r "bsky.app" src/` returns ONLY files under `src/adapters/bluesky/`
3. No file outside `src/adapters/` imports anything from `@atproto/`
4. The app builds, deploys, and works identically to before
5. All `JKLBPost` objects produced by the adapter pass the `validateJKLBPost()` function from the spec

## Estimated Scope

- ~15 files need significant changes (type rewiring)
- ~10 files need minor changes (import moves, renames)
- ~5 new files created (adapter class, type re-exports, helpers)
- 0 files deleted (everything moves, nothing disappears)

## Risk

The biggest risk is **breaking the Beginning flow**. It has the most complex data transformation (notifications -> categorized stages -> chorus members) and the tightest coupling to AT Protocol notification types. Test this flow thoroughly after each change.
