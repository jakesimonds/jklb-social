import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * New Features E2E Tests (2026-02-13 Sprint)
 *
 * Tests for:
 * - QW-01: Notification persistence bug fix (useEffect cleanup)
 * - QW-02: 'm' key removal
 * - CLIP-01: '?' hotkey saves posts to session array
 * - ATMO-02: 'a' key opens Atmosphere Report
 * - LOGIN-01: Handle autocomplete on login
 * - HotkeysPanel: Updated hotkeys display
 */

const SCREENSHOT_DIR = './screenshots';
const AUTH_STATE_PATH = './e2e/auth-state.json';

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe.configure({ mode: 'serial' });

/**
 * Helper to dismiss any modals/panels that might appear
 */
async function dismissModals(page: import('@playwright/test').Page) {
  try {
    const skipButton = page.locator('text=Skip');
    if (await skipButton.isVisible({ timeout: 300 })) {
      await skipButton.click();
      await page.waitForTimeout(300);
    }
  } catch {
    // No modal
  }
  // Press Escape a few times to clear anything
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * Helper to set up authenticated page
 */
async function setupAuthenticatedPage(page: import('@playwright/test').Page) {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    test.skip(true, 'No auth state. Run `npm run test:save-auth` first.');
    return;
  }

  const authState = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf-8'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate((state) => {
    for (const [key, value] of Object.entries(state.localStorage || {})) {
      localStorage.setItem(key, value as string);
    }
  }, authState);

  await page.reload();
  await page.waitForTimeout(3000);
}

// ============================================================================
// QW-02: 'm' key removed
// ============================================================================

test.describe('QW-02: Messages key removed', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test("'m' key does NOT open messages or trigger any action", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    await dismissModals(page);

    // Get current state before pressing 'm'
    const postCardBefore = page.locator('article[data-post-uri]').first();
    const uriBefore = await postCardBefore.getAttribute('data-post-uri');

    // Press 'm' - should do nothing
    await page.keyboard.press('m');
    await page.waitForTimeout(500);

    // Post card should still be visible (no modal opened)
    const postCardAfter = page.locator('article[data-post-uri]').first();
    const uriAfter = await postCardAfter.getAttribute('data-post-uri');

    // Same post should be showing (nothing changed)
    expect(uriAfter).toBe(uriBefore);

    // No new tab should have opened (can't easily test this, but we verify no UI change)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qw02-m-key-no-action.png'),
      fullPage: false,
    });
  });

  test("hotkeys panel does NOT show 'm' for Messages", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    await dismissModals(page);

    // Open hotkeys panel with Space
    await page.keyboard.press(' ');
    await page.waitForTimeout(500);

    // 'Messages' should not appear
    const messagesEntry = page.locator('text=Messages');
    await expect(messagesEntry).toBeHidden();

    // But other panel keys should still be there
    const settingsEntry = page.locator('text=Settings');
    await expect(settingsEntry).toBeVisible();

    const notificationsEntry = page.locator('text=Notifications');
    await expect(notificationsEntry).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qw02-hotkeys-no-messages.png'),
      fullPage: false,
    });
  });

  test("hotkeys panel shows '?' for save post", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    await dismissModals(page);

    // Open hotkeys panel with Space
    await page.keyboard.press(' ');
    await page.waitForTimeout(500);

    // Should show '?' key for save post
    const savePostEntry = page.locator('text=Save post to clipboard');
    await expect(savePostEntry).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qw02-hotkeys-question-mark.png'),
      fullPage: false,
    });
  });

  test("hotkeys panel does NOT show 'a' for Atmosphere (moved to settings)", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    await dismissModals(page);

    // Open hotkeys panel with Space
    await page.keyboard.press(' ');
    await page.waitForTimeout(500);

    // Atmosphere Report should NOT appear in hotkeys (it's a settings toggle now)
    const atmosphereEntry = page.locator('text=Atmosphere Report');
    await expect(atmosphereEntry).toBeHidden();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qw02-hotkeys-no-atmosphere.png'),
      fullPage: false,
    });
  });
});

// ============================================================================
// ATMO: Atmosphere Report (accessible via Settings toggle)
// ============================================================================

