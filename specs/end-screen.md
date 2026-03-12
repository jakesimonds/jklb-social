# Spec: End Screen

> **Updated: March 11, 2026.** Reflects the current 9-button grid, trophy system, and Slab wrapper pattern.

---

## Vision

The End Screen is a **3x3 grid of buttons** that appears when the user finishes their feed (post budget exhausted or E key pressed). Each button is a self-contained action — it could be a simple hyperlink, a logout, or a gateway into a multi-step sub-flow with its own components.

Everything in the End flow renders inside a **Slab** — the same wrapper used for Settings, Hotkeys, Composers, etc. The Slab provides the Memphis-styled border, solid background, optional title header, X close button, and Escape/Delete key handling.

---

## How It Works

1. **E key** (or post budget exhaustion) opens a **Slab** containing the **End Screen button grid**. No auto-atmosphere, no section card. Straight to the grid.
2. User picks a button. Each button does its thing:
   - Some are instant actions (log out, start another session, copy clipboard)
   - Some open a sub-flow that takes over the Slab content (Trophy Case, Atmosphere Report, etc.)
   - Some are external links (plyr.fm)
3. Sub-flows should render inside an `EndSubFlowWrapper` that provides a consistent "back to end menu" button at the top. Escape also returns to grid. The Slab's own X button exits the End flow entirely.

---

## The 9 Buttons (3x3 Grid)

The grid is built by `getEndButtons()` in `EndScreenGrid.tsx`. The first 7 buttons are static; the last 2 are dynamic based on trophy state.

| # | Button ID | Title | Description | Type |
|---|-----------|-------|-------------|------|
| 1 | `stats` | Stats | see your session numbers | Sub-flow |
| 2 | `atmosphere` | Atmosphere Report | scan the network around you | Sub-flow |
| 3 | `clipboard` | Copy '?' posts | hotkey ? copies posts so you can ask an LLM about them | Instant |
| 4 | `another` | Another Session | start fresh from the beginning | Instant |
| 5 | `logout` | Log Out | end your session | Instant |
| 6 | `glitch` | Glitch a JPEG | edit HEX values, make art | Sub-flow |
| 7 | `plyr` | Check out plyr.fm | listen to your plyr.fm likes while you scroll JKLB | External link |
| 8 | `active-award` | *(dynamic, see below)* | *(dynamic)* | Sub-flow |
| 9 | `trophy-case` | Trophy Case | *(dynamic)* | Sub-flow |

### Dynamic Buttons (8 and 9)

**Button 8 — Active Award:** Changes based on whether the user has a participation trophy.
- **No participation trophy:** "Receive an award: claim your participation trophy" — opens the `ParticipationClaim` flow
- **Has participation trophy:** "Give an award: nominate the Best Thing I Saw" — opens the `award-nominate` flow (liked posts grid then share composer)

**Button 9 — Trophy Case:** Changes based on whether the user has any trophies.
- **No trophies:** Disabled, greyed out — "earn awards and they'll appear here"
- **Has trophies:** Active — "view your trophies and give awards" — opens the `TrophyCase` sub-flow

---

## Button Design

Each button is an `EndButton` component in a grid. Visual behavior:

- **Default state:** Shows the **title** (large, centered text)
- **Hover state:** Title fades out, **description** fades in (one line)
- **Keyboard highlight:** Yellow border, same visual treatment as hover
- **Disabled state:** Greyed out, not clickable

Memphis styling: navy background, border, accent colors per button if desired.

### Keyboard Navigation

Arrow keys (or h/j/k/l vim keys) move the highlight through the 3x3 grid. Enter or Space activates the highlighted button. Escape exits the End flow entirely (via Slab).

---

## Architecture

### Directory Structure

```
src/
  components/
    Slab.tsx                    ← Generic wrapper: border, header, X button, Esc handler
    end/
      EndScreenGrid.tsx         ← The 3x3 button grid + getEndButtons() config
      EndButton.tsx             ← Reusable button component (title/description swap)
      EndSubFlowWrapper.tsx     ← "← back to end menu" button wrapper for sub-flows
      SessionStats.tsx          ← Stats panel (posts seen, likes, boosts, etc.)
      ParticipationClaim.tsx    ← Claim flow: confirm → PDS write → share
      TrophyCase.tsx            ← 3x3 trophy grid (earned + locked levels)
  hooks/
    useEndFlow.ts               ← State machine: grid ↔ sub-flows
```

### The Slab Wrapper

ALL End screens render inside a `Slab`. The Slab provides:

- Memphis-pink border and shadow
- Optional title header
- X close button (top-right) that exits the End flow entirely
- Escape/Delete key handling to close

