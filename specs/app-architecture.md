# App Architecture

Two zones, one serial flow, three acts.

---

## Two UI Zones

The app has exactly two visual zones. Nothing else.

### 1. The Chorus

The top bar and right sidebar. Contains controls and community presence.

**Top bar (96px tall), left to right:**
- **JKLB buttons** — 4 square cells (72px each), always present. Working nav buttons that double as the informal logo.
- **Like Chorus avatars** — fill remaining horizontal space. Square profile pics of recent interactors, color-coded by interaction type.
- **PWD component** — rightmost position. Shows current phase (Beginning / Middle / End) when logged in, or login form when logged out. Text should be prominent/large.

**Right bar (96px wide), top to bottom:**
- **Like Chorus overflow** — avatars that don't fit in the top bar flow down here.
- **Spacer** — pushes action buttons to bottom.
- **Action buttons** — O (open), Space (hotkeys), S (settings) as 72px square cells with `jklb-button` styling, plus a plain "log out" button (click-only, no hotkey — plain text, font-sans, muted color, only when logged in).

**Responsive shrink order** (as viewport narrows):
1. Like Chorus avatars disappear first
2. Right bar collapses (action buttons move or hide)
3. JKLB buttons disappear
4. PWD + login form persist last — this is always visible

### 2. The Stage (center)

The main content area. **Only ONE component is ever on stage.** This is the app's core rendering principle. The entire app flow is a serial sequence of single components appearing on stage, one at a time.

What's on stage is determined by the `ViewState` (see below).

**Stage constraints:**
- Max-width: 600px (900px on wide viewports)
- Vertically centered
- No scroll (see Constitution — single viewport)

---

## ViewState: Single Source of Truth

The app's view is controlled by a single state object with two levels:

```typescript
interface ViewState {
  stage: StageView;        // Current position in the serial flow
  panel: PanelView | null; // Optional ephemeral overlay (settings, hotkeys, composer)
}
```

### StageView — where you are in the flow

```typescript
type StageView =
  // Tutorial (can appear in ANY phase — placement rule determines where)
  | { type: 'tutorial'; id: string }
  // Beginning (notification walkthrough)
  | { type: 'unactionable'; index: number }
  | { type: 'follower'; index: number }
  | { type: 'reply-to-user'; index: number }   // Someone replied to your post
  | { type: 'mention'; index: number }          // Someone mentioned you in their post
  | { type: 'quote-post'; index: number }       // Someone quoted your post
  // Middle
  | { type: 'middle-card' }
  | { type: 'post'; index: number }
  | { type: 'thread'; postIndex: number }
  // End
  | { type: 'atmosphere' }
  | { type: 'end-card' }
  | { type: 'liked-posts-grid' }
  | { type: 'share' }
```

### PanelView — ephemeral overlay

```typescript
type PanelView =
  | { type: 'settings' }
  | { type: 'hotkeys' }
  | { type: 'composer-reply'; targetPost: PostReference }
  | { type: 'composer-quote'; targetPost: PostReference }
```

The composer panels capture a reference to the post that was on stage when the panel was pushed. This is the post being replied to or quoted. The stage position doesn't change while the panel is open — the composer just holds onto its target.

### The Stack Model

Panels are **pushed onto a stack** on top of the current stage position.

- **S key** → pushes `{ type: 'settings' }`
- **Space key** → pushes `{ type: 'hotkeys' }`
- **R key** → pushes `{ type: 'composer-reply', targetPost: currentPost }` (captures whatever post is on stage)
- **Q key** → pushes `{ type: 'composer-quote', targetPost: currentPost }` (captures whatever post is on stage)

**Popping the stack:**
- **J/K (or arrows)** → pops the panel, then advances/retreats in the serial flow
- **Escape / Backspace** → pops the panel, stays at current stage position

**When no panel is open:**
- **J/K** → advance/retreat in the serial flow directly
- **Escape** → no-op (unless in fullscreen, thread view, etc.)

### Rendering Rule

```typescript
if (viewState.panel) {
  renderPanel(viewState.panel);
} else {
  renderStage(viewState.stage);
}
```

The stage render is a **flat switch** on `stage.type` — no nested ternaries, no priority ordering.

---

## Three Acts

### Beginning — "What happened while you were away"

A serial walkthrough of notifications. Each category is shown one at a time on stage.

**Sequence (categories with items):**
1. Tutorial card: navigation (if tutorial ON)
2. Unactionable: likes & boosts slides
3. Followers: one card per new follower
4. Tutorial card: actions (if tutorial ON, and there are actionable posts)
5. Quote posts: one card per quote of your content
6. Replies: one card per reply to your posts

**Rules:**
- Empty categories are silently skipped
- J/K navigate within and between categories
- K from the first item in a category goes back to the last item of the previous category
- K from the very first item does nothing

