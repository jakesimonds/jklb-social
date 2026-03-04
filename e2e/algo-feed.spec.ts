import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginWithOAuth, loadTestCredentials } from './helpers/login';

/**
 * Algo Feed E2E Tests
 *
 * Tests for algorithm feed integration:
 * - Settings modal has algo feed dropdown with expected options
 * - Selecting "Discover" from dropdown works and feed loads
 * - Selecting "What's Hot" from dropdown works
 * - Selecting "None" disables algo feed
 * - Feed settings persist across modal close/reopen
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

test.describe('Algo Feed Integration', () => {
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

  test('settings modal has algo feed dropdown', async ({ page }) => {
    // Set viewport to wide mode
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Dismiss any existing modals first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Press 's' to open settings modal
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Settings modal should be visible with Feed Configuration
    const feedConfig = page.locator('text=Feed Configuration');
    await expect(feedConfig).toBeVisible();

    // Should have Algorithm Feed label
    const algoLabel = page.locator('text=Algorithm Feed (Tier 3)');
    await expect(algoLabel).toBeVisible();

    // Should have a select dropdown
    const algoDropdown = page.locator('select');
    await expect(algoDropdown).toBeVisible();

    // Dropdown should have expected options
    const options = page.locator('select option');
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain("What's Hot");
    expect(optionTexts).toContain('Discover');
    expect(optionTexts).toContain('None');
    expect(optionTexts).toContain('Custom');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'algo-feed-settings-dropdown.png'),
      fullPage: false,
    });

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('selecting Discover from algo dropdown works', async ({ page }) => {
    // Set viewport to wide mode
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Dismiss any existing modals first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open settings
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Find the algo dropdown and select "Discover"
    const algoDropdown = page.locator('select');
    await algoDropdown.selectOption({ label: 'Discover' });
    await page.waitForTimeout(300);

    // Verify selection changed
    const selectedValue = await algoDropdown.inputValue();
    expect(selectedValue).toBe('discover');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'algo-feed-discover-selected.png'),
      fullPage: false,
    });

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Wait for feed to potentially reload
    await page.waitForTimeout(2000);

    // Feed should still have posts loaded
    const postCards = page.locator('article[data-post-uri]');
    const postCount = await postCards.count();
    expect(postCount).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'algo-feed-discover-feed-loaded.png'),
      fullPage: false,
    });
  });

  test('algo feed can be set to None', async ({ page }) => {
    // Set viewport to wide mode
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Dismiss any existing modals first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open settings
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Find the algo dropdown (in Feed Configuration section)
    const algoDropdown = page.locator('select').first();
    await expect(algoDropdown).toBeVisible();

    // Select "None" from dropdown
    await algoDropdown.selectOption({ value: 'none' });
    await page.waitForTimeout(300);

    // Verify "None" is now selected
    const selectedValue = await algoDropdown.inputValue();
    expect(selectedValue).toBe('none');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'algo-feed-none-selected.png'),
      fullPage: false,
    });

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('selecting Whats Hot from algo dropdown works', async ({ page }) => {
    // Set viewport to wide mode
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Dismiss any existing modals first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open settings
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Find the algo dropdown and select "What's Hot"
    const algoDropdown = page.locator('select');
    await algoDropdown.selectOption({ value: 'whats-hot' });
    await page.waitForTimeout(300);

    // Verify selection changed
    const selectedValue = await algoDropdown.inputValue();
    expect(selectedValue).toBe('whats-hot');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'algo-feed-whats-hot-selected.png'),
      fullPage: false,
    });

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('feed persists settings across modal close/reopen', async ({ page }) => {
    // Set viewport to wide mode
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);

    // Dismiss any existing modals first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open settings
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Select "Discover" from dropdown
    const algoDropdown = page.locator('select');
    await algoDropdown.selectOption({ label: 'Discover' });
    await page.waitForTimeout(300);

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Reopen settings
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Verify "Discover" is still selected
    const selectedValue = await algoDropdown.inputValue();
    expect(selectedValue).toBe('discover');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'algo-feed-settings-persisted.png'),
      fullPage: false,
    });

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
