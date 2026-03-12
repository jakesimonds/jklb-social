# Architecture Research: Unified CurrentView Refactor

**Date**: 2026-02-24
**Updated**: 2026-03-11 — synced End stages and PanelView with current `viewState.ts`
**Status**: APPROVED — This refactor is the first implementation priority. The target architecture is defined in `app-architecture.md` (ViewState model). This document is the diagnostic that motivated the refactor.

**Context**: During Beginning/Middle/End tutorial and hotkey work, Jake realized the app's stage area only ever displays ONE component at a time, but the code doesn't reflect this. Research agent did a thorough analysis.

---

## The Mental Model

The app layout has two zones:
- **The Chorus**: top bar + right sidebar — avatars, buttons, always present
- **The Middle**: main content area — only ever shows ONE component at a time

The entire app flow is a serial sequence of single components in the middle:
`TutorialCard → UnactionableItemsView → NewFollowerCard → TutorialCard → BeginningPostCard → SectionCard → TutorialCard → PostCard → Slab → ScrollThread → NotificationGrid → AtmosphereReport → LikedPostsGrid → ...`

There is NEVER a moment where two things display in the middle simultaneously.

---

## Problem 1: Nested Ternary Chain in AppLayout

**Location**: `src/components/AppLayout.tsx` lines 676-901 (226 lines)

The content area rendering is a deeply nested ternary tree with ~9 branching levels:

```
isInThreadView && threadPosts.length
  ├─ threadViewMode === 'scroll' → ScrollThread
  │                              → ScrollThread
  └─ contentMode === 'notifications' → NotificationGrid
      └─ contentMode === 'atmosphere' → AtmosphereReport
          └─ contentMode !== 'post' → Slab (settings/hotkeys/credibleExit/reply/quote)
              └─ appPhase === 'beginning' → BeginningView
                  └─ appPhase === 'middleCard' → SectionCard
                      └─ appPhase === 'middleTutorial' → TutorialCard
                          └─ appPhase === 'end' && endFlowState... → LikedPostsGrid
                              └─ PostCard / PDSEventCard / Empty
```

**The order of checks matters for correctness** — reordering breaks things. Adding a new view means finding the right nesting level.

---

## Problem 2: Four Orthogonal State Dimensions

What shows in the middle is controlled by FOUR independent state variables in App.tsx:

```typescript
// Dimension 1: Application phase/lifecycle
const [appPhase, setAppPhase] = useState<AppPhase>('middle');
  // 'beginning' | 'middleCard' | 'middleTutorial' | 'middle' | 'end'

// Dimension 2: Content panel overlay
const [contentMode, setContentMode] = useState<ContentMode>('post');
  // 'post' | 'settings' | 'hotkeys' | 'credibleExit' | 'notifications' | 'reply' | 'quote' | 'atmosphere'

// Dimension 3: Thread view state
const [isInThreadView, setIsInThreadView] = useState(false);

// Dimension 4: End flow state machine
const [endFlowState] = useEndFlow();
  // stage: 'end-grid' | 'atmosphere' | 'liked-posts-grid' | 'share' | 'end-stats' | 'participation-claim' | 'participation-share' | 'award-nominate' | 'trophy-case'
```

This creates a combinatorial explosion. Invalid combinations (e.g. `appPhase === 'beginning' && contentMode === 'settings'`) are prevented by runtime logic, not types.

---

## Problem 3: Fragmented Hotkey Management

Hotkeys are registered at THREE levels:

| Level | Location | Keys | Phase |
|-------|----------|------|-------|
| Global | `useKeybindings` (App.tsx) | All keys | Was middle/end only, now always on |
| Component | `BeginningView` | j/k | Beginning only (REMOVED in feb24 fix) |
| Subcomponent | `NewFollowerCard` | f/v | Beginning follower stage |
| Subcomponent | `BeginningPostCard` | l/b | Beginning post stages |

**Current state after feb24 fixes**: Global useKeybindings is always enabled, j/k are centralized. But l/b/f/v are still locally registered by Beginning subcomponents. The global versions are gated with `appPhase === 'middle' || appPhase === 'end'` to prevent double-firing. This works but is fragile.

