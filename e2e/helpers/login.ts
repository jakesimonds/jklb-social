import { Page } from '@playwright/test';
import * as fs from 'fs';

/**
 * Login Helper for Playwright
 *
 * Handles the OAuth flow:
 * 1. Enter handle on russAbbot
 * 2. Get redirected to bsky.app
 * 3. Enter credentials on bsky.app
 * 4. Get redirected back to russAbbot
 *
 * RALPH AGENT: This uses the TEST ACCOUNT only.
 * Never use real user credentials or interact with real accounts.
 */

interface TestCredentials {
  handle: string;
  password: string;
}

const CREDENTIALS_PATH = './test-credentials.json';

/**
 * Load test credentials from file
 */
export function loadTestCredentials(): TestCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.warn('No test-credentials.json found');
    return null;
  }

  const data = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

  if (!data.handle || !data.password) {
    console.warn('test-credentials.json is missing handle or password');
    return null;
  }

  return {
    handle: data.handle,
    password: data.password,
  };
}

/**
 * Perform OAuth login through bsky.app
 *
 * @param page - Playwright page
 * @param credentials - Test account credentials (optional, loads from file if not provided)
 */
export async function loginWithOAuth(
  page: Page,
  credentials?: TestCredentials
): Promise<boolean> {
  const creds = credentials || loadTestCredentials();

  if (!creds) {
    console.error('No credentials available for login');
    return false;
  }

  try {
    // 1. Go to russAbbot
    console.log('Step 1: Going to app...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Let the app fully render

    // Debug screenshot
    await page.screenshot({ path: './screenshots/login-debug-1-after-load.png' });

    // 2. Check if we need to open login modal via "Try" button
    // Wait for React to fully hydrate
    await page.waitForTimeout(3000);

    const tryButtonLocator = page.locator('[data-testid="login-try-button"]');
    const count = await tryButtonLocator.count();

    // Find the visible button (there may be multiple, only one visible)
    let tryButton = null;
    for (let i = 0; i < count; i++) {
      const btn = tryButtonLocator.nth(i);
      const bbox = await btn.boundingBox().catch(() => null);
      if (bbox) {
        tryButton = btn;
        break;
      }
    }

    if (tryButton) {
      console.log('Step 2: Found Try button, clicking...');
      await tryButton.click();
      await page.waitForTimeout(1000); // Wait for modal to open
    } else {
      // Maybe already showing login modal or already logged in?
      console.log('Step 2: Try button NOT found, checking alternatives...');
      const alreadyLoggedIn = !(await page.locator('[data-testid="login-handle-input"]').isVisible().catch(() => false));
      if (alreadyLoggedIn) {
        const hasAvatar = await page.locator('img[class*="rounded-full"]').first().isVisible().catch(() => false);
        if (hasAvatar) {
          console.log('Already logged in!');
          return true;
        }
      }
    }

    // 3. Wait for login modal input (using data-testid)
    console.log('Step 3: Waiting for login modal input...');
    const loginInput = page.locator('[data-testid="login-handle-input"]');
    await loginInput.waitFor({ timeout: 10000 });

    // 4. Fill the handle
    console.log('Step 4: Filling handle:', creds.handle);
    await loginInput.fill(creds.handle);

    // 5. Click "Log In" button to start OAuth (using data-testid)
    console.log('Step 5: Clicking Log In button...');
    const loginButton = page.locator('[data-testid="login-submit-button"]');
    await loginButton.click();

    // 6. Wait for redirect to bsky.app
    console.log('Step 6: Waiting for redirect to bsky.app...');
    await page.waitForURL(/bsky\.app|bsky\.social/, { timeout: 15000 });

    // 7. Handle bsky.app - could be authorize page OR login page
    const authorizeButton = page.locator('button:has-text("Authorize"), button:has-text("Allow"), button:has-text("Accept")');

    if (await authorizeButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // Already logged in on bsky.app, just authorize
      console.log('Step 7a: Already logged in on bsky.app, clicking Authorize...');
      await authorizeButton.first().click();
    } else {
      // Need to enter password on bsky.app
      console.log('Step 7b: Entering password on bsky.app...');
      const passwordField = page.locator('input[type="password"]');

      if (await passwordField.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Check if identifier field needs to be filled
        const identifierField = page.locator('input[type="text"]:not([disabled]):not([readonly])');
        if (await identifierField.first().isVisible().catch(() => false)) {
          console.log('Filling identifier field...');
          await identifierField.first().fill(creds.handle);
        }

        console.log('Filling password field...');
        await passwordField.fill(creds.password);

        // Click sign in on bsky.app
        console.log('Clicking Sign in on bsky.app...');
        const bskyLoginBtn = page.locator('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Next"), button[type="submit"]');
        await bskyLoginBtn.first().click();

        // After login, may still need to authorize
        await page.waitForTimeout(2000);
        if (await authorizeButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('Clicking Authorize after login...');
          await authorizeButton.first().click();
        }
      }
    }

    // 8. Wait for redirect back to russAbbot (could be localhost or 127.0.0.1)
    console.log('Step 8: Waiting for redirect back to app...');
    await page.waitForURL(/localhost:5173|127\.0\.0\.1:5173/, { timeout: 30000 });

    // 9. Wait for feed to load (indicates successful auth)
    console.log('Step 9: Waiting for feed to load...');
    await page.waitForTimeout(3000);

    // Check if we're logged in - avatar should be visible, Try button should be gone
    const tryButtonGone = !(await page.locator('[data-testid="login-try-button"]').first().isVisible().catch(() => true));
    console.log('Login successful:', tryButtonGone);

    // Take success screenshot
    await page.screenshot({ path: './screenshots/login-success.png' });

    return tryButtonGone;
  } catch (error) {
    console.error('OAuth login failed:', error);
    return false;
  }
}

/**
 * Logout from the app
 *
 * @param page - Playwright page
 */
export async function logout(page: Page): Promise<boolean> {
  try {
    console.log('Logging out...');

    // Find the logout button (↩ symbol next to avatar)
    const logoutButton = page.locator('button[title="Logout"], button[aria-label="Logout"]');

    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();
      await page.waitForTimeout(2000);

      // Verify logged out - Try button should be visible again
      const tryButtonLocator = page.locator('[data-testid="login-try-button"]');
      let tryButtonVisible = false;
      const count = await tryButtonLocator.count();
      for (let i = 0; i < count; i++) {
        const bbox = await tryButtonLocator.nth(i).boundingBox().catch(() => null);
        if (bbox) {
          tryButtonVisible = true;
          break;
        }
      }

      console.log('Logout successful:', tryButtonVisible);
      return tryButtonVisible;
    }

    console.log('Logout button not found');
    return false;
  } catch (error) {
    console.error('Logout failed:', error);
    return false;
  }
}

/**
 * Check if currently logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check if Try button is NOT visible (meaning we're logged in)
  const tryButtonLocator = page.locator('[data-testid="login-try-button"]');
  const count = await tryButtonLocator.count();

  for (let i = 0; i < count; i++) {
    const bbox = await tryButtonLocator.nth(i).boundingBox().catch(() => null);
    if (bbox) {
      // Try button is visible, so NOT logged in
      return false;
    }
  }

  // Try button not visible - check for avatar
  const hasAvatar = await page.locator('img[class*="rounded-full"]').first().isVisible().catch(() => false);
  return hasAvatar;
}
