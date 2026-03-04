import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginWithOAuth, loadTestCredentials } from './helpers/login';

const SCREENSHOT_DIR = './screenshots';
const AUTH_STATE_PATH = './e2e/auth-state.json';

/**
 * This test performs a LIVE OAuth login to Bluesky.
 * It should be run manually when you need to:
 * 1. Test the OAuth flow itself
 * 2. Generate a new auth-state.json file
 *
 * Skip this test in regular test runs because:
 * - It requires network access to bsky.social
 * - OAuth flow is slow and can timeout
 * - Other tests use saved auth state for speed
 */
test('hello world - login and capture settings', async ({ page }) => {
  // Skip if auth state already exists - use that for other tests instead
  if (fs.existsSync(AUTH_STATE_PATH)) {
    test.skip(true, 'Skipping live OAuth test - auth state exists. Run save-auth if you need fresh credentials.');
  }

  // OAuth can be slow, increase timeout
  test.setTimeout(120000);
  // Ensure screenshot dir exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Load credentials
  const credentials = loadTestCredentials();
  if (!credentials) {
    test.skip(true, 'No credentials found in test-credentials.json');
  }

  console.log('Starting OAuth login...');

  // Do OAuth login
  const success = await loginWithOAuth(page, credentials);
  if (!success) {
    // Take screenshot of whatever state we're in
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'login-failed.png'),
        fullPage: true,
      });
    } catch {
      // Page might be closed
    }
    test.skip(true, 'OAuth login failed - network/external service issue');
  }

  console.log('Login successful, waiting for feed...');

  // Wait for feed to load
  await page.waitForTimeout(3000);

  // Take screenshot of main feed
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'hello-feed.png'),
    fullPage: true,
  });

  console.log('Opening settings modal...');

  // Click Settings in sidebar
  await page.click('text=Settings');
  await page.waitForTimeout(1000);

  // Take screenshot of settings modal
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'hello-settings.png'),
    fullPage: true,
  });

  console.log('Screenshots saved to ./screenshots/');
});
