# Spec: Like Chorus

The community presence bar. Always visible when logged in.

---

## What It Is

Square avatar tiles filling the top bar (after JKLB) and right bar (above action buttons). Shows people who recently interacted with you. Part of the Chorus zone (see app-architecture.md).

---

## Always Visible

The Like Chorus is **not toggleable**. When logged in and chorus data exists, it's shown. The only thing that hides it is responsive shrink (it disappears first as viewport narrows).

---

## Layout

- **Top bar:** fills horizontal space between JKLB buttons and PWD component
- **Right bar:** fills vertical space above action buttons (O, Space, S, log out)
- Each avatar is a 72x72px square PerimeterCell with slight rounding
- Capacity calculated dynamically via ResizeObserver
- Avatars that don't fit in top bar overflow to right bar
- Never scrolls — exactly N avatars rendered where N = available slots

---

## Avatar Styling

- Square tiles (72x72px PerimeterCell) with slight rounding
- Subtle border
- No interaction-type color coding — just the avatar

---

## Hover Behavior (ProfileHover)

Hovering any chorus avatar shows a ProfileHover popup:
- Display name, handle, bio text
- Click popup → opens bsky.app profile
- **Does NOT show profile picture** in the popup (you already see it in the avatar tile)
- Fetched on first hover, cached thereafter
- 150ms delay on mouse-leave before hiding (allows moving cursor to popup)

This is an instance of the **ProfileHover Rule** (see app-architecture.md): every profile picture in the app gets this behavior, and the popup never shows the pic twice.

---

## Progressive Fill (Beginning Animation)

During the Beginning phase:
1. Chorus starts **empty** (no avatars)
2. As the user J's past each Beginning section (likes, boosts, followers, etc.), the avatars from that section **animate into the chorus**
3. Animation: straight-line motion from the avatar's stage position to the next open chorus slot
4. By the time Middle begins, the chorus is fully populated
5. If there are more chorus members than Beginning sections reveal, remaining members populate at the Beginning→Middle transition

---

## Data

```typescript
interface ChorusMember {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  enteredAt: number;
}
```

- Max 100 members, FIFO eviction
- Populated from notifications on app load
- Deduped by DID

---

## Technical Notes

- Chorus logic: `src/lib/chorus.ts`
- UI: `src/components/PerimeterCell.tsx`
- Hover: `src/components/ProfileHover.tsx`
- Capacity: calculated in `AppLayout.tsx` via ResizeObserver

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
