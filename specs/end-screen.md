# Spec: End Screen

> **Status: IN PROGRESS.** Phase 71 in IMPLEMENTATION_PLAN.md.

---

## Vision

The End Screen is a **grid of buttons** that appears when the user finishes their feed (post budget exhausted or E key pressed). Each button is a self-contained action — it could be a simple hyperlink, a logout, or a gateway into a multi-step sub-flow with its own components.

This replaces the current fixed linear End flow (atmosphere → endCard → likedPostsGrid → share) with something extensible and modular.

---

## How It Works

1. **E key** (or post budget exhaustion) → immediately shows the **End Screen button grid**. No auto-atmosphere, no section card. Straight to the grid.
2. User picks a button. Each button does its thing:
   - Some are instant actions (log out, start another session)
   - Some open a sub-flow that takes over the screen (JKLB Award, Atmosphere Report)
   - Some are just hyperlinks (future: Standard Site trending, etc.)
3. Sub-flows render inside an `EndSubFlowWrapper` that provides a consistent "← back to end menu" button at the top. Escape also returns to grid.

---

## MVP Buttons

| Button | Title | Description (hover) | What It Does |
|--------|-------|---------------------|-------------|
| **JKLB Award Nomination** | JKLB Award Nomination | pick and share your favorite post | Opens liked posts grid → share favorite post (no session stats in the share) |
| **Stats** | Stats | see your session numbers | Simple panel: posts seen, likes, boosts, replies, links opened |
| **Atmosphere Report** | Atmosphere Report | scan the network around you | Opens the existing AtmosphereReport (PDS scanning of chorus members) |
| **Another Session** | Another Session | start fresh from the beginning | Resets to beginning — same state as fresh login |
| **Copy '?' posts** | Copy '?' posts | hotkey ? copies posts so you can ask an LLM about them | Instant action: copies saved posts to clipboard |
| **Another Session** | Another Session | start fresh from the beginning | Resets to beginning — same state as fresh login |
| **Log Out** | Log Out | end your session | Logs out, shows sunset page |

---

## Button Design

Each button is a card in a grid. Visual behavior:

- **Default state:** Shows the **title** (large, centered text)
- **Hover state:** Title fades out, **description** fades in (shorter than a profile bio — one line)
- **Hover card style:** Similar to the ProfileHover component used on chorus avatars — small floating card feel, but simpler. Just title ↔ description swap, no avatar or links.

Memphis styling: navy background, border, accent colors per button if desired.

---

## Architecture

### Directory Structure

```
src/
  components/
    end/                      ← NEW directory for all End screen stuff
      EndScreenGrid.tsx       ← The button grid layout
      EndButton.tsx           ← Reusable button component (title + hover description)
      EndSubFlowWrapper.tsx   ← Shared wrapper with "← back to end menu" for all sub-flows
      SessionStats.tsx        ← Stats panel
      JKLBAwardFlow.tsx       ← Wrapper that orchestrates liked posts → share
```

### Sub-Flow Pattern

Each button either performs an **instant action** or opens a **sub-flow**:

**Instant actions** (no sub-flow, stay on grid):
- Log Out — logs out, shows sunset
- Another Session — full reset, back to Beginning
- Copy '?' posts — copies to clipboard, shows toast

**Sub-flows** (replace grid with a component):
1. Button click sets `endFlowStage` (e.g., `'award-liked'`, `'atmosphere'`, `'stats'`)
2. The sub-flow component renders inside `EndSubFlowWrapper` (which provides "← back to end menu")
3. Escape or back button returns to the grid

### Data Available

The End screen has access to (passed from App.tsx):
- `sessionData` — metrics (postsViewed, likes, boosts, replies, linksOpened), likedPosts array
- `atmosphereRecords` — pre-fetched PDS records from chorus members
- `agent` — authenticated ATProto agent (for credible exit post)
- `logout()` — logout function
- `resetToBeginning()` — function to restart session

---

## Future Buttons (not MVP)

| Button | What It Does |
|--------|-------------|
| **Share a picture** | Camera capture → post to community account |
| **Message in a bottle** | Write ephemeral message stored in KV |
| **Standard Site trending** | Hyperlink to external trending page |
| *(community-built)* | Third-party plugins |

---

## Relationship to Current Code

### What Gets Refactored

The current `useEndFlow` hook manages a linear state machine: `atmosphere → endCard → likedPostsGrid → share`. This gets replaced:

- **`useEndFlow.ts`** — rewritten to manage grid → sub-flow → grid state instead of linear stages
- **`EndFlowStage` type** — changes from `'atmosphere' | 'endCard' | 'likedPostsGrid' | 'share'` to `'grid' | 'award' | 'stats' | 'atmosphere'`
- **`SectionCard` for "end"** — removed (no more transition card, straight to grid)
- **`LikedPostsGrid`** — moves into the award sub-flow
- **`CredibleExitPanel`** — moves into the award sub-flow
- **`AtmosphereReport`** — becomes a sub-flow triggered by button instead of auto-shown

### What Stays the Same

- `LikedPostsGrid` component internals — unchanged
- `AtmosphereReport` component internals — unchanged
- Session tracking / metrics — unchanged

### What Changes in the Share Flow

- `CredibleExitPanel` — the share post is now purely about the favorite post (the JKLB Award Nomination). Session stats (posts seen, likes, boosts, etc.) are **removed** from the share text. Stats have their own button now.
- `createCredibleExitPost` — updated to drop stats from the post body. The post is just the award nomination + quote embed of the favorite post.

---

*This spec reflects the design as of 2026-03-04.*
