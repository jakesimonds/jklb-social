# Mobile App Icon — Replace Expo Placeholders with jk Favicon

**Skyboard**: 3mg34rn (scaffolded)
**Effort**: Small (single Ralph run)

## Problem

All mobile app icons (`icon.png`, `adaptive-icon.png`, `splash-icon.png`) are Expo default placeholders (concentric circles on gray grid). The web app has the correct favicon: pink "j" + cyan "k" on dark `#1a1a2e` background. The mobile `favicon.png` is a cube — also wrong.

## Source of Truth

`public/favicon.svg` — the canonical jk logo:
- Dark background `#1a1a2e`, rounded rect
- Pink `#e91e63` "j" + Cyan `#00bcd4` "k"
- system-ui font, weight 600

## Tasks

### 1. Generate PNGs from SVG at required Expo sizes

Use a script (sharp, puppeteer, or sips on macOS) to render `public/favicon.svg` at these sizes:

| File | Size | Notes |
|------|------|-------|
| `mobile/assets/icon.png` | 1024x1024 | Main app icon (iOS + store listing) |
| `mobile/assets/adaptive-icon.png` | 1024x1024 | Android adaptive icon foreground — should have padding (~30% safe zone) since Android crops it into circles/squircles |
| `mobile/assets/splash-icon.png` | 200x200 | Splash screen logo |
| `mobile/assets/favicon.png` | 48x48 | Web export favicon |

### 2. Verify app.json references (already correct)

`mobile/app.json` already points to the right paths:
- `icon`: `./assets/icon.png`
- `android.adaptiveIcon.foregroundImage`: `./assets/adaptive-icon.png`
- `splash.image`: `./assets/splash-icon.png`
- `splash.backgroundColor`: `#1a1a2e` (already matches)
- `web.favicon`: `./assets/favicon.png`

### 3. Android adaptive icon note

For `adaptive-icon.png`, the "jk" letters should be centered with ~30% padding around edges. Android will mask the icon into various shapes (circle, squircle, rounded square). The `backgroundColor` in app.json is already `#1a1a2e` so the foreground image should have a transparent background with just the letters, OR be the full design with extra padding.

Simpler approach: just use the same 1024x1024 render with generous padding built in. The `backgroundColor` field handles the rest.

## Implementation

```bash
# Can use macOS sips or install sharp for Node:
# Option A: Use a quick Node script with sharp
npm install -D sharp
node -e "
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('public/favicon.svg');
const sizes = [
  { file: 'mobile/assets/icon.png', size: 1024 },
  { file: 'mobile/assets/splash-icon.png', size: 200 },
  { file: 'mobile/assets/favicon.png', size: 48 },
];
sizes.forEach(({ file, size }) => {
  sharp(svg).resize(size, size).png().toFile(file);
});
// Adaptive icon with padding
sharp(svg).resize(680, 680).extend({
  top: 172, bottom: 172, left: 172, right: 172,
  background: { r: 26, g: 26, b: 46, alpha: 1 }
}).png().toFile('mobile/assets/adaptive-icon.png');
"
```

## Done when

- All four PNGs replaced with the jk logo
- `npx expo start` shows the correct icon
- Android adaptive icon doesn't clip the letters