The Slab wraps the entire End flow — the grid and all sub-flows live inside it.

### The EndSubFlowWrapper Pattern

When a button opens a sub-flow, the sub-flow component should render inside `EndSubFlowWrapper`. This provides:

- A visible "back to end menu" button (top-left, small text)
- An `onBack` callback that returns to the grid

The wrapper is purely a layout/navigation concern — it just adds the back button and wraps children in a flex column.

### State Machine (`useEndFlow`)

The `useEndFlow` hook manages a flat state machine with these stages:

```
EndFlowStage = 'grid'
             | 'stats'
             | 'atmosphere'
             | 'participation-claim'
             | 'participation-share'
             | 'award-nominate'
             | 'award-liked'
             | 'award-share'
             | 'trophy-case'
```

Key functions:
- `enter()` — activates the End flow, shows grid with highlight at index 0
- `openSubFlow(id)` — maps button IDs to stages
- `returnToGrid()` — returns to grid from any sub-flow
- `advanceAward()` / `goBackAward()` — navigate within the award sub-flow (liked → share)
- `selectPost()` — track selected liked post for the award nomination
- `setHighlightedIndex()` — keyboard navigation on grid

Instant actions (`another`, `logout`, `clipboard`) are NOT stages — they are handled directly by App.tsx and don't change the End flow state.

---

## Trophy System

### Awards Model

Awards are a leveled progression system:

- **Level 1 — Participation Trophy:** Claim to join the community
- **Level 2 — Best Thing I Saw:** Nominate a favorite post from your session
- **Levels 3-9:** Future awards (locked placeholders in Trophy Case)

### Participation Trophy Claim Flow

`ParticipationClaim.tsx` handles the claim with a two-write hybrid storage pattern:

1. **KV write:** `POST /api/participation` with `{ did, handle }` — returns `{ number, claimedAt }` (sequential community member number)
2. **PDS write:** `putRecord` to the user's PDS at `social.jklb.participationTrophy/self` with the number and timestamp

KV is the source of truth for ordering (who is member #N). The PDS record is the user's portable proof of participation — it travels with their identity across hosts.

### Best Thing I Saw Nomination Flow

Multi-step: liked posts grid → select a post → share composer (AwardNominationPanel). Uses `advanceAward()` and `goBackAward()` for internal navigation.

### Trophy Case

`TrophyCase.tsx` renders a nested 3x3 grid inside `EndSubFlowWrapper`:

- Level 1 (if earned): "Participation Trophy" — links to `pdsls.dev` to view the record
- Level 2 (if earned): "Best Thing I Saw (given)" — lets user give another nomination
- Levels 3-9: Locked placeholders showing "reach level N to unlock"

The Trophy Case has its own keyboard navigation (separate from the End grid).

---

## Navigation: Three Ways Back

The End flow has a layered dismissal model:

| Mechanism | What it does | Provided by |
|-----------|-------------|-------------|
| **"back to end menu" button** | Returns from sub-flow to grid | `EndSubFlowWrapper` |
| **Escape key** | Returns from sub-flow to grid, OR exits End flow from grid | Sub-flow components + `Slab` |
| **Slab X button** | Exits the End flow entirely | `Slab` |

---

## Aspirational: Consistency Improvements

The following sub-flows currently skip `EndSubFlowWrapper` and should be updated to use it for consistency:

- **SessionStats** — has its own inline "back" button and Escape handler instead of wrapping in `EndSubFlowWrapper`. Should use the wrapper and remove the duplicate back button and key handler.
- **LikedPostsGrid** (within the award flow) — renders directly without the wrapper. Should be wrapped so the "back to end menu" button is visible during post selection.

The goal: **every sub-flow uses EndSubFlowWrapper**, which gives users a visible back button plus Escape key, while the Slab's X button always provides the nuclear "exit End entirely" option. No sub-flow should need to roll its own back button or Escape handler for grid navigation.

---

## Data Available

The End screen has access to (passed from App.tsx):

- `sessionData` — metrics (postsViewed, likes, boosts, replies, linksOpened), likedPosts array
- `agent` — authenticated ATProto agent (for PDS writes and share posts)
- `logout()` — logout function
- `resetToBeginning()` — function to restart session
- Trophy state — `hasParticipationTrophy`, `hasTrophies`, `hasGivenBestThing` (from `useTrophies` hook)

---

## Future Buttons (not yet implemented)

| Button | What It Does |
|--------|-------------|
| **Share a picture** | Camera capture, post to community account |
| **Message in a bottle** | Write ephemeral message stored in KV |
| **Standard Site trending** | Hyperlink to external trending page |
| *(community-built)* | Third-party plugins |

---

*This spec reflects the codebase as of March 11, 2026.*
