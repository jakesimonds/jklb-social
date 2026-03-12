# 04 — UI Cleanup

## Hardcoded Bluesky URLs

These must be replaced with adapter method calls.

### URL Construction in Components

| File | Line(s) | Current Code | Fix |
|------|---------|-------------|-----|
| `src/components/PostCard.tsx` | 171, 319 | `https://bsky.app/profile/${post.author.handle}` | Use `post.author.profileUrl` (already on `JKLBAuthor`) |
| `src/components/PostHeader.tsx` | 46-54 | `https://${author.handle}` | Use `author.profileUrl` |
| `src/components/PostHeader.tsx` | 112-124 | `bskyUrl` + "View on Bluesky (v)" | Use `adapter.getPostUrl(post)` + `adapter.nativeClientName` |
| `src/App.tsx` | 866-890 | `buildBskyUrl()` function constructs `https://bsky.app/profile/${handle}/post/${rkey}` | Use `adapter.getPostUrl(post)` |

### Function/Callback Naming

| Current Name | Generic Name | Files Affected |
|-------------|-------------|----------------|
| `handleViewOnBluesky` | `handleViewOnPlatform` | `src/App.tsx` |
| `onViewOnBluesky` | `onViewOnPlatform` | `src/hooks/useKeybindings.ts` |
| `buildBskyUrl` | *(delete — adapter handles this)* | `src/App.tsx` |
| `extractRkey` | *(move to adapter — AT Protocol specific)* | `src/App.tsx` |

### UI Text

| Current | Generic | Location |
|---------|---------|----------|
| "View on Bluesky" | `"View on " + adapter.nativeClientName` | `PostHeader.tsx` tooltip |
| Any "Bluesky" in UI copy | `adapter.networkName` | Various |

### Extra Keybinding: `u` Key

The spec defines `f` as a follow/unfollow toggle. The implementation adds a separate `u` key for unfollow only. This is not in the spec.

**Decision needed:** Keep `u` as a Bluesky-specific extension, or remove it and rely on `f` toggle only. The spec is clear that `f` toggles — having a separate unfollow key could confuse users who read the spec's key reference.

**Recommendation:** Remove `u`, rely on `f` toggle. If there's a UX reason for `u` (e.g., preventing accidental unfollows), document it as a spec extension.

### Character Limit in Composer

The composer hardcodes a 300-character limit (Bluesky's post length). This should come from the adapter.

**Proposed addition to adapter interface (or as an optional capability):**

```typescript
interface NetworkAdapter {
  // ... existing methods ...

  /** Maximum post length in characters. Null = no limit. */
  readonly maxPostLength: number | null;
}
```

For Bluesky: `maxPostLength = 300`. Composer reads this from the adapter.

### Profile Hover Popup

The profile hover popup links should use `author.profileUrl` from `JKLBAuthor` instead of constructing URLs. This is already available on the type — just needs wiring.

### Chorus Avatar Clicks

Avatar clicks in the Chorus should use `member.profileUrl` (which maps to `JKLBAuthor.profileUrl`). Verify these don't construct Bluesky URLs inline.

## Spec-Mandated UI Features to Verify

These are spec requirements that should work correctly regardless of network. Verify they don't have hidden Bluesky dependencies:

| Feature | Spec Section | What to Check |
|---------|-------------|---------------|
| No engagement counts | 1.5 | PostCard/PostFooter don't show like/repost/reply counts |
| Text never truncated | 1.4 | No `text-overflow: ellipsis` on post text |
| Post text font size reduction | 1.4 | Long text gets smaller font, not truncated |
| Single viewport | 1.1 | No scroll on main stage |
| Memphis aesthetic | 1.8 | Colors, dark background |
| Escape hatch on everything | 2.1 | Posts, profiles, mentions, hashtags all link to native platform |

## Settings Panel Text

Review `SettingsPanel.tsx` for any Bluesky-specific copy:
- Music label mentions "plyr.fm" — this is fine (plyr.fm is network-independent)
- Feed settings reference "algo feed" — should use `adapter.capabilities.multipleFeeds` to show/hide
- Chorus toggle — should use `adapter.capabilities.notifications` to show/hide

## LLM Prompt Template (Spec Section 10)

The spec says the LLM prompt template should be **user-configurable free text** in settings. Currently it's hardcoded in `src/lib/settings.ts` with no UI to edit it.

**Fix:** Add a textarea in SettingsPanel for `explanationPrompt`. The default template should use `adapter.networkName` instead of hardcoding "Bluesky":

```
"Here's a post from {networkName} I'd like to discuss: {postText} -- by @{handle} ({url})"
```
