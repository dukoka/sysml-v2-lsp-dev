import { test, expect } from '@playwright/test';

test.describe('IDE Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container');
  });

  test('renders the full IDE layout', async ({ page }) => {
    await expect(page.locator('.toolbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.tab-bar')).toBeVisible();
    await expect(page.locator('.editor-area')).toBeVisible();
    await expect(page.locator('.problems-panel')).toBeVisible();
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('toolbar shows title and buttons', async ({ page }) => {
    await expect(page.locator('.toolbar-title')).toHaveText('SysMLv2 Editor');
    await expect(page.locator('.toolbar-btn[title*="New File"]')).toBeVisible();
    await expect(page.locator('.toolbar-btn[title*="Format"]')).toBeVisible();
    await expect(page.locator('.toolbar-btn[title*="Toggle Sidebar"]')).toBeVisible();
    await expect(page.locator('.toolbar-btn[title*="Toggle Problems"]')).toBeVisible();
    await expect(page.locator('.toolbar-btn[title*="Keyboard Shortcuts"]')).toBeVisible();
    await expect(page.locator('.toolbar-select')).toBeVisible();
  });

  test('status bar shows default info', async ({ page }) => {
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toContainText('Ln');
    await expect(statusBar).toContainText('Col');
    await expect(statusBar).toContainText('chars');
    await expect(statusBar).toContainText('UTF-8');
    await expect(statusBar).toContainText('SYSMLV2');
    await expect(statusBar).toContainText('LSP');
  });

  test('problems panel starts collapsed', async ({ page }) => {
    await expect(page.locator('.problems-panel')).toHaveClass(/collapsed/);
    await expect(page.locator('.problems-panel-header')).toContainText('Problems');
  });
});
