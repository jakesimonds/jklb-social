# Spec: Beginning Flow

The first act. "What happened while you were away."

---

## Overview

A serial walkthrough of notifications, shown one at a time on stage. The user J's through each item. Categories with no items are silently skipped.

---

## Sequence

```
[Tutorial: nav] → Likes → Boosts → Followers → [Tutorial: actions] → Quote Posts → Replies → Mentions → Middle Card
```

Items in brackets are tutorial cards — present when tutorial is ON, absent when OFF.

### Stage Sequence Detail

| Order | StageView | Component | Actionable? |
|-------|-----------|-----------|-------------|
| 1 | `tutorial:nav` | TutorialCard | No (J/K only) |
| 2 | `unactionable:0..N` | UnactionableItemsView | No (J/K only) |
| 3 | `follower:0..N` | NewFollowerCard | f (follow), v (view) |
| 4 | `tutorial:actions` | TutorialCard | No (J/K only) |
| 5 | `quote-post:0..N` | PostCard | l, b, r, q |
| 6 | `reply-to-user:0..N` | PostCard | l, b, r, q |
| 7 | `mention:0..N` | PostCard | l, b, r, q |
| 7 | — | → transition to `middle-card` | — |

---

## Notification Card Visual Pattern

**ALL notification types in the Beginning flow follow the same visual pattern.** This is a key design rule — consistency across every notification category. Notification type outlines alternate between the three Memphis colors (pink, yellow, cyan) — see keybindings.md § Key Display Convention for the full color convention.

### Structure (every notification type)

1. A **big, colorful section label** centered above the card (e.g., "Likes", "Boosts", "New Follower", "Quote Post", "Reply", "Mention")
   - Styled: `text-3xl font-bold tracking-tight` in the type's accent color
2. A **"N of M" counter** below the label (if multiple items in this category)
3. The **card content** in a **colored outline** (`border-2` with the type's accent color)

### Accent Colors by Notification Type

| Type | Color | CSS Variable |
|------|-------|-------------|
| Likes | pink | `var(--memphis-pink)` |
| Boosts | yellow | `var(--memphis-yellow)` |
| New Follower | cyan | `var(--memphis-cyan)` |
| Quote Post | yellow | `var(--memphis-yellow)` |
| Reply | cyan | `var(--memphis-cyan)` |
| Mention | pink | `var(--memphis-pink)` |

### Card Contents by Type

| Type | What's inside the colored outline |
|------|----------------------------------|
| Likes / Boosts | Small PostCard (`size="sm"`) surrounded by avatar tiles |
| New Follower | Profile card with cover photo background, avatar, bio, follower counts |
| Quote Post / Reply / Mention | Full PostCard |

---

## Likes & Boosts (Unactionable Items)

View-only display. The user's own posts with the people who liked/boosted them.

### Layout per slide
- **Section label**: big, colorful "Likes" or "Boosts" centered above (follows notification card visual pattern)
- **"N of M" counter** below the label
- **1-2 posts** per slide, side by side, inside a **colored outline** (`border-2` with accent color)
- Each post rendered as a **PostCard with `size="sm"`** — small text, full content (text is sacred), minimal chrome. The user wrote these; they just need a reminder.
- **Square avatar tiles** of likers/boosters surround each post inside the outline (same PerimeterCell component as chorus)
- **No count labels** — no "3 likes", no "2 boosts". Avatars speak for themselves.
- **ProfileHover on hover** for every avatar (same as chorus)

### Slide pagination
- Likes slides first, then boosts slides
- If a post was both liked AND boosted, it appears in both sections
- 2 posts per slide (1 if odd count)
- J/K pages through slides

### What it looks like
The existing screenshot reference (see unactionable-redesign.md) is close to the target. Key refinements:
- Posts should use the actual PostCard component with `size="sm"`
- Square profile pics (not round)
- Full viewport, no scroll
- One unified outline around each post+avatars group (not individual borders on everything)
- Nav arrows (J/K) in a corner, not center-bottom

---

## New Followers

One card per new follower, shown serially. Follows the notification card visual pattern.

### Layout
- **Section label**: big, colorful "New Follower" in cyan, centered above the card
- **"N of M" counter** if multiple followers
- Card content inside a **cyan colored outline** (`border-2`):
  - **Cover photo** shows behind the **entire card** (not just the avatar sidebar)
  - Large profile picture (with ProfileHover on hover)
  - Display name, handle
  - Bio text
  - Follower/Following counts

### Actions
- `f` — Follow back
- `v` — View profile on bsky.app

---

## Quote Posts (`quote-post`)

Posts where someone quoted your content. Shown serially, one at a time. Follows the notification card visual pattern.

### Layout
- **Section label**: big, colorful "Quote Post" in yellow, centered above the card
- **"N of M" counter** below the label
- Card content inside a **yellow colored outline** (`border-2`):
  - Standard **PostCard** showing the other person's post (with the quote of yours embedded)
  - **That person's cover photo** as the banner (not yours — it's their post)
  - **ProfileHover** on their avatar

