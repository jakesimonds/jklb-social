# Mobile Progress Bar — Match Web App

**Skyboard**: 3mg34t6 (scaffolded)
**Effort**: Small (single Ralph run)

## Problem

The mobile app shows a text counter at the bottom ("3 / 25") but has no visual progress bar like the web app. The web app has a thin cyan bar below the top nav that fills left-to-right as you view posts.

## Reference

Web app implementation:
- `src/index.css:90-107` — `.credible-exit-progress-track` (4px tall, full width) + `.credible-exit-progress-bar` (cyan, smooth transition)
- `src/components/AppLayout.tsx:1080-1086` — renders when `middleProgress > 0`
- Progress = `postsViewed / postsBeforePrompt`, clamped 0-1

## Implementation

### File: `src/components/mobile/MobileApp.tsx`

Add a thin progress bar directly below the top bar (between the "jklb" header and the card stack).

```tsx
{/* Progress bar */}
<div className="w-full h-1 bg-white/5 flex-shrink-0">
  <div
    className="h-full bg-[var(--memphis-cyan)] transition-[width] duration-300 ease-out rounded-r-sm"
    style={{ width: `${Math.min(((cardIndex + 1) / postBudget) * 100, 100)}%` }}
  />
</div>
```

Place this right after the top bar div (line 133) and before the card stack.

### Keep the text counter

The bottom text counter ("3 / 25") can stay — it gives exact numbers. The progress bar gives the visual feel. They complement each other.

### Edge cases

- `postBudget` is 0 or undefined → don't render bar
- `cardIndex` exceeds `postBudget` → clamp to 100%
- Loading state → don't render bar (no posts yet)

## Done when

- Cyan progress bar appears below "jklb" header
- Fills left-to-right as you swipe through posts
- Hits 100% when you reach your post budget
- Looks consistent with the web app's bar
