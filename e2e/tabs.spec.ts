import { test, expect } from '@playwright/test';

test.describe('Tab Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tab-bar');
  });

  test('shows one active tab on load', async ({ page }) => {
    const tabs = page.locator('.tab');
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveClass(/active/);
    await expect(tabs.first()).toContainText('Vehicle.sysml');
  });

  test('clicking sidebar file opens a new tab', async ({ page }) => {
    await page.locator('.file-item', { hasText: 'Requirements.sysml' }).click();
    await expect(page.locator('.tab')).toHaveCount(2, { timeout: 5_000 });
    await expect(page.locator('.tab.active')).toContainText('Requirements.sysml');
  });

  test('clicking a tab switches active file', async ({ page }) => {
    // Open two more files via sidebar
    await page.locator('.file-item', { hasText: 'Requirements.sysml' }).click();
    await expect(page.locator('.tab')).toHaveCount(2, { timeout: 5_000 });

    await page.locator('.file-item', { hasText: 'Actions.sysml' }).click();
    await expect(page.locator('.tab')).toHaveCount(3, { timeout: 5_000 });
    await expect(page.locator('.tab.active')).toContainText('Actions.sysml');

    // Click Vehicle tab to switch back
    await page.locator('.tab', { hasText: 'Vehicle.sysml' }).click();
    await expect(page.locator('.tab.active')).toContainText('Vehicle.sysml', { timeout: 5_000 });
  });

  test('close tab via close button', async ({ page }) => {
    // Open a second file
    await page.locator('.file-item', { hasText: 'Requirements.sysml' }).click();
    await expect(page.locator('.tab')).toHaveCount(2, { timeout: 5_000 });

    // Close the Requirements tab
    const reqTab = page.locator('.tab', { hasText: 'Requirements.sysml' });
    await reqTab.hover();
    await reqTab.locator('.tab-close').click();

    await expect(page.locator('.tab')).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('.tab.active')).toContainText('Vehicle.sysml');
  });

  test('closing the active tab activates a neighbor', async ({ page }) => {
    // Open two more files
    await page.locator('.file-item', { hasText: 'Requirements.sysml' }).click();
    await expect(page.locator('.tab')).toHaveCount(2, { timeout: 5_000 });

    await page.locator('.file-item', { hasText: 'Actions.sysml' }).click();
    await expect(page.locator('.tab')).toHaveCount(3, { timeout: 5_000 });

    // Close Actions (active) tab
    const actionsTab = page.locator('.tab', { hasText: 'Actions.sysml' });
    await actionsTab.hover();
    await actionsTab.locator('.tab-close').click();

    await expect(page.locator('.tab')).toHaveCount(2, { timeout: 5_000 });
    const activeTab = page.locator('.tab.active');
    await expect(activeTab).toBeVisible();
  });
});