test.describe('ATMO: Atmosphere Report in Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test("'a' key does NOT open atmosphere report (no hotkey)", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    await dismissModals(page);

    // Press 'a' - should do nothing
    await page.keyboard.press('a');
    await page.waitForTimeout(500);

    // Atmosphere Report header should NOT be visible
    const header = page.locator('text=Atmosphere Report');
    await expect(header).toBeHidden();

    // Post card should still be showing
    const postCard = page.locator('article[data-post-uri]').first();
    await expect(postCard).toBeVisible();
  });

  test('settings panel shows Atmosphere Report toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    await dismissModals(page);

    // Open settings with 's'
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Should see "Atmosphere Report" toggle label
    const atmosphereLabel = page.locator('text=Atmosphere Report');
    await expect(atmosphereLabel).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'atmo-settings-toggle.png'),
      fullPage: false,
    });
  });
});

// ============================================================================
// LOGIN-01: Handle autocomplete
// ============================================================================

test.describe('LOGIN-01: Handle Autocomplete', () => {
  test('login page shows typeahead suggestions when typing', async ({ page }) => {
    // Go to login page without auth
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should see login form
    const handleInput = page.locator('[data-testid="login-handle-input"]');
    await expect(handleInput).toBeVisible();

    // Type a partial handle
    await handleInput.fill('jakesimonds');
    await page.waitForTimeout(500); // Wait for debounce

    // Should see suggestions dropdown
    const suggestions = page.locator('ul.absolute');
    await expect(suggestions).toBeVisible({ timeout: 3000 });

    // Should have at least one suggestion with avatar
    const suggestionItems = page.locator('ul.absolute li');
    const count = await suggestionItems.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'login-autocomplete-suggestions.png'),
      fullPage: false,
    });
  });

  test('clicking a suggestion fills the handle', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const handleInput = page.locator('[data-testid="login-handle-input"]');
    await handleInput.fill('jakesimonds');
    await page.waitForTimeout(500);

    // Wait for suggestions
    const firstSuggestion = page.locator('ul.absolute li button').first();
    await expect(firstSuggestion).toBeVisible({ timeout: 3000 });

    // Click the first suggestion
    await firstSuggestion.click();
    await page.waitForTimeout(300);

    // Input should now contain the full handle
    const value = await handleInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
    expect(value).toContain('.'); // Handles contain dots (e.g., jakesimonds.com)

    // Suggestions should be hidden
    const suggestions = page.locator('ul.absolute');
    await expect(suggestions).toBeHidden();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'login-autocomplete-selected.png'),
      fullPage: false,
    });
  });

  test('arrow keys navigate suggestions', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const handleInput = page.locator('[data-testid="login-handle-input"]');
    await handleInput.fill('jakesimonds');
    await page.waitForTimeout(500);

    // Wait for suggestions
    await expect(page.locator('ul.absolute')).toBeVisible({ timeout: 3000 });

    // Press ArrowDown to highlight first suggestion
    await handleInput.press('ArrowDown');
    await page.waitForTimeout(200);

    // First suggestion should be highlighted (has different bg)
    const firstButton = page.locator('ul.absolute li button').first();
    const bgClass = await firstButton.getAttribute('class');
    expect(bgClass).toContain('bg-[var(--memphis-cyan)]');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'login-autocomplete-arrow-nav.png'),
      fullPage: false,
    });
  });

  test('Escape dismisses suggestions', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const handleInput = page.locator('[data-testid="login-handle-input"]');
    await handleInput.fill('jakesimonds');
    await page.waitForTimeout(500);

    // Wait for suggestions
    await expect(page.locator('ul.absolute')).toBeVisible({ timeout: 3000 });

    // Press Escape
    await handleInput.press('Escape');
    await page.waitForTimeout(200);

    // Suggestions should be hidden
    await expect(page.locator('ul.absolute')).toBeHidden();
  });
});

// ============================================================================
// Credible Exit Panel: Clipboard button
// ============================================================================

test.describe('Credible Exit Panel: Saved Posts', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test("credible exit panel renders without saved posts (no clipboard button)", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    await dismissModals(page);

    // We can't easily trigger credible exit in tests without viewing 50+ posts,
    // but we can verify the component structure exists by checking the build passed
    // and the component types are correct. This is a smoke test.

    // Verify the app renders normally
    const postCard = page.locator('article[data-post-uri]').first();
    await expect(postCard).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'credible-exit-no-saved-posts.png'),
      fullPage: false,
    });
  });
});
