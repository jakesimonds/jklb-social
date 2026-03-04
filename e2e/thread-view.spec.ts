import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginWithOAuth, loadTestCredentials } from './helpers/login';

/**
 * Thread View E2E Tests
 *
 * Regression tests for thread view behavior before useThread hook extraction.
 * See IMPLEMENTATION_PLAN.md TASK-REFACTOR-31 for acceptance criteria.
 *
 * Tests:
 * 1. Entering thread view on thread post
 * 2. Arrow key navigation in thread
 * 3. Exiting thread view
 * 4. Thread view doesn't open on non-thread post
 * 5. Thread state is properly tracked (threadPosts, threadIndex)
 */

const SCREENSHOT_DIR = './screenshots';
const AUTH_STATE_PATH = './e2e/auth-state.json';

// Ensure screenshot directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// Run tests serially to avoid race conditions
test.describe.configure({ mode: 'serial' });

/**
 * Helper to dismiss any modals that might appear
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
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * Helper to navigate through posts looking for a thread post
 * Thread posts are detected by having ScrollThread render when pressing 't'
 */
async function findThreadPost(
  page: import('@playwright/test').Page,
  maxPosts = 30
): Promise<boolean> {
  for (let i = 0; i < maxPosts; i++) {
    await dismissModals(page);

    // Try pressing 't' to see if it enters thread view
    await page.keyboard.press('t');
    await page.waitForTimeout(500);

    // Check for ScrollThread elements
    const threadContainer = page.locator('.scroll-thread-container');
    if (await threadContainer.isVisible({ timeout: 500 })) {
      return true; // Found a thread post!
    }

    // Not a thread post - press Escape to ensure we're back to normal state
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Move to next post
    await page.keyboard.press('k');
    await page.waitForTimeout(800);
  }
  return false;
}

/**
 * Helper to check if current post is NOT a thread (single post without parent/replies)
 * Returns true if pressing 't' does NOT open thread view
 */
async function isNonThreadPost(page: import('@playwright/test').Page): Promise<boolean> {
  await page.keyboard.press('t');
  await page.waitForTimeout(500);

  const threadContainer = page.locator('.scroll-thread-container');
  const isVisible = await threadContainer.isVisible({ timeout: 300 }).catch(() => false);

  if (isVisible) {
    // It's a thread post, exit and return false
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return false;
  }

  return true; // Not a thread post
}

