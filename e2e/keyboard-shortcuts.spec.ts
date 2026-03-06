import { test, expect } from '@playwright/test';

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container');
  });

  test('open shortcuts modal via ? button', async ({ page }) => {
    await page.locator('.toolbar-btn[title*="Keyboard Shortcuts"]').click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.modal h2')).toHaveText('Keyboard Shortcuts');
  });

  test('shortcuts modal lists key bindings', async ({ page }) => {
    await page.locator('.toolbar-btn[title*="Keyboard Shortcuts"]').click();
    const rows = page.locator('.shortcut-table tr');
    await expect(rows).toHaveCount(13);

    await expect(page.locator('.shortcut-table')).toContainText('Save file');
    await expect(page.locator('.shortcut-table')).toContainText('Ctrl+S');
    await expect(page.locator('.shortcut-table')).toContainText('Go to Definition');
    await expect(page.locator('.shortcut-table')).toContainText('F12');
  });

  test('close modal via X button', async ({ page }) => {
    await page.locator('.toolbar-btn[title*="Keyboard Shortcuts"]').click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    await page.locator('.modal-close').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('close modal via overlay click', async ({ page }) => {
    await page.locator('.toolbar-btn[title*="Keyboard Shortcuts"]').click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // Click the overlay itself (outside the modal)
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('Ctrl+B toggles sidebar', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();

    await page.keyboard.press('Control+b');
    await expect(page.locator('.sidebar')).not.toBeVisible();

    await page.keyboard.press('Control+b');
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('New File button creates a new file', async ({ page }) => {
    await page.locator('.monaco-editor .view-line').first().waitFor({ timeout: 15_000 });

    const tabCountBefore = await page.locator('.tab').count();

    await page.locator('.toolbar-btn[title*="New File"]').click();

    await expect(page.locator('.tab')).toHaveCount(tabCountBefore + 1, { timeout: 5_000 });
    await expect(page.locator('.tab.active')).toContainText('untitled');
  });
});
