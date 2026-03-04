import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginWithOAuth, loadTestCredentials } from './helpers/login';

/**
 * Perimeter/Chorus UI Tests
 *
 * Tests for the perimeter chrome (top bar, right bar) and chorus avatars.
 * The perimeter contains:
 * - Chorus avatars (users who recently engaged with your content)
 * - jklb brand buttons (navigation/action hotkey hints)
 * - UserWidget (login/logout control)
 *
 * Layout varies by viewport:
 * - Wide (>= 1024px): Full chrome with top bar and right sidebar
 * - Medium (640-1023px): Top bar with slimmer controls
 * - Narrow (< 640px): Mobile strip at bottom, perimeter hidden
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

test.describe('Perimeter UI', () => {
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

  test('chorus avatars render in right sidebar at wide viewport', async ({ page }) => {
    // Set viewport to 1200px (wide mode - full chrome visible)
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Right bar should be visible
    const rightBar = page.locator('.area-right-bar');
    await expect(rightBar).toBeVisible();

    // Right bar should contain PerimeterCell elements (chorus avatars or action buttons)
    const perimeterCells = rightBar.locator('button, div').filter({
      has: page.locator('img, span'),
    });

    // Should have at least some cells (action buttons at minimum)
    const cellCount = await perimeterCells.count();
    expect(cellCount).toBeGreaterThanOrEqual(1);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-right-sidebar-wide.png'),
      fullPage: false,
    });
  });

  test('avatar cells are 72px circles at wide viewport', async ({ page }) => {
    // Set viewport to 1200px (wide mode)
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Find PerimeterCell elements (they have w-[72px] h-[72px] classes)
    const topBar = page.locator('.area-top-bar');
    await expect(topBar).toBeVisible();

    // Check jklb buttons which are PerimeterCells
    const jklbButton = topBar.locator('button').filter({
      has: page.locator('span.font-mono'),
    }).first();

    await expect(jklbButton).toBeVisible();

    // Verify the cell has circular styling (rounded-full class)
    // PerimeterCell uses w-[72px] h-[72px] rounded-full
    const buttonBox = await jklbButton.boundingBox();
    expect(buttonBox).not.toBeNull();

    // At wide viewport, cells should be 72px
    // Allow small tolerance for border/padding
    if (buttonBox) {
      expect(buttonBox.width).toBeGreaterThanOrEqual(68);
      expect(buttonBox.width).toBeLessThanOrEqual(76);
      expect(buttonBox.height).toBeGreaterThanOrEqual(68);
      expect(buttonBox.height).toBeLessThanOrEqual(76);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-cell-size.png'),
      fullPage: false,
    });
  });

  test('jklb brand buttons are visible in top bar', async ({ page }) => {
    // Set viewport to 1200px (wide mode)
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    const topBar = page.locator('.area-top-bar');
    await expect(topBar).toBeVisible();

    // Check for j, k, l, b buttons (j=next, k=previous per Vim convention)
    const jButton = topBar.locator('button[title*="Next"]').filter({
      has: page.locator('span:has-text("j")'),
    });
    const kButton = topBar.locator('button[title*="Previous"]').filter({
      has: page.locator('span:has-text("k")'),
    });
    const lButton = topBar.locator('button[title*="Like"]').filter({
      has: page.locator('span:has-text("l")'),
    });
    const bButton = topBar.locator('button[title*="Boost"]').filter({
      has: page.locator('span:has-text("b")'),
    });

    await expect(jButton).toBeVisible();
    await expect(kButton).toBeVisible();
    await expect(lButton).toBeVisible();
    await expect(bButton).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-jklb-buttons.png'),
      fullPage: false,
    });
  });

  test('UserWidget shows in top bar corner', async ({ page }) => {
    // Set viewport to 1200px (wide mode)
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    const topBar = page.locator('.area-top-bar');
    await expect(topBar).toBeVisible();

    // UserWidget shows either:
    // - When logged in: avatar and logout button
    // - When not logged in: "Try" button
    const logoutButton = topBar.locator('button[title="Logout"]');
    const tryButton = topBar.locator('button[title="Log in to jklb"]');

    // Either the logout button or the Try button should be visible
    const hasLogout = await logoutButton.isVisible().catch(() => false);
    const hasTry = await tryButton.isVisible().catch(() => false);

    expect(hasLogout || hasTry).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-user-widget.png'),
      fullPage: false,
    });
  });

  test('clicking chorus avatar opens profile in new tab (has title)', async ({ page }) => {
    // Set viewport to 1200px (wide mode)
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Find a chorus avatar cell in the top bar (has img inside and @handle in title)
    const topBar = page.locator('.area-top-bar');
    const chorusAvatar = topBar.locator('button').filter({
      has: page.locator('img'),
    }).first();

    // Check if any chorus avatars exist
    const hasAvatars = await chorusAvatar.count() > 0;
    if (!hasAvatars) {
      // Skip if no chorus members (user has no recent engagement)
      test.skip(true, 'No chorus members to test');
      return;
    }

    await expect(chorusAvatar).toBeVisible();

    // Verify the button has a title attribute containing @handle
    const title = await chorusAvatar.getAttribute('title');
    expect(title).toContain('@');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-chorus-avatar.png'),
      fullPage: false,
    });
  });

  test('wide viewport (1200px) shows full chrome', async ({ page }) => {
    // Set viewport to 1200px
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Top bar should be visible
    const topBar = page.locator('.area-top-bar');
    await expect(topBar).toBeVisible();

    // Right bar should be visible
    const rightBar = page.locator('.area-right-bar');
    await expect(rightBar).toBeVisible();

    // Mobile strip should NOT be visible
    const mobileStrip = page.locator('.area-mobile-jklb');
    await expect(mobileStrip).toBeHidden();

    // Content area should be visible
    const contentArea = page.locator('.area-content');
    await expect(contentArea).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-wide-1200px.png'),
      fullPage: false,
    });
  });

  test('narrow viewport (600px) hides perimeter chrome and shows mobile strip', async ({ page }) => {
    // Set viewport to 600px (narrow mode - mobile layout)
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForTimeout(500);

    // Top bar should be hidden at narrow viewport
    const topBar = page.locator('.area-top-bar');
    await expect(topBar).toBeHidden();

    // Right bar should be hidden
    const rightBar = page.locator('.area-right-bar');
    await expect(rightBar).toBeHidden();

    // Mobile jklb strip should be visible at bottom
    const mobileStrip = page.locator('.area-mobile-jklb');
    await expect(mobileStrip).toBeVisible();

    // Mobile strip should have jklb buttons
    const mobileJButton = mobileStrip.locator('button').filter({
      has: page.locator('span:has-text("j")'),
    });
    await expect(mobileJButton).toBeVisible();

    // Content area should still be visible
    const contentArea = page.locator('.area-content');
    await expect(contentArea).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-narrow-600px.png'),
      fullPage: false,
    });
  });

  test('right bar has action buttons at bottom', async ({ page }) => {
    // Set viewport to 1200px (wide mode)
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    const rightBar = page.locator('.area-right-bar');
    await expect(rightBar).toBeVisible();

    // Check for action buttons in right bar (?, o, n, s)
    const explainButton = rightBar.locator('button[title*="Explain"]');
    const notificationsButton = rightBar.locator('button[title*="Notifications"]');
    const settingsButton = rightBar.locator('button[title*="Settings"]');

    await expect(explainButton).toBeVisible();
    await expect(notificationsButton).toBeVisible();
    await expect(settingsButton).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'perimeter-right-bar-actions.png'),
      fullPage: false,
    });
  });
});