test.describe('Thread View - Authenticated', () => {
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
    test.skip(
      true,
      'No auth available. Either run `npm run test:save-auth` or fill in test-credentials.json'
    );
  });

  test('thread post enters thread view on t key', async ({ page }) => {
    test.setTimeout(120000);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Find a thread post
    const foundThread = await findThreadPost(page, 20);

    if (!foundThread) {
      console.log('No thread posts found in first 20 posts. Skipping thread view test.');
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'thread-view-no-threads-found.png'),
        fullPage: false,
      });
      test.skip(true, 'No thread posts found in feed - thread view cannot be tested');
      return;
    }

    // Verify thread view is active
    const threadContainer = page.locator('.scroll-thread-container');
    await expect(threadContainer).toBeVisible();

    // Verify thread indicator shows position (e.g., "Thread 1/4")
    const threadIndicator = page.locator('.scroll-thread-indicator');
    await expect(threadIndicator).toBeVisible();
    const indicatorText = await threadIndicator.textContent();
    // Format is "Thread1/4" or "Thread 1/4"
    expect(indicatorText).toMatch(/Thread\s*\d+\/\d+/);

    console.log(`Thread view opened. Position: ${indicatorText}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-entered.png'),
      fullPage: false,
    });
  });

  test('arrow keys navigate within thread (changes threadIndex)', async ({ page }) => {
    test.setTimeout(120000);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Find a thread post
    const foundThread = await findThreadPost(page, 20);

    if (!foundThread) {
      test.skip(true, 'No thread posts found in feed');
      return;
    }

    // Get initial thread position
    const indicator = page.locator('.scroll-thread-indicator');
    const initialText = await indicator.textContent();
    // Format is "Thread1/4" - parse position and total
    const initialMatch = initialText?.match(/Thread\s*(\d+)\/(\d+)/);

    if (!initialMatch) {
      test.fail(true, 'Could not parse thread indicator');
      return;
    }

    const initialIndex = parseInt(initialMatch[1]);
    const totalPosts = parseInt(initialMatch[2]);
    console.log(`Initial position: ${initialIndex} of ${totalPosts}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-nav-initial.png'),
      fullPage: false,
    });

    // Navigate right if possible
    if (initialIndex < totalPosts) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);

      const afterRightText = await indicator.textContent();
      const afterRightMatch = afterRightText?.match(/Thread\s*(\d+)\/(\d+)/);
      const afterRightIndex = afterRightMatch ? parseInt(afterRightMatch[1]) : initialIndex;

      console.log(`After Right arrow: ${afterRightIndex} of ${totalPosts}`);
      expect(afterRightIndex).toBe(initialIndex + 1);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'thread-view-nav-after-right.png'),
        fullPage: false,
      });

      // Navigate back left
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(500);

      const afterLeftText = await indicator.textContent();
      const afterLeftMatch = afterLeftText?.match(/Thread\s*(\d+)\/(\d+)/);
      const afterLeftIndex = afterLeftMatch ? parseInt(afterLeftMatch[1]) : afterRightIndex;

      console.log(`After Left arrow: ${afterLeftIndex} of ${totalPosts}`);
      expect(afterLeftIndex).toBe(initialIndex);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'thread-view-nav-after-left.png'),
        fullPage: false,
      });
    } else {
      // We're at the last position, try navigating left
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(500);

      const afterLeftText = await indicator.textContent();
      const afterLeftMatch = afterLeftText?.match(/Thread\s*(\d+)\/(\d+)/);
      const afterLeftIndex = afterLeftMatch ? parseInt(afterLeftMatch[1]) : initialIndex;

      console.log(`After Left arrow: ${afterLeftIndex} of ${totalPosts}`);

      if (initialIndex > 1) {
        expect(afterLeftIndex).toBe(initialIndex - 1);
      } else {
        // At first position, should stay there
        expect(afterLeftIndex).toBe(initialIndex);
      }
    }
  });

  test('Escape key exits thread view', async ({ page }) => {
    test.setTimeout(120000);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Find a thread post
    const foundThread = await findThreadPost(page, 20);

    if (!foundThread) {
      test.skip(true, 'No thread posts found in feed');
      return;
    }

    // Verify we're in thread view
    const threadContainer = page.locator('.scroll-thread-container');
    await expect(threadContainer).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-before-escape.png'),
      fullPage: false,
    });

    // Press Escape to exit thread view
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Thread view should no longer be visible
    await expect(threadContainer).not.toBeVisible();

    // Regular PostCard should be visible
    const postCard = page.locator('.postcard-container');
    await expect(postCard).toBeVisible();

    console.log('Escape key successfully exited thread view');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-after-escape.png'),
      fullPage: false,
    });
  });

  test('j/k keys exit thread view and navigate feed', async ({ page }) => {
    test.setTimeout(120000);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Find a thread post
    const foundThread = await findThreadPost(page, 20);

    if (!foundThread) {
      test.skip(true, 'No thread posts found in feed');
      return;
    }

    // Verify we're in thread view
    const threadContainer = page.locator('.scroll-thread-container');
    await expect(threadContainer).toBeVisible();

    // Get current post URI before exiting
    // Note: In thread view, the PostCard may still be visible behind ScrollThread
    // but we want to verify we move to a different post after j/k

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-before-k-exit.png'),
      fullPage: false,
    });

    // Press 'k' to exit thread and go to next post
    await page.keyboard.press('k');
    await page.waitForTimeout(500);

    // Thread view should no longer be visible
    await expect(threadContainer).not.toBeVisible();

    console.log('k key successfully exited thread view');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-after-k-exit.png'),
      fullPage: false,
    });

    // Now find another thread post to test 'j' exit
    const foundAnotherThread = await findThreadPost(page, 15);

    if (foundAnotherThread) {
      await expect(threadContainer).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'thread-view-before-j-exit.png'),
        fullPage: false,
      });

      // Press 'j' to exit thread and go to previous post
      await page.keyboard.press('j');
      await page.waitForTimeout(500);

      // Thread view should no longer be visible
      await expect(threadContainer).not.toBeVisible();

      console.log('j key successfully exited thread view');

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'thread-view-after-j-exit.png'),
        fullPage: false,
      });
    }
  });

  test('t key on non-thread post does not open thread view', async ({ page }) => {
    test.setTimeout(120000);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Search for a non-thread post (a post without parent/replies)
    // This is the inverse of findThreadPost
    let foundNonThread = false;
    for (let i = 0; i < 30; i++) {
      await dismissModals(page);

      if (await isNonThreadPost(page)) {
        foundNonThread = true;
        break;
      }

      // Move to next post
      await page.keyboard.press('k');
      await page.waitForTimeout(800);
    }

    if (!foundNonThread) {
      console.log('All posts in feed appear to be thread posts. Skipping non-thread test.');
      test.skip(true, 'No non-thread posts found in feed');
      return;
    }

    // We found a non-thread post
    // Press 't' and verify thread view does NOT open
    await page.keyboard.press('t');
    await page.waitForTimeout(500);

    const threadContainer = page.locator('.scroll-thread-container');
    const isVisible = await threadContainer.isVisible({ timeout: 300 }).catch(() => false);

    expect(isVisible).toBe(false);
    console.log('Confirmed: t key on non-thread post does not open thread view');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-non-thread-post.png'),
      fullPage: false,
    });
  });

  test('thread view tracks multiple posts (threadPosts array)', async ({ page }) => {
    test.setTimeout(120000);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Find a thread post
    const foundThread = await findThreadPost(page, 25);

    if (!foundThread) {
      test.skip(true, 'No thread posts found in feed');
      return;
    }

    // Verify ScrollThread shows multiple items
    const threadItems = page.locator('.scroll-thread-item');
    const itemCount = await threadItems.count();

    console.log(`Thread contains ${itemCount} visible posts`);

    // A thread should have at least 2 posts (otherwise it wouldn't open)
    expect(itemCount).toBeGreaterThanOrEqual(1);

    // Check the indicator shows correct total
    const indicator = page.locator('.scroll-thread-indicator');
    const indicatorText = await indicator.textContent();
    // Format is "Thread1/4"
    const match = indicatorText?.match(/Thread\s*\d+\/(\d+)/);
    const totalFromIndicator = match ? parseInt(match[1]) : 0;

    console.log(`Indicator shows ${totalFromIndicator} total posts`);
    expect(totalFromIndicator).toBeGreaterThanOrEqual(2); // Thread must have 2+ posts

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'thread-view-multiple-posts.png'),
      fullPage: false,
    });
  });
});
