import { test, expect } from '@playwright/test';

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar');
  });

  test('shows Files and Outline sections', async ({ page }) => {
    const headers = page.locator('.sidebar-section-header');
    await expect(headers).toHaveCount(2);
    await expect(headers.nth(0)).toContainText('Files');
    await expect(headers.nth(1)).toContainText('Outline');
  });

  test('lists all example files', async ({ page }) => {
    const fileItems = page.locator('.file-item');
    await expect(fileItems).toHaveCount(3);
    await expect(fileItems.nth(0)).toContainText('Vehicle.sysml');
    await expect(fileItems.nth(1)).toContainText('Requirements.sysml');
    await expect(fileItems.nth(2)).toContainText('Actions.sysml');
  });

  test('first file is active by default', async ({ page }) => {
    const firstFile = page.locator('.file-item').first();
    await expect(firstFile).toHaveClass(/active/);
  });

  test('clicking a different file switches active state', async ({ page }) => {
    const reqFile = page.locator('.file-item', { hasText: 'Requirements.sysml' });
    await reqFile.click();
    await page.waitForTimeout(500);

    await expect(reqFile).toHaveClass(/active/, { timeout: 5_000 });
    await expect(page.locator('.file-item', { hasText: 'Vehicle.sysml' })).not.toHaveClass(/active/);
  });

  test('outline shows symbols for the active file', async ({ page }) => {
    const outlineItems = page.locator('.outline-item');
    await expect(outlineItems.first()).toBeVisible();
    await expect(outlineItems.first()).toContainText('VehicleExample');
  });

  test('toggle sidebar via button', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();

    await page.locator('.toolbar-btn[title*="Toggle Sidebar"]').click();
    await expect(page.locator('.sidebar')).not.toBeVisible();

    await page.locator('.toolbar-btn[title*="Toggle Sidebar"]').click();
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('collapse Files section', async ({ page }) => {
    const filesHeader = page.locator('.sidebar-section-header', { hasText: 'Files' });
    const fileItems = page.locator('.file-item');

    await expect(fileItems.first()).toBeVisible();

    await filesHeader.click();
    await expect(fileItems).toHaveCount(0);

    await filesHeader.click();
    await expect(fileItems.first()).toBeVisible();
  });

  test('collapse Outline section', async ({ page }) => {
    const outlineHeader = page.locator('.sidebar-section-header', { hasText: 'Outline' });
    const outlineItems = page.locator('.outline-item');

    await expect(outlineItems.first()).toBeVisible();

    await outlineHeader.click();
    await expect(outlineItems).toHaveCount(0);

    await outlineHeader.click();
    await expect(outlineItems.first()).toBeVisible();
  });
});
