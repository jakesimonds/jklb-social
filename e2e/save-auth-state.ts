/**
 * Save Auth State Script
 *
 * This script opens a browser, lets you login manually,
 * then saves the localStorage state for use in Playwright tests.
 *
 * Usage:
 * 1. Start the dev server: npm run dev
 * 2. Run this script: npx ts-node e2e/save-auth-state.ts
 * 3. Login manually in the browser that opens
 * 4. Press Enter in the terminal when logged in
 * 5. Auth state is saved to e2e/auth-state.json
 *
 * The auth-state.json file is gitignored and contains session tokens.
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as readline from 'readline';

const AUTH_STATE_PATH = './e2e/auth-state.json';

async function main() {
  console.log('Opening browser for manual login...');
  console.log('');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173');

  console.log('='.repeat(60));
  console.log('Please login to russAbbot in the browser window.');
  console.log('Once logged in and you see the feed, press Enter here.');
  console.log('='.repeat(60));
  console.log('');

  // Wait for user to press Enter
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('Press Enter when logged in... ', () => {
      rl.close();
      resolve();
    });
  });

  console.log('');
  console.log('Saving auth state...');

  // Get localStorage
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

  // Save state
  const authState = {
    localStorage,
    savedAt: new Date().toISOString(),
    note: 'This file contains session tokens. DO NOT commit to git.',
  };

  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(authState, null, 2));

  console.log(`Auth state saved to ${AUTH_STATE_PATH}`);
  console.log('');
  console.log('You can now run authenticated Playwright tests:');
  console.log('  npx playwright test');
  console.log('');

  await browser.close();
}

main().catch(console.error);
