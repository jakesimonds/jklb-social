# Spec: Layout

Single viewport. Two zones. No scroll.

---

## Grid Structure

```css
grid-template-rows: 96px 1fr;
grid-template-columns: 1fr 96px;
grid-template-areas:
  "top-bar top-bar"
  "stage   right-bar";
```

### Top Bar (96px tall)
Left to right:
1. JKLB buttons (4 × 72px cells, 4px gaps)
2. Like Chorus avatars (fills remaining space)
3. PWD component (phase indicator or login form)

### Right Bar (96px wide)
Top to bottom:
1. Like Chorus overflow (fills available space)
2. Flex spacer
3. Action buttons: O, Space, S (each 72px cell, `jklb-button` styling matching the JKLB buttons in the top bar). These buttons follow the **key color convention** (see keybindings.md § Key Display Convention). Below them: a plain "log out" button (click-only, no hotkey — styled differently: plain text, font-sans, muted color).

### Stage (center)
- Flex, centered
- Max-width: 600px (900px on wide viewports)
- Max-height: calc(100vh - 96px - 32px)
- One component at a time (see app-architecture.md)

---

## PostCard

The primary stage component during Middle phase.

### Structure
- Left: Author avatar (with ProfileHover on hover)
- Header: Author name, timestamp, action buttons, nav arrows (↓↑)
- Body: Full post text (never truncated, "text is sacred")
- Media: images (grid), video (HLS), external links, GIFs
- Quoted post: inline (recursive)
- Cover photo: author banner behind post (always on)
- Focus: pink border when selected

### Wide Mode (viewport ≥ 900px)
When post has BOTH quote AND media: two-column layout.

### PostCard Size Variants

Controlled via a `size` prop on PostCard. Three sizes:

| Size | Prop value | Usage | Description |
|------|-----------|-------|-------------|
| **Small** | `sm` | Inside notification card outlines (likes/boosts in Beginning) | Proportionally scaled down: smaller fonts, padding, avatar. Same layout. Text is never truncated. |
| **Medium** | `md` | Reserved for future use | Intermediate size between sm and lg. |
| **Large** | `lg` (default) | Feed browsing (Middle), quote posts, replies, mentions | Current full-size behavior. |

All sizes share the same component and layout — they differ only in scale. Text is sacred at every size.

---

## Thread View

Triggered by `t` key. A fallback feature, not a priority.

### ScrollThread
- Simple vertical scrollable list of posts in the thread
- Original post highlighted with cyan left border
- Hidden scrollbar
- T or J/K exits thread view

---

## PostHeader

- Left: author displayName, timestamp
- Right (anchored): action buttons (f, l, b, r, v) + nav arrows
- Nav arrows: ↓ (pink, j) and ↑ (cyan, k)
- Hidden on mobile

---

## Phase Labels (PWD Component)

The PWD component displays the current phase title and subtitle:

| Phase | Title | Subtitle | Notes |
|-------|-------|----------|-------|
| Beginning | **Beginning** | (your notifications) | Title text should be larger (~text-xl, not text-sm) |
| Middle | **Middle** | (l, b, r and q to create notifications for others) | |
| End | **Ending** | Reflect & Share | |

---

## Responsive Degradation

As viewport narrows, elements drop in this order:

1. **Full desktop (≥1024px):** All elements visible — top bar, right bar, chorus, stage
2. **Medium (640–1023px):** Right bar collapses, chorus hides
3. **Narrow (<640px):** JKLB buttons hide, PWD + login persist
4. **Minimum:** PWD component is the last UI element standing

---

## Text Display Rules

- Full post text (never truncated)
- No engagement counts (likes, reposts, replies) — hidden by design
- Visual indicator if user has liked/reposted
- Text size configurable: Small (default) / Medium (1.3×) / Large (1.6×)

---

## Media Display

- Images: grid layout, max height constrained to viewport
- Video: HLS.js streaming, inline playback
- External links: preview card (thumb, title, description)
- Tenor GIFs: detected by domain, displayed as media

---

## Deleted Components

These no longer exist in the codebase:
- **ScrollThread.tsx** — vertical scroll-based thread viewer.
- **Theme toggle** — dark mode only.

---

## Technical Notes

- CSS Grid for main layout
- Tailwind for responsive breakpoints
- ResizeObserver for dynamic chorus capacity
- PerimeterCell.tsx for all 72px square cells (buttons + avatars)

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
