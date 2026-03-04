# Spec: Middle Flow

The second act. "Browse your feed."

---

## Overview

The Middle is feed browsing — one post at a time on stage, full hotkeys available. This is the core experience.

---

## Entry

Begins when the user J's past the Middle card (algorithm + post count configuration).

### Middle Card

- Algorithm selection: **dropdown menu** (not radio buttons, not selectable cards)
- Post count slider: 5–100 (increments of 5)
- J to start feed

---

## Feed Browsing

One post on stage at a time. All hotkeys active (see keybindings.md).

### Key actions during Middle
- **J/K** — navigate posts
- **L/B/R/Q/F/O/V** — post actions
- **T** — toggle thread view (scrollable list — a fallback, not a priority)
- **E** — jump to ending (triggers End flow)
- **?** — save post to clipboard

### Reply Filtering
- Posts that are replies are filtered out of the feed
- Self-reply threads (author replying to themselves) are collapsed into a single feed item pointing to the thread root
- T key expands collapsed threads
- A collapsed thread counts as 1 post toward session metrics

### Progress Bar
Posts seen / total. Show if it fits the model cleanly.

---

## Exit

- **E key** → End flow (see end-flow.md)
- When the progress bar reaches 100% (posts viewed equals post budget), the app auto-transitions to End flow. Pressing E remains available as an early-exit option at any time during Middle.

---

## Related Specs

- **keybindings.md** — full hotkey reference
- **layout.md** — PostCard structure, thread view
- **app-architecture.md** — ViewState model, stage types `middle-card`, `post`, `thread`
- **end-flow.md** — what happens after E

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
