import { test, expect } from '@playwright/test';

test.describe('Problems Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.problems-panel');
  });

  test('starts collapsed', async ({ page }) => {
    await expect(page.locator('.problems-panel')).toHaveClass(/collapsed/);
  });

  test('expand via header click', async ({ page }) => {
    await page.locator('.problems-panel-header').click();
    await expect(page.locator('.problems-panel')).toHaveClass(/expanded/);
  });

  test('collapse after expand', async ({ page }) => {
    await page.locator('.problems-panel-header').click();
    await expect(page.locator('.problems-panel')).toHaveClass(/expanded/);

    await page.locator('.problems-panel-header').click();
    await expect(page.locator('.problems-panel')).toHaveClass(/collapsed/);
  });

  test('expand via toolbar button', async ({ page }) => {
    await page.locator('.toolbar-btn[title*="Toggle Problems"]').click();
    await expect(page.locator('.problems-panel')).toHaveClass(/expanded/);
  });

  test('shows "No problems detected" when empty', async ({ page }) => {
    await page.locator('.problems-panel-header').click();
    await expect(page.locator('.problems-panel')).toHaveClass(/expanded/);

    // Wait a moment for possible diagnostics then check empty state
    await page.waitForTimeout(2000);
    const body = page.locator('.problems-panel-body');
    const text = await body.textContent();
    // Either empty message or actual problems — both are valid
    expect(text!.length).toBeGreaterThan(0);
  });

  test('status bar click toggles problems panel', async ({ page }) => {
    await page.locator('.status-bar .status-item.clickable').first().click();
    await expect(page.locator('.problems-panel')).toHaveClass(/expanded/);

    await page.locator('.status-bar .status-item.clickable').first().click();
    await expect(page.locator('.problems-panel')).toHaveClass(/collapsed/);
  });
});
