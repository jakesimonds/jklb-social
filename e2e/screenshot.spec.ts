import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginWithOAuth, loadTestCredentials } from './helpers/login';

/**
 * russAbbot Screenshot Tests
 *
 * RALPH AGENT RULES:
 * 1. These tests are for UI VERIFICATION ONLY
 * 2. DO NOT modify tests to interact with real Bluesky accounts
 * 3. Only use the test account credentials from test-credentials.json
 * 4. DO NOT post, like, repost, follow, or DM real users
 * 5. Focus on: layout, styling, component rendering, navigation
 * 6. Screenshots are saved to ./screenshots/ for visual review
 *
 * TWO AUTH MODES:
 * A) Stored auth state (faster): Run `npm run test:save-auth` first, then tests use saved localStorage
 * B) Auto OAuth login (slower): Fill in test-credentials.json, tests do full OAuth flow each time
 *
 * Usage:
 * - npx playwright test                    # Run all tests
 * - npx playwright test screenshot.spec.ts # Run screenshot tests
 * - npx playwright test --ui               # Open interactive UI
 */

const SCREENSHOT_DIR = './screenshots';

// Ensure screenshot directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// Run tests serially to avoid race conditions with auth state
test.describe.configure({ mode: 'serial' });

test.describe('Unauthenticated UI', () => {
  test('capture login modal', async ({ page }) => {
    // Skip this test when auth state exists - it's a utility for capturing login UI
    // and conflicts with parallel test execution when auth state is present
    const AUTH_STATE_PATH = './e2e/auth-state.json';
    if (fs.existsSync(AUTH_STATE_PATH)) {
      test.skip(true, 'Skipping unauthenticated test when auth state exists - run in isolation if needed');
    }

    // Navigate to app
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for the login modal to appear
    await page.waitForSelector('text=Sign in', { timeout: 10000 });

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'login-modal.png'),
      fullPage: true,
    });

    // Verify login modal elements exist
    await expect(page.locator('input[placeholder*="handle"]')).toBeVisible();
  });
});

test.describe('Authenticated UI', () => {
  // Auth can come from:
  // 1. Stored auth state (faster) - from npm run test:save-auth
  // 2. Auto OAuth login (slower) - from test-credentials.json
  const AUTH_STATE_PATH = './e2e/auth-state.json';

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

  test('capture main feed view', async ({ page }) => {
    // Wait for feed to render - look for any post article
    await page.waitForSelector('article[data-post-uri], article', { timeout: 15000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'main-feed.png'),
      fullPage: true,
    });
  });

  test('capture with highlighted slot', async ({ page }) => {
    // Wait for content
    await page.waitForTimeout(2000);

    // Press arrow keys to highlight different slots
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'highlighted-slot.png'),
      fullPage: true,
    });
  });

  test('capture settings modal', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Open settings using 's' key (same as modal tests)
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'settings-modal.png'),
      fullPage: true,
    });
  });

  test('capture notifications modal', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Press 'n' for notifications
    await page.keyboard.press('n');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'notifications-modal.png'),
      fullPage: true,
    });
  });

  test('capture hotkeys modal', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Press space for hotkeys
    await page.keyboard.press(' ');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hotkeys-modal.png'),
      fullPage: true,
    });
  });

  test('navigate posts with j/k', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'post-1.png'),
      fullPage: true,
    });

    // Navigate to next post
    await page.keyboard.press('j');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'post-2.png'),
      fullPage: true,
    });

    // Navigate to next post
    await page.keyboard.press('j');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'post-3.png'),
      fullPage: true,
    });
  });
});

// Utility test to capture current state (run manually)
test.describe('Manual capture', () => {
  test.skip('capture current state', async ({ page }) => {
    // This test is skipped by default
    // Un-skip and run when you need a quick screenshot of current state
    await page.goto('/');
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'current-state.png'),
      fullPage: true,
    });
  });
});

