# Camera Capture Modal

**Skyboard**: 3mg34td (idea only → scaffolded)
**Effort**: Small-medium (Ralph-able)
**Platform**: Mobile only (React Native / Expo)

## Overview

After the user finishes their post budget, the mobile end flow presents two buttons: "Feeling cute" (front camera) and "Postcards" (back camera). Tapping either opens a camera capture flow.

This spec covers ONLY the camera capture piece — not the end flow screen itself or the posting logic.

**Important: The mobile app has its own end flow, separate from the web app's `useEndFlow.ts` / `CredibleExitPanel.tsx`.** The mobile end flow is loosely inspired by the web version but is a distinct implementation living entirely under `mobile/`. Do not reuse or modify the web end flow code — build the mobile end flow from scratch within the React Native codebase.

## Approach: `<input capture>` vs getUserMedia

**Use `<input type="file" capture>`**. It's simpler, more reliable across mobile browsers, and doesn't require camera permissions prompts that we manage ourselves. The OS handles the camera UI.

- `capture="user"` → front camera
- `capture="environment"` → back camera
- `accept="image/jpeg,image/png"`

The user takes the photo in the native camera app, it comes back as a File object — same flow as the image attachment we just built for the reply modal.

## Implementation

### File: `mobile/components/CameraCapture.tsx`

A modal component that:
1. Receives which camera to use (`"user"` or `"environment"`)
2. Shows a hidden `<input type="file" capture="..." accept="image/*">` that auto-triggers on mount
3. When the user takes/selects a photo, shows a preview
4. Two buttons: "Retake" (re-triggers input) and "Use Photo" (calls onConfirm with the File)
5. "X" to cancel entirely

```tsx
interface CameraCaptureProps {
  camera: 'user' | 'environment';
  onConfirm: (photo: File) => void;
  onCancel: () => void;
}
```

### UI States

1. **Waiting** — input has been triggered, waiting for user to take photo (might show a brief "opening camera..." message but the OS handles the actual camera)
2. **Preview** — photo taken, showing preview with Retake / Use Photo buttons
3. **Cancelled** — user dismissed the camera without taking a photo → call onCancel

### Key details

- Auto-trigger the file input on mount via `inputRef.current?.click()` in a useEffect
- Listen for the `change` event to get the File
- Listen for the input being cancelled (no file selected) — browsers fire a `cancel` event on the input
- Preview uses `URL.createObjectURL(file)` same as reply modal
- Clean up object URLs on unmount

### Aspect ratio

Read dimensions from the photo using `new Image()` + `naturalWidth/naturalHeight` (same helper as `getImageDimensions` in actions.ts) before passing to the post flow. This ensures Bluesky gets explicit aspect ratio.

## Integration point

The mobile end flow screen will render this component in `mobile/app/end.tsx` (or equivalent):
```tsx
{showCamera && (
  <CameraCapture
    camera={cameraMode}  // 'user' for feeling cute, 'environment' for postcards
    onConfirm={(photo) => handlePhotoTaken(photo)}
    onCancel={() => setShowCamera(false)}
  />
)}
```

The `handlePhotoTaken` function will then call the community post worker.

**Note:** The `<input type="file" capture>` approach works in mobile web browsers. For React Native, use `expo-image-picker` with `launchCameraAsync()` instead — same UX (OS handles the camera), different API. Set `cameraType` to `CameraType.front` or `CameraType.back` accordingly.

## Done when

- Tapping triggers the native camera on mobile
- Front camera opens for "user", back camera for "environment"
- Photo preview shows after capture
- Retake re-opens camera
- "Use Photo" returns the File to the parent
- Cancel/dismiss works cleanly
