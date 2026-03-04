/**
 * Simple verification script for TASK-RALPH-03
 * Takes screenshots after authenticating to verify layout fixes
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = './screenshots';
const CREDENTIALS_PATH = './test-credentials.json';

interface Credentials {
  handle: string;
  password: string;
}

function loadCredentials(): Credentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

async function main() {
  console.log('Starting layout verification...');

  const creds = loadCredentials();
  if (!creds) {
    console.error('No credentials found in test-credentials.json');
    process.exit(1);
  }

  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set viewport to wide mode (1200px)
  await page.setViewportSize({ width: 1200, height: 900 });

  try {
    // Go to the app
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Look for Try button or login modal
    const tryButton = page.locator('button:has-text("Try")');
    const loginInput = page.locator('input[placeholder*="bsky.social"]');

    // Check if we're in unauthenticated mode (showing public feed with Try button)
    if (await tryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found Try button - clicking it to trigger login...');

      // Click the Try button directly
      await tryButton.click();
      await page.waitForTimeout(1000);
    }

    // Now look for login input
    try {
      await page.waitForSelector('input[placeholder*="bsky.social"]', { timeout: 5000 });
      console.log('Found login input');
    } catch {
      // Maybe login modal didn't appear, try pressing 'l' to trigger login prompt
      console.log('Login input not found, trying to trigger login prompt...');
      await page.keyboard.press('l');
      await page.waitForTimeout(500);

      // Look for "Log In" button in the prompt modal
      const logInBtn = page.locator('button:has-text("Log In")');
      if (await logInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logInBtn.click();
        await page.waitForTimeout(500);
      }

      await page.waitForSelector('input[placeholder*="bsky.social"]', { timeout: 5000 });
      console.log('Found login input after triggering prompt');
    }

    // Enter credentials
    await page.fill('input[placeholder*="bsky.social"]', creds.handle);

    // Click Log In button
    const loginButton = page.locator('button:has-text("Log In")');
    await loginButton.first().click();
    console.log('Clicked Log In, waiting for redirect...');

    // Wait for redirect to bsky.app
    await page.waitForURL(/bsky\.app|bsky\.social/, { timeout: 30000 });
    console.log('Redirected to bsky.app');

    // Handle bsky.app authorization
    const authorizeButton = page.locator('button:has-text("Authorize"), button:has-text("Allow"), button:has-text("Accept")');

    if (await authorizeButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Already logged in, clicking authorize...');
      await authorizeButton.first().click();
    } else {
      // Need to login on bsky.app
      console.log('Need to login on bsky.app...');
      const passwordField = page.locator('input[type="password"]');

      if (await passwordField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await passwordField.fill(creds.password);

        // Click sign in
        const bskyLoginBtn = page.locator('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Next"), button[type="submit"]');
        await bskyLoginBtn.first().click();
        console.log('Submitted password');

        // Wait for authorization button after login
        await page.waitForTimeout(3000);
        if (await authorizeButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await authorizeButton.first().click();
        }
      }
    }

    // Wait for redirect back to localhost
    console.log('Waiting for redirect back to app...');
    await page.waitForURL(/localhost:5173|127\.0\.0\.1:5173/, { timeout: 30000 });

    // Wait for feed to load
    await page.waitForTimeout(3000);
    console.log('Logged in!');

    // Reload to ensure test posts are loaded
    console.log('Reloading page to ensure test posts are loaded...');
    await page.reload();
    await page.waitForTimeout(5000);
    console.log('Taking screenshots...');

    // Save auth state for future runs
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          items[key] = window.localStorage.getItem(key) || '';
        }
      }
      return items;
    });

    const authState = {
      localStorage,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync('./e2e/auth-state.json', JSON.stringify(authState, null, 2));
    console.log('Saved auth state for future tests');

    // Take screenshots - navigate through test posts using 'k' (backwards)
    // Test posts are prepended to the feed, so we use 'k' to go backwards through them
    for (let i = 1; i <= 16; i++) {
      // Check for Moment of Reflection modal and skip it
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
        path: path.join(SCREENSHOT_DIR, `verify-post-${i}.png`),
        fullPage: false,
      });
      console.log(`Screenshot ${i} saved: verify-post-${i}.png`);

      // Navigate to previous post (test posts are at the beginning)
      if (i < 16) {
        await page.keyboard.press('k');
        await page.waitForTimeout(1500);
      }
    }

    console.log('');
    console.log('Layout verification complete!');
    console.log('Review screenshots in ./screenshots/verify-post-*.png');

  } catch (error) {
    console.error('Error during verification:', error);

    // Take error screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'verify-error.png'),
      fullPage: true,
    });
    console.log('Error screenshot saved to verify-error.png');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
