# Unactionable Items (Likes & Boosts) — Redesign

Updated: 2026-02-24

**Canonical spec: beginning-flow.md** — this file is supplementary reference with concept art details.

## Concept Art Reference

Jake's concept art (2026-02-24 screenshot) shows:

- **Title**: "Likes" or "Boosts" centered at top of the content area
- **Two posts side by side** in the content area, each surrounded by square profile pictures of the people who liked/boosted
- **Profile pics**: Square tiles (same component as Like Chorus avatars), arranged organically around each post — above, left, right, below
- **Hover behavior**: Same as chorus — hover shows ProfileHover card (bio, handle, click-to-Bluesky)
- **Posts**: Tiny-scale PostCard components (same component as full PostCard, just smaller). Text is sacred — show it all, just small.

## Data Model

Each "slide" shows up to **2 posts** of the same type (like or boost).

- **Likes first, then boosts**. All like slides come before any boost slides.
- **If a post got both liked AND boosted**, it appears **twice**: once in a likes slide, once in a boosts slide.
- Navigation: j/k pages through slides. When all slides are done, j advances to the next Beginning stage.

## Layout Per Slide

```
┌──────────────────────────────────────────────┐
│              Likes (or Boosts)                │
│                                               │
│    [avatar] [avatar]     [avatar]             │
│  [avatar]            [avatar]                 │
│            ┌──────┐            ┌──────┐       │
│  [avatar]  │ post │  [avatar]  │ post │ [av]  │
│            │ card │            │ card │       │
│            └──────┘            └──────┘       │
│    [avatar]          [avatar] [avatar]        │
│                                               │
└──────────────────────────────────────────────┘
```

- One unified outline around each post+avatars group
- Nav arrows in a corner (not center-bottom)

## Design Rules

- Full viewport, no scroll
- Square profile pictures (not round)
- No count text — avatars speak for themselves
- Posts use PostCard with `size="sm"` (same component, `size` prop)
- Chorus progressive fill: avatars animate into chorus when user J's past (see like-chorus.md)
