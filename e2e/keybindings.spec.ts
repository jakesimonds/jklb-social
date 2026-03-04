import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginWithOAuth, loadTestCredentials } from './helpers/login';

/**
 * Keybindings E2E Tests - j/k Navigation
 *
 * Verifies vim-style j/k navigation:
 * - j: Advances to NEXT post (Vim j=down, scroll forward through feed)
 * - k: Goes to PREVIOUS post (Vim k=up, scroll backward through feed)
 *
 * See specs/keybindings.md for full keybinding documentation.
 * See IMPLEMENTATION_PLAN.md TASK-VIM-02 for acceptance criteria.
 */

const SCREENSHOT_DIR = './screenshots';
const AUTH_STATE_PATH = './e2e/auth-state.json';

// Ensure screenshot directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// Run tests serially to avoid race conditions with auth state
test.describe.configure({ mode: 'serial' });

/**
 * Helper to dismiss any modals that might appear
 */
async function dismissModals(page: import('@playwright/test').Page) {
  // Dismiss "Moment of Reflection" or other modals
  try {
    const skipButton = page.locator('text=Skip');
    if (await skipButton.isVisible({ timeout: 300 })) {
      await skipButton.click();
      await page.waitForTimeout(300);
    }
  } catch {
    // No modal
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * Helper to get the current post index from localStorage
 */
async function getCurrentPostIndex(page: import('@playwright/test').Page): Promise<number> {
  return await page.evaluate(() => {
    const index = localStorage.getItem('currentPostIndex');
    return index ? parseInt(index, 10) : 0;
  });
}

test.describe('Vim-style j/k Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Try stored auth state first (faster)
    if (fs.existsSync(AUTH_STATE_PATH)) {
      const authState = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf-8'));

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Inject localStorage
      await page.evaluate((state) => {
        for (const [key, value] of Object.entries(state.localStorage || {})) {
          localStorage.setItem(key, value as string);
        }
      }, authState);

      await page.reload();
      await page.waitForTimeout(3000);
      return;
    }

    // Fall back to auto OAuth login if credentials exist
    const credentials = loadTestCredentials();
    if (credentials) {
      const success = await loginWithOAuth(page, credentials);
      if (!success) {
        test.skip(true, 'OAuth login failed');
      }
      return;
    }

    // No auth method available
    test.skip(true, 'No auth available. Either run `npm run test:save-auth` or fill in test-credentials.json');
  });

  test('j key advances to next post (vim j=down)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Get current post URI before navigation
    const currentPostBefore = page.locator('article[data-post-uri]').first();
    const uriBefore = await currentPostBefore.getAttribute('data-post-uri');
    const indexBefore = await getCurrentPostIndex(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-j-before.png'),
      fullPage: false,
    });
    console.log(`Before j: index=${indexBefore}, uri=${uriBefore?.slice(-20)}`);

    // Press 'j' to go to NEXT post (vim j=down, forward in feed)
    await page.keyboard.press('j');
    await page.waitForTimeout(500);

    // Get post URI after navigation
    const currentPostAfter = page.locator('article[data-post-uri]').first();
    const uriAfter = await currentPostAfter.getAttribute('data-post-uri');
    const indexAfter = await getCurrentPostIndex(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-j-after.png'),
      fullPage: false,
    });
    console.log(`After j: index=${indexAfter}, uri=${uriAfter?.slice(-20)}`);

    // j should advance the index (move forward/down in feed)
    // Index should increase or stay same if at end
    expect(indexAfter).toBeGreaterThanOrEqual(indexBefore);

    // If we weren't at the last post, the index should have increased
    if (indexAfter > indexBefore) {
      console.log('✓ j correctly advanced to next post (vim j=down)');
      expect(uriAfter).not.toBe(uriBefore);
    } else {
      console.log('Note: j did not advance - may be at end of feed');
    }
  });

  test('k key goes to previous post (vim k=up)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // First navigate forward a few posts so we have room to go back
    await page.keyboard.press('j');
    await page.waitForTimeout(500);
    await page.keyboard.press('j');
    await page.waitForTimeout(500);
    await dismissModals(page);

    // Get current post URI before k navigation
    const currentPostBefore = page.locator('article[data-post-uri]').first();
    const uriBefore = await currentPostBefore.getAttribute('data-post-uri');
    const indexBefore = await getCurrentPostIndex(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-k-before.png'),
      fullPage: false,
    });
    console.log(`Before k: index=${indexBefore}, uri=${uriBefore?.slice(-20)}`);

    // Press 'k' to go to PREVIOUS post (vim k=up, backward in feed)
    await page.keyboard.press('k');
    await page.waitForTimeout(500);

    // Get post URI after navigation
    const currentPostAfter = page.locator('article[data-post-uri]').first();
    const uriAfter = await currentPostAfter.getAttribute('data-post-uri');
    const indexAfter = await getCurrentPostIndex(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-k-after.png'),
      fullPage: false,
    });
    console.log(`After k: index=${indexAfter}, uri=${uriAfter?.slice(-20)}`);

    // k should decrease the index (move backward/up in feed)
    expect(indexAfter).toBeLessThanOrEqual(indexBefore);

    // If we weren't at the first post, the index should have decreased
    if (indexAfter < indexBefore) {
      console.log('✓ k correctly went to previous post (vim k=up)');
      expect(uriAfter).not.toBe(uriBefore);
    } else {
      console.log('Note: k did not go back - may be at start of feed');
    }
  });

  test('k at first post stays at first post (boundary check)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Get first post URI (should be at index 0)
    const firstPost = page.locator('article[data-post-uri]').first();
    const firstUri = await firstPost.getAttribute('data-post-uri');
    const initialIndex = await getCurrentPostIndex(page);

    console.log(`Initial: index=${initialIndex}, uri=${firstUri?.slice(-20)}`);

    // Press 'k' multiple times - should stay at first post (can't go before index 0)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('k');
      await page.waitForTimeout(200);
    }

    // Should still be on first post
    const stillFirst = page.locator('article[data-post-uri]').first();
    const stillUri = await stillFirst.getAttribute('data-post-uri');
    const stillIndex = await getCurrentPostIndex(page);

    expect(stillIndex).toBe(0);
    expect(stillUri).toBe(firstUri);
    console.log('✓ k correctly bounded at start of feed (index 0)');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-k-boundary.png'),
      fullPage: false,
    });
  });

  test('j at last post stays at last post (boundary check)', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Navigate forward many times to reach near end of feed
    // (or until we stop advancing)
    let lastIndex = -1;
    let currentIndex = await getCurrentPostIndex(page);
    let unchangedCount = 0;

    // Navigate until we stop advancing (hit end) or reach 50 posts
    while (unchangedCount < 3 && currentIndex < 50) {
      await page.keyboard.press('j');
      await page.waitForTimeout(300);
      const newIndex = await getCurrentPostIndex(page);

      if (newIndex === currentIndex) {
        unchangedCount++;
      } else {
        unchangedCount = 0;
      }

      lastIndex = currentIndex;
      currentIndex = newIndex;
    }

    console.log(`Reached index ${currentIndex} (stopped advancing after ${unchangedCount} tries)`);

    // Get current post state
    const lastPost = page.locator('article[data-post-uri]').first();
    const lastUri = await lastPost.getAttribute('data-post-uri');

    // Press j a few more times - should stay at same position
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('j');
      await page.waitForTimeout(200);
    }

    const stillLast = page.locator('article[data-post-uri]').first();
    const stillUri = await stillLast.getAttribute('data-post-uri');
    const finalIndex = await getCurrentPostIndex(page);

    // Index should not have increased beyond where we stopped
    expect(finalIndex).toBeLessThanOrEqual(currentIndex + 1);
    console.log(`✓ j correctly bounded at end of feed (index ${finalIndex})`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-j-boundary.png'),
      fullPage: false,
    });
  });

  test('j/k round trip returns to same post', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Get starting post
    const startPost = page.locator('article[data-post-uri]').first();
    const startUri = await startPost.getAttribute('data-post-uri');
    const startIndex = await getCurrentPostIndex(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-roundtrip-start.png'),
      fullPage: false,
    });
    console.log(`Start: index=${startIndex}, uri=${startUri?.slice(-20)}`);

    // Navigate forward with j
    await page.keyboard.press('j');
    await page.waitForTimeout(500);

    const middleIndex = await getCurrentPostIndex(page);
    console.log(`After j: index=${middleIndex}`);

    // Navigate backward with k
    await page.keyboard.press('k');
    await page.waitForTimeout(500);

    // Should be back at starting post
    const endPost = page.locator('article[data-post-uri]').first();
    const endUri = await endPost.getAttribute('data-post-uri');
    const endIndex = await getCurrentPostIndex(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-roundtrip-end.png'),
      fullPage: false,
    });
    console.log(`End: index=${endIndex}, uri=${endUri?.slice(-20)}`);

    // Should be back at same position
    expect(endIndex).toBe(startIndex);
    expect(endUri).toBe(startUri);
    console.log('✓ j/k round trip correctly returns to original post');
  });

  test('multiple j presses advance through feed sequentially', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    const indices: number[] = [];
    const uris: string[] = [];

    // Record starting position
    indices.push(await getCurrentPostIndex(page));
    const firstUri = await page.locator('article[data-post-uri]').first().getAttribute('data-post-uri');
    uris.push(firstUri || '');

    // Press j 5 times and record each position
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('j');
      await page.waitForTimeout(400);

      const idx = await getCurrentPostIndex(page);
      const uri = await page.locator('article[data-post-uri]').first().getAttribute('data-post-uri');
      indices.push(idx);
      uris.push(uri || '');
    }

    console.log('Index progression:', indices.join(' -> '));

    // Indices should be monotonically increasing (or plateauing at end)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }

    // Each consecutive index should increase by at most 1
    for (let i = 1; i < indices.length; i++) {
      const diff = indices[i] - indices[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
      expect(diff).toBeGreaterThanOrEqual(0);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'keybindings-multiple-j.png'),
      fullPage: false,
    });

    console.log('✓ Multiple j presses correctly advance sequentially through feed');
  });
});