// Layout review tests for TASK-PC-04
// Captures screenshots at 1200px (wide) and 800px (narrow) widths
test.describe('Layout Review', () => {
  const AUTH_STATE_PATH = './e2e/auth-state.json';
  const TEST_POST_COUNT = 16; // Number of test posts hardcoded in feed.ts

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

  test('capture all posts at 1200px wide', async ({ page }) => {
    // Set viewport to 1200px (wide mode)
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);

    // Capture each test post
    for (let i = 1; i <= TEST_POST_COUNT; i++) {
      // Check for and dismiss "Moment of Reflection" modal
      try {
        const skipButton = page.locator('text=Skip');
        if (await skipButton.isVisible({ timeout: 200 })) {
          await skipButton.click();
          await page.waitForTimeout(300);
        }
      } catch {
        // No modal
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `layout-wide-post-${i}.png`),
        fullPage: false, // Capture just the viewport
      });

      // Navigate to next post (except on last one)
      if (i < TEST_POST_COUNT) {
        await page.keyboard.press('k');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('capture all posts at 800px narrow', async ({ page }) => {
    // Set viewport to 800px (narrow mode)
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(2000);

    // Capture each test post
    for (let i = 1; i <= TEST_POST_COUNT; i++) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `layout-narrow-post-${i}.png`),
        fullPage: false, // Capture just the viewport
      });

      // Navigate to next post (except on last one)
      if (i < TEST_POST_COUNT) {
        await page.keyboard.press('k');
        await page.waitForTimeout(1000);
      }
    }
  });
});

// Feed exploration test for TASK 4.5
// Navigates through more posts to find layout issues
test.describe('Feed Exploration', () => {
  const AUTH_STATE_PATH = './e2e/auth-state.json';
  const EXPLORE_COUNT = 30; // Explore 30 posts total

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

  test('explore feed and capture posts with layout issues', async ({ page }) => {
    // This test explores many posts - needs longer timeout
    test.setTimeout(120000);

    // Set viewport to 1200px (wide mode) to see layout issues
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);

    // Close any modals that might be open (like "Moment of Reflection")
    // Try clicking Skip button if the modal is open
    try {
      const skipButton = page.locator('text=Skip');
      if (await skipButton.isVisible({ timeout: 1000 })) {
        await skipButton.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // Modal not present, continue
    }

    // Also press Escape to close any other modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Navigate through posts and capture screenshots
    for (let i = 1; i <= EXPLORE_COUNT; i++) {
      // Check if modal appeared and skip it
      try {
        const skipButton = page.locator('text=Skip');
        if (await skipButton.isVisible({ timeout: 200 })) {
          await skipButton.click();
          await page.waitForTimeout(300);
        }
      } catch {
        // No modal, continue
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `explore-post-${i}.png`),
        fullPage: false,
      });

      // Navigate to next post
      await page.keyboard.press('k');
      await page.waitForTimeout(800);
    }

    console.log(`Captured ${EXPLORE_COUNT} posts for layout review`);
  });

  test('extract post URLs for test harness', async ({ page }) => {
    // This test explores many posts - needs longer timeout
    test.setTimeout(120000);

    // Set viewport to wide mode
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(2000);

    // Close any modals
    try {
      const skipButton = page.locator('text=Skip');
      if (await skipButton.isVisible({ timeout: 1000 })) {
        await skipButton.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // Modal not present
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Intercept window.open to capture URLs from 'v' key
    const capturedUrls: string[] = [];
    await page.exposeFunction('captureUrl', (url: string) => {
      capturedUrls.push(url);
    });

    await page.evaluate(() => {
      const originalOpen = window.open;
      window.open = function(url?: string | URL, target?: string, features?: string) {
        if (url && typeof url === 'string' && url.includes('bsky.app')) {
          // @ts-ignore - exposed function
          window.captureUrl(url);
          return null; // Don't actually open the window
        }
        return originalOpen.call(window, url, target, features);
      };
    });

    // Navigate through posts and capture URLs using 'v' key
    for (let i = 1; i <= 30; i++) {
      // Check for and dismiss modal before each action
      try {
        const skipButton = page.locator('text=Skip');
        if (await skipButton.isVisible({ timeout: 100 })) {
          await skipButton.click();
          await page.waitForTimeout(200);
        }
      } catch {
        // No modal
      }

      // Press 'v' to trigger URL capture
      await page.keyboard.press('v');
      await page.waitForTimeout(200);

      // Check for modal again
      try {
        const skipButton = page.locator('text=Skip');
        if (await skipButton.isVisible({ timeout: 100 })) {
          await skipButton.click();
          await page.waitForTimeout(200);
        }
      } catch {
        // No modal
      }

      // Navigate to next post
      await page.keyboard.press('k');
      await page.waitForTimeout(600);
    }

    // Output captured URLs
    console.log('\n=== CAPTURED POST URLS ===');
    capturedUrls.forEach((url, i) => {
      console.log(`${i + 1}. ${url}`);
    });
    console.log('=== END URLS ===\n');

    // Write URLs to a file for easy reference
    const fs = await import('fs');
    fs.writeFileSync('./screenshots/post-urls.txt', capturedUrls.join('\n'));
    console.log(`Saved ${capturedUrls.length} URLs to screenshots/post-urls.txt`);
  });
});
