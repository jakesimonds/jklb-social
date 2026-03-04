# Spec: Keybindings

Keyboard-first navigation. Two tiers: Important and Extra.

---

## Key Display Convention

Whenever keys are shown to users — tutorial cards, nav arrows, hotkeys panel, right bar buttons, PostHeader action hints — they follow these rules:

- **Always lowercase** when displayed
- **Color per key:**

| Key | Color | CSS Variable |
|-----|-------|-------------|
| `j` | pink | `var(--memphis-pink)` |
| `k` | blue/cyan | `var(--memphis-cyan)` |
| `l` | pink | `var(--memphis-pink)` |
| `b` | yellow | `var(--memphis-yellow)` |
| Other keys | Alternate between the three Memphis colors as appropriate | pink / cyan / yellow |

This convention applies everywhere a key label is rendered visually.

---

## The Stack Model

Keybindings interact with the ViewState stack (see app-architecture.md):

- **Panel open** (settings/hotkeys/composer): J/K pop the panel first, then advance/retreat. Escape just pops.
- **No panel**: J/K advance/retreat the serial flow directly. Escape is no-op.
- **In input field**: all keybindings disabled except Enter (submit) and Escape (cancel/close).

---

## Hotkeys Panel Display

The Space key shows a hotkeys reference panel. It has exactly **two sections**:

### Important

| Key | Action |
|-----|--------|
| `j` / `↓` | Next (forward in flow) |
| `k` / `↑` | Previous (back in flow) |
| `v` | View on Bluesky |
| `l` | Like / Unlike |
| `b` | Boost / Un-boost |
| `r` | Reply |
| `q` | Quote post |

### Extra

| Key | Action |
|-----|--------|
| `e` | Jump to ending (middle phase only) |
| `?` | Save post to clipboard (for LLM) |
| `f` | Follow / Unfollow author |
| `o` | Open first link in post |
| `Shift+o` | Cycle highlighted link (when post has multiple links) |
| `Shift+j` | Focus quoted post (actions target quoted post) |
| `Shift+k` | Back to main post (unfocus quote) |
| `t` | Toggle thread view |
| `s` | Settings |
| `Space` | This panel |
| `;` | Toggle video sound |
| `c` | Toggle cover photo to front |
| `Esc` / `⌫` | Close / Back |

### Removed from display
- ~~Enter = "Drill into quotes"~~ — removed
- ~~e = "End session"~~ — renamed to "Jump to ending" (middle phase only)
- Q is only "Quote post". Logout has no hotkey — click-only button in the right bar.

---

## Key Behavior by Phase

### Always active (all phases, all stages)

| Key | Action |
|-----|--------|
| `j` / `↓` | Next in serial flow (pops panel first if open) |
| `k` / `↑` | Previous in serial flow (pops panel first if open) |
| `Space` | Toggle hotkeys panel |
| `s` | Toggle settings panel |
| `Esc` / `⌫` | Close panel, exit fullscreen, or exit thread view |
| `v` | View current post/profile on Bluesky |

### Beginning phase

| Key | Action |
|-----|--------|
| `f` | Follow back (on follower cards) |
| `l` | Like (on quote posts and replies) |
| `b` | Boost (on quote posts and replies) |

### Middle phase (feed browsing)

All keys active:
| Key | Action |
|-----|--------|
| `l` | Like / Unlike |
| `b` | Boost / Un-boost |
| `r` | Reply (opens composer panel) |
| `q` | Quote post (opens composer panel) |
| `f` | Follow / Unfollow |
| `o` | Open first link |
| `Shift+o` | Cycle highlighted link |
| `Shift+j` | Focus quoted post |
| `Shift+k` | Back to main post |
| `t` | Toggle thread view (Scroll mode only) |
| `e` | Jump to ending (triggers End flow) |
| `?` | Save post to clipboard |
| `c` | Toggle cover photo z-index |
| `;` | Toggle video sound |

### End phase

| Key | Action |
|-----|--------|
| `j` | Advance through end stages |

---

## Shift Keys

Shift modifies a key's behavior to operate on a **secondary target** or cycle through options. The base key stays the same — Shift just adds depth.

| Shift Key | Base Key | What Shift Does |
|-----------|----------|-----------------|
| `Shift+o` | `o` (open link) | Cycles which link is highlighted when a post has multiple links. Implemented. |
| `Shift+j` | `j` (next post) | Focuses the quoted post — yellow outline appears, all action keys (l/b/r/q) now target the quoted post instead of the parent. No-op if the post has no quote. Planned (Phase 70). |
| `Shift+k` | `k` (prev post) | Unfocuses the quoted post — returns action targeting to the parent post. Planned (Phase 70). |

**Pattern:** Shift = "go deeper into the current post" rather than "move to the next post." This is why Shift+J focuses the quote (drilling into embedded content) while plain J advances the timeline.

**Technical:** JavaScript `event.key` returns uppercase when Shift is held (`'J'` vs `'j'`), so these are naturally separate switch cases in `useKeybindings.ts`.

---

## Arrow Keys

`↓` and `↑` are **always** aliases for `j` and `k` respectively. This is true in every phase, every stage, every context. They are registered at the same level and go through the same code path.

---

## Action Key Panel Behavior

When an action key (l/b/r/o/q/f) is pressed while a panel is open:
- The panel closes first
- The action does NOT execute
- User must press the action key again with no panel open

This prevents accidental actions while reading settings or hotkeys.

---

## Centralized Registration

**All** keybindings are registered in one place: `useKeybindings` hook. No component-level key handlers. The hook reads `ViewState` to determine which keys are active for the current stage.

```typescript
// Pseudo-code
function handleKey(key: string, viewState: ViewState) {
  // Panel handling (always)
  if (key === 'j' || key === 'ArrowDown') {
    if (viewState.panel) clearPanel();
    advanceFlow();
    return;
  }

  // Phase-specific keys
  const phase = getPhase(viewState.stage);
  if (key === 'l' && (phase === 'middle' || isBeginningActionableStage(viewState.stage))) {
    toggleLike();
  }
  // ... etc
}
```

---

## Technical Notes

- Implemented in `src/hooks/useKeybindings.ts`
- Uses `keydown` event listener on document
- Checks `event.target` to skip when in inputs (textarea, input, [contenteditable])
- Hook is always enabled — no phase-gating at the hook level
- Phase-gating happens inside the handler via ViewState checks

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
