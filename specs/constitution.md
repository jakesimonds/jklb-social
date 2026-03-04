# Constitution: russAbbot Design Principles

This document defines the governing principles for russAbbot. All implementation decisions must align with these principles.

## Core Identity

**russAbbot** is a keyboard-driven, single-viewport ATProtocol client designed as a curated, once-a-day social media experience. Named after Russ Abbot, artist of "Atmosphere." (ATmosphere is name for broader ecosystem of apps built on ATProto)

The app has three acts — **Beginning, Middle, End** — that guide the user through a structured session: see what happened while you were away, browse your feed, then reflect and share before logging off.

## Non-Negotiable Principles

### 1. Single Viewport, No Scrolling
Everything fits on one screen. The stage does not scroll. Content is displayed in a fixed layout. This is the app's strongest opinion.

**Exception**: Settings panel content may scroll internally if absolutely necessary (very narrow viewport degradation).

### 2. Keyboard-First
All primary actions are accessible via single-key hotkeys. Mouse/touch clicking works as a fallback, but keyboard is the intended interaction mode.

### 3. Three Acts: Beginning, Middle, End
The session has structure. Beginning shows notifications (likes, boosts, followers, quotes, replies). Middle is feed browsing with a configured algorithm and post count. End is reflection — reviewing liked posts, picking a favorite, and sharing a session summary. The user presses E to end when they're ready.

### 4. Full ATProtocol Compliance
The app works with ANY ATProtocol PDS, not just bsky.social. Users authenticate via handle-based OAuth discovery.

### 5. Pure Client Architecture
No backend server. The app is a static web client that communicates directly with ATProtocol APIs. All persistence is localStorage (MVP) or user's PDS (future).

### 6. Memphis Aesthetic
Bold 90s design: hot pink (#e91e63), cyan (#00bcd4), yellow (#ffeb3b) on dark navy (#1a1a2e). This is the signature look, not negotiable for MVP.

### 7. Simplicity Over Cleverness
Code must be readable by humans. If a solution requires refs, flags, and complex state tracking, it's wrong. Prefer straightforward approaches. No over-engineering.

### 8. Media-First Display
Images and video are the priority. Text provides context. The layout dedicates prominent space to media.

## Implementation Mindset

- **Study, don't just read** - Understand code deeply before modifying
- **Don't assume not implemented** - Search the codebase first; it may already exist
- **Capture the why** - Comments and commit messages explain intent, not mechanics
- **Keep docs up to date** - Specs, plans, and READMEs must reflect current reality
- **If functionality is missing, add it** - No gaps or TODOs for "later"
- **Resolve blockers or document them** - Fix issues or clearly explain why they're blocked

## Quality Standards

### Code Quality
- TypeScript strict mode
- All components typed
- No `any` types except when interfacing with external APIs
- Linter must pass (ESLint)
- Build must succeed with zero warnings

### Testing
- Core utilities should have unit tests
- Integration tests for auth flow
- Manual testing checklist for UI features

### Accessibility
- Keyboard navigation must work without mouse
- Focus states must be visible
- Sufficient color contrast for text

## What This App Is NOT

- NOT a mobile app (desktop-first, responsive but not mobile-optimized)
- NOT a full-featured client (no search, limited DM support)
- NOT trying to replicate bsky.app (different philosophy - mindful consumption)
- NOT a backend service (pure client)

Reply and Quote are supported. New posts are created on Bluesky directly. DMs redirect to bsky.app.

## Architecture Reference

The two UI zones (Chorus + Stage), ViewState model, and all component specs are defined in `app-architecture.md`. This constitution defines principles; architecture defines structure.

## Future Vision (Post-MVP)

- ATProtocol lexicon for journal entries
- Publish session stats/journals to user's PDS
- Standalone journal browser app for shared entries
- Multi-protocol support (Mastodon, Farcaster)
- ATProtocol quasi-browser, that shows events on other apps/lexicons with a link to see activity in native app