**Component reuse in Beginning:**
- Likes/boosts: use **PostCard with `size="sm"`** for the user's post (small text, the user wrote it — they just need a reminder). Square avatars of likers/boosters surround it. No count labels.
- Quote posts and replies: use the standard **PostCard** showing the other person's content, with that person's **cover photo** visible.
- Replies: show the **parent post** (the user's original) above the reply, rendered as a PostCard with `size="sm"`.
- New followers: profile card with avatar, bio, follow/unfollow.

**Chorus progressive fill:**
- The Like Chorus starts **empty** when Beginning starts.
- As the user J's past each section, avatars from that section animate (straight-line motion) from their stage position into the next open chorus slot.
- Chorus is fully populated by the time Middle begins (or fills incrementally, completing at transition).

### Middle — "Browse your feed"

Feed browsing. One post at a time on stage.

**Middle card (transition):**
- Algorithm selection: **dropdown menu** (not radio buttons)
- Post count slider: 5–100
- J to start feed

**During feed:**
- All hotkeys active (see keybindings.md)
- T key toggles thread view (scrollable list — a fallback feature, not a priority)
- E key triggers End flow ("Jump to ending")
- Progress bar showing posts seen / total (if it fits the model cleanly)

### End — "Reflect and share"

Triggered by E key. See end-flow.md for full detail.

```
E key → Atmosphere → End Card → Liked Posts Grid → Share → Sunset
```

---

## Tutorial Card System

Tutorial cards are instructional cards that can appear **anywhere in the serial flow** — Beginning, Middle, or End. They are not phase-specific. Each card has a placement rule that determines where it slots in.

### Placement Rules

Each tutorial card is defined in `src/lib/tutorials.ts` with an `id`, `phase`, `rule`, and `content`:

| Card ID | Phase | Rule | Content |
|---------|-------|------|---------|
| `nav` | beginning | Before the first Beginning item | Two styled button hints: j (pink) "to go forward", k (blue) "to go back". Footer: "j to continue" in pink. |
| `actions` | beginning | Before the first actionable post (quote/reply) | "L to like, B to boost" |
| *(future cards)* | *(any)* | *(defined per card)* | *(defined per card)* |

The `phase` field is what `getTutorialPhase(id)` uses for phase derivation (see above).

### Toggle Behavior

- **Tutorial ON** in settings: cards are present in the serial flow at their rule-defined positions
- **Tutorial OFF**: cards are spliced out — the flow skips them entirely
- **Mid-session toggle OFF**: any tutorial cards the user hasn't reached yet are removed. Cards already passed are gone regardless.

---

## Hard Rules

These apply everywhere, always.

### ProfileHover Rule
**Any time a profile picture is shown anywhere in the app**, hovering it shows the ProfileHover popup (bio, handle, click-to-Bluesky). The popup does **NOT** show the profile picture again — the user already sees it.

### Text Is Sacred
Post text is never truncated. Full text always shown. (Small-scale PostCards reduce font size but still show all text.)

### No Scroll
Single viewport. The stage does not scroll. Exception: settings panel content may degrade to scroll on very narrow viewports.

### No Engagement Counts
No like counts, repost counts, reply counts displayed on posts. This is a design philosophy choice.

### Cover Photo
Author cover photos are shown on posts (always on, not toggleable). For Beginning quote posts and replies from other users, show **that person's** cover photo.

---

## Phase Derivation

The "phase" (Beginning/Middle/End) is derived from `ViewState.stage.type`, not stored separately:

```typescript
function getPhase(stage: StageView): 'beginning' | 'middle' | 'end' {
  switch (stage.type) {
    case 'tutorial':
      return getTutorialPhase(stage.id); // Lookup from tutorial definitions
    case 'unactionable':
    case 'follower':
    case 'reply-to-user':
    case 'mention':
    case 'quote-post':
      return 'beginning';
    case 'middle-card':
    case 'post':
    case 'thread':
      return 'middle';
    case 'atmosphere':
    case 'end-card':
    case 'liked-posts-grid':
    case 'share':
      return 'end';
  }
}
```

The PWD component uses this to display the current phase.

---

## Theme

Background color varies subtly by phase. Configured in `src/lib/themeConfig.ts` (dev-time, not runtime).

```typescript
// Example — iterate on these values
const themeConfig = {
  beginning: { bg: '#1e1e3a' },  // lighter
  middle:    { bg: '#1a1a2e' },  // standard
  end:       { bg: '#161628' },  // darker
};
```

Memphis accent colors (pink, cyan, yellow) remain constant across phases.

---

## Key Files

| File | Responsibility |
|------|---------------|
| `src/App.tsx` | Owns ViewState, orchestrates transitions |
| `src/components/AppLayout.tsx` | Renders Chorus + Stage based on ViewState |
| `src/hooks/useKeybindings.ts` | All hotkeys, always on, reads ViewState |
| `src/hooks/useBeginning.ts` | Beginning stage sequence logic |
| `src/hooks/useEndFlow.ts` | End flow stage sequence logic |
| `src/lib/themeConfig.ts` | Phase-specific background colors |
| `src/lib/tutorials.ts` | Tutorial card definitions and placement rules |

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