---

## Proposed Solution: Unified `CurrentView` Discriminated Union

Replace all four state dimensions with a single typed union:

```typescript
// Actual implementation: ViewState splits into stage + optional panel overlay.
// See src/types/viewState.ts

interface ViewState {
  stage: StageView;
  panel: PanelView | null;
}

type StageView =
  // Tutorial (can appear in ANY phase)
  | { type: 'tutorial'; id: string }
  // Beginning (notification walkthrough)
  | { type: 'unactionable'; index: number }
  | { type: 'follower'; index: number }
  | { type: 'reply-to-user'; index: number }
  | { type: 'mention'; index: number }
  | { type: 'quote-post'; index: number }
  // Middle
  | { type: 'middle-card' }
  | { type: 'post'; index: number }
  | { type: 'thread'; postIndex: number }
  // End
  | { type: 'end-grid' }
  | { type: 'atmosphere' }
  | { type: 'liked-posts-grid' }
  | { type: 'share' }
  | { type: 'end-stats' }
  | { type: 'participation-claim' }
  | { type: 'participation-share' }
  | { type: 'award-nominate' }
  | { type: 'trophy-case' }

type PanelView =
  | { type: 'settings' }
  | { type: 'hotkeys' }
  | { type: 'composer-reply'; targetUri: string }
  | { type: 'composer-quote'; targetUri: string }
  | { type: 'composer-new' }
```

AppLayout rendering becomes a flat switch:

```typescript
// Stage rendering is a flat switch on viewState.stage.type
switch (viewState.stage.type) {
  case 'thread': return <ScrollThread />;
  case 'atmosphere': return <AtmosphereReport />;
  case 'tutorial': return <TutorialCard ... />;
  case 'follower': return <NewFollowerCard ... />;
  case 'post': return <PostCard ... />;
  case 'end-grid': return <EndScreenGrid />;
  case 'trophy-case': return <TrophyCase />;
  case 'participation-claim': return <ParticipationClaim />;
  // ... flat cases for all StageView variants
}
// Panel overlay rendered separately when viewState.panel !== null
```

### Benefits
- TypeScript prevents invalid state combinations
- Adding a new view = one union variant + one switch case
- Hotkeys always active at top level — no component-level handlers needed
- All action keys (l/b/f/v) centralized in useKeybindings with `currentView.type` checks
- ~150 lines of conditional logic replaced by ~50 lines of flat switch

### What Would Break
1. All code checking `appPhase` (~10 places in App.tsx effectiveGoToNext/Prev)
2. Phase transition useEffect hooks (lines 382-402 in App.tsx) — become obsolete
3. `useContentMode` hook — absorbed into the new state
4. `useBeginning` hook — stage management refactored (or kept but consumed differently)
5. Beginning subcomponent local key handlers — removed, centralized
6. `useEndFlow` hook — stage management refactored (or kept but consumed differently)

### Key Files to Modify
- `src/App.tsx` — main controller, owns all state
- `src/components/AppLayout.tsx` — rendering logic
- `src/hooks/useKeybindings.ts` — always-on, phase-aware
- `src/hooks/useBeginning.ts` — stage machine (may keep, consume differently)
- `src/hooks/useContentMode.ts` — likely absorbed
- `src/hooks/useEndFlow.ts` — stage machine (may keep, consume differently)
- `src/components/beginning/BeginningView.tsx` — simplify to pure renderer
- `src/components/beginning/NewFollowerCard.tsx` — remove local key handlers
- `src/components/beginning/BeginningPostCard.tsx` — remove local key handlers

### Estimated Effort
~15-20 hours of careful work. Medium-high risk due to pervasiveness, but no structural/data model changes needed — purely state management reorganization.

---

## What's Clean (Don't Break These)
- `useKeybindings` hook design is solid — comprehensive, single-location
- `useBeginning` stage machine logic is well-factored (advance/goBack/buildStageSequence)
- The Chorus (top bar + right sidebar) is cleanly separated from the Stage
- Memphis design system variables are consistent throughout
