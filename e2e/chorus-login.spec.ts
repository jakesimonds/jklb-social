import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginWithOAuth, loadTestCredentials, logout } from './helpers/login';

/**
 * BUG-CHORUS-01 Reproduction Test
 *
 * Tests whether the Like Chorus appears immediately after OAuth login
 * without needing a page refresh.
 *
 * The bug: On first login, chorus grid doesn't appear. After refresh, it does.
 *
 * Run with: npx playwright test e2e/chorus-login.spec.ts
 */

const SCREENSHOT_DIR = './screenshots/chorus-login-bug';

// Ensure screenshot directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('BUG-CHORUS-01: Chorus visibility after login', () => {
  // OAuth can be slow
  test.setTimeout(120000);

  test('chorus should appear immediately after fresh OAuth login (BUG REPRO)', async ({ page }) => {
    const credentials = loadTestCredentials();
    if (!credentials) {
      test.skip(true, 'No credentials in test-credentials.json');
      return;
    }

    // Set viewport to wide mode where chorus is visible
    await page.setViewportSize({ width: 1200, height: 900 });

    // Step 1: Clear all storage to simulate fresh user
    console.log('Step 1: Clearing storage for fresh login...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-cleared-storage.png'),
      fullPage: true,
    });

    // Step 2: Reload to apply cleared storage
    console.log('Step 2: Reloading with cleared storage...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-fresh-state.png'),
      fullPage: true,
    });

    // Step 3: Perform OAuth login
    console.log('Step 3: Performing OAuth login...');
    const success = await loginWithOAuth(page, credentials);

    if (!success) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-login-failed.png'),
        fullPage: true,
      });
      test.skip(true, 'OAuth login failed - network/external service issue');
      return;
    }

    // Step 4: Wait for feed to stabilize (but NOT refresh)
    console.log('Step 4: Waiting for feed to load after login...');
    await page.waitForTimeout(5000); // Give time for all effects to run

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-after-login-no-refresh.png'),
      fullPage: true,
    });

    // Step 5: Check if chorus avatars are visible (THIS IS THE BUG CHECK)
    console.log('Step 5: Checking for chorus avatars...');

    const topBar = page.locator('.area-top-bar');
    await expect(topBar).toBeVisible();

    // Look for chorus grid
    const chorusGridTop = topBar.locator('.chorus-grid-top');
    const chorusGridVisible = await chorusGridTop.isVisible().catch(() => false);
    console.log('Chorus grid top visible:', chorusGridVisible);

    // Look for any images in the chorus grid area (chorus avatars have img tags)
    const chorusAvatars = topBar.locator('.chorus-grid-top img');
    const avatarCount = await chorusAvatars.count();
    console.log('Chorus avatar count (before refresh):', avatarCount);

    // Capture the DOM state for debugging
    const topBarHTML = await topBar.innerHTML();
    console.log('Top bar HTML snippet:', topBarHTML.substring(0, 500));

    // Step 6: Now refresh and check again
    console.log('Step 6: Refreshing page...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-after-refresh.png'),
      fullPage: true,
    });

    const avatarCountAfterRefresh = await topBar.locator('.chorus-grid-top img').count();
    console.log('Chorus avatar count (after refresh):', avatarCountAfterRefresh);

    // Step 7: The actual test assertion
    // If the bug exists: avatarCount === 0 but avatarCountAfterRefresh > 0
    // If bug is fixed: avatarCount > 0 (same as after refresh)

    console.log('\n=== BUG REPRODUCTION RESULTS ===');
    console.log(`Avatars before refresh: ${avatarCount}`);
    console.log(`Avatars after refresh: ${avatarCountAfterRefresh}`);

    if (avatarCount === 0 && avatarCountAfterRefresh > 0) {
      console.log('BUG CONFIRMED: Chorus appears only after refresh');
      // This test documents the bug - it SHOULD fail when bug exists
      // When the bug is fixed, this assertion will pass
      expect(avatarCount).toBeGreaterThan(0);
    } else if (avatarCount > 0) {
      console.log('BUG NOT PRESENT: Chorus appears immediately after login');
      expect(avatarCount).toBeGreaterThan(0);
    } else {
      console.log('NO CHORUS DATA: User may have no notifications/engagements');
      // Skip if user has no chorus members at all
      test.skip(avatarCountAfterRefresh === 0, 'User has no chorus members to display');
      expect(avatarCount).toBeGreaterThan(0);
    }
  });

  test('debug: log chorus state after login', async ({ page }) => {
    const credentials = loadTestCredentials();
    if (!credentials) {
      test.skip(true, 'No credentials in test-credentials.json');
      return;
    }

    await page.setViewportSize({ width: 1200, height: 900 });

    // Clear storage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Add console listener to capture app logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Inject debugging before login
    await page.evaluate(() => {
      // Monkey-patch to log when settings are accessed
      const originalGetItem = localStorage.getItem.bind(localStorage);
      localStorage.getItem = (key: string) => {
        const value = originalGetItem(key);
        console.log(`[DEBUG] localStorage.getItem('${key}') = ${value?.substring(0, 100)}...`);
        return value;
      };
    });

    // Perform login
    const success = await loginWithOAuth(page, credentials);
    if (!success) {
      test.skip(true, 'OAuth login failed');
      return;
    }

    await page.waitForTimeout(5000);

    // Capture React state if possible
    const debugInfo = await page.evaluate(() => {
      const settingsStorage = localStorage.getItem('russabbot-settings');
      const sessionStorage = localStorage.getItem('russabbot-session');

      // Try to find chorus-related DOM elements
      const chorusGridTop = document.querySelector('.chorus-grid-top');
      const chorusImages = chorusGridTop?.querySelectorAll('img') || [];

      return {
        settings: settingsStorage ? JSON.parse(settingsStorage) : null,
        session: sessionStorage ? 'exists (not parsed for security)' : null,
        chorusGridTopExists: !!chorusGridTop,
        chorusGridTopVisible: chorusGridTop ?
          window.getComputedStyle(chorusGridTop).display !== 'none' : false,
        chorusImageCount: chorusImages.length,
        chorusGridTopClasses: chorusGridTop?.className || '',
      };
    });

    console.log('\n=== DEBUG INFO ===');
    console.log('Settings from localStorage:', JSON.stringify(debugInfo.settings, null, 2));
    console.log('Session exists:', debugInfo.session);
    console.log('Chorus grid top exists:', debugInfo.chorusGridTopExists);
    console.log('Chorus grid top visible:', debugInfo.chorusGridTopVisible);
    console.log('Chorus image count:', debugInfo.chorusImageCount);
    console.log('Chorus grid classes:', debugInfo.chorusGridTopClasses);

    console.log('\n=== CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'debug-after-login.png'),
      fullPage: true,
    });

    // This test is for debugging, always pass
    expect(true).toBe(true);
  });
});
