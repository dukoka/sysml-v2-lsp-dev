import { test, expect } from '@playwright/test';

test.describe('Code Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.editor-area');
  });

  test('Monaco editor loads with Vehicle.sysml content', async ({ page }) => {
    // Monaco renders lines with class "view-line"
    const viewLines = page.locator('.monaco-editor .view-line');
    await expect(viewLines.first()).toBeVisible({ timeout: 15_000 });

    const editorText = await page.locator('.monaco-editor').textContent();
    expect(editorText).toContain('package');
    expect(editorText).toContain('VehicleExample');
  });

  test('switching files changes editor content', async ({ page }) => {
    await page.locator('.monaco-editor .view-line').first().waitFor({ timeout: 15_000 });

    await page.locator('.file-item', { hasText: 'Requirements.sysml' }).click();
    await page.waitForTimeout(1000);

    await expect(async () => {
      const text = await page.locator('.monaco-editor .lines-content').textContent();
      expect(text).toContain('Requirements');
    }).toPass({ timeout: 15_000 });
  });

  test('editor updates status bar cursor position on click', async ({ page }) => {
    const editor = page.locator('.monaco-editor');
    await editor.locator('.view-line').first().waitFor({ timeout: 15_000 });

    // Click inside the editor area
    await editor.click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(500);

    const statusBar = page.locator('.status-bar');
    const statusText = await statusBar.textContent();
    // Should have some Ln/Col indicator
    expect(statusText).toMatch(/Ln \d+, Col \d+/);
  });

  test('new file via toolbar button', async ({ page }) => {
    await page.locator('.monaco-editor .view-line').first().waitFor({ timeout: 15_000 });

    await page.locator('.toolbar-btn[title*="New File"]').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.tab', { hasText: /untitled/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.tab.active')).toContainText('untitled');
  });

  test('status bar shows char count', async ({ page }) => {
    await page.locator('.monaco-editor .view-line').first().waitFor({ timeout: 15_000 });

    const statusBar = page.locator('.status-bar');
    const text = await statusBar.textContent();
    // Should show something like "622 chars"
    expect(text).toMatch(/\d+ chars/);
  });
});