### Actions
- `l` — Like
- `b` — Boost
- `r` — Reply
- `q` — Quote

---

## Replies to User (`reply-to-user`)

Posts where someone replied to your content. Shown serially. Follows the notification card visual pattern.

### Layout
- **Section label**: big, colorful "Reply" in cyan, centered above the card
- **"N of M" counter** below the label
- Card content inside a **cyan colored outline** (`border-2`):
  - **Parent post (yours)** above the reply, rendered as a **PostCard with `size="sm"`**
    - This requires fetching the parent post from the reply notification's parent URI
    - Small size because you wrote it — just a reminder of context
  - **Reply post (theirs)** below, as a standard PostCard
  - **That person's cover photo** as the banner
  - **ProfileHover** on their avatar

### Data requirement
Replies need to resolve the parent post. The notification contains the reply URI; we need to fetch the parent via `app.bsky.feed.getPostThread` or resolve `reply.parent.uri` from the post record.

### Actions
- `l` — Like
- `b` — Boost
- `r` — Reply
- `q` — Quote

---

## Mentions (`mention`)

Posts where someone mentioned you (@-tagged you) in their content. Shown serially. Follows the notification card visual pattern.

### Layout
- **Section label**: big, colorful "Mention" in pink, centered above the card
- **"N of M" counter** below the label
- Card content inside a **pink colored outline** (`border-2`):
  - Standard **PostCard** showing the other person's post
  - **That person's cover photo** as the banner
  - **ProfileHover** on their avatar

### Actions
- `l` — Like
- `b` — Boost
- `r` — Reply
- `q` — Quote

---

## Component Reuse

**Hard rule: reuse components aggressively.**

| Context | Component | Size prop |
|---------|-----------|-----------|
| Likes/boosts posts | PostCard | `sm` |
| Quote posts | PostCard | `lg` (default) |
| Replies (your parent post) | PostCard | `sm` |
| Replies (their reply) | PostCard | `lg` (default) |
| Mentions | PostCard | `lg` (default) |
| Avatar tiles (likes/boosts) | PerimeterCell | Standard (72px) |
| Profile hover (everywhere) | ProfileHover | Standard |

Do NOT create parallel implementations. PostCard uses a `size` prop (`sm`, `md`, `lg`). If PerimeterCell already works for chorus, use it for likes/boosts.

---

## Chorus Progressive Fill

See like-chorus.md for full detail. During Beginning:
1. Chorus starts empty
2. As user passes each section, avatars animate into chorus
3. Fully populated by Middle transition

---

## Navigation

All handled by `useKeybindings` (centralized, see keybindings.md):
- `j` / `↓` — next item or next section
- `k` / `↑` — previous item or previous section
- `k` from first item of a section → last item of previous section
- `k` from very first Beginning item → no-op

---

## Technical Notes

- Beginning logic: `src/hooks/useBeginning.ts`
- Tutorial definitions: `src/lib/tutorials.ts`
- BeginningView: `src/components/beginning/BeginningView.tsx`
- PostCard: `src/components/PostCard.tsx`
- Parent post fetch for replies: requires AT Protocol call

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
