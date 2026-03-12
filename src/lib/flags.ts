/**
 * Development and test flags for russAbbot
 *
 * These flags control dev/test behavior across the app.
 * Set to false for production use.
 */

/**
 * UI Testing Mode
 * When true, front-loads known tricky rendering posts for testing.
 * Automatically enabled in development, disabled in production.
 * Can override with VITE_UI_TESTING_MODE=true|false
 */
export const UI_TESTING_MODE =
  import.meta.env.VITE_UI_TESTING_MODE === 'true' ||
  (import.meta.env.VITE_UI_TESTING_MODE !== 'false' && import.meta.env.DEV);

/**
 * Test Notifications Mode
 * When true, injects fake notifications to test notification UI/indicators.
 * Fake notifications appear as "new" with recent timestamps.
 * Automatically enabled in development, disabled in production.
 * Can override with VITE_TEST_NOTIFICATIONS=true|false
 */
export const TEST_NOTIFICATIONS =
  import.meta.env.VITE_TEST_NOTIFICATIONS === 'true';

/**
 * Profile Picture Size (in pixels)
 * Controls the avatar size in PostCard.
 * Try different values: 256, 384, 512, etc.
 */
export const PROFILE_PIC_SIZE = 300;

/**
 * JKLB Premium
 * Whitelisted handles that get the Premium feed experience.
 */
const JKLB_PREMIUM_HANDLES: string[] = [];

export function isJklbPremium(handle: string | undefined): boolean {
  return handle != null && JKLB_PREMIUM_HANDLES.includes(handle);
}
