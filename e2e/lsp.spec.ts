import { test, expect } from '@playwright/test';

test.describe('LSP Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.monaco-editor .view-line', { timeout: 15_000 });
  });

  test('LSP status shows in status bar', async ({ page }) => {
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toContainText('LSP');
    // There should be a status dot (connected or disconnected)
    await expect(page.locator('.status-dot')).toBeVisible();
  });

  test('LSP status dot is visible', async ({ page }) => {
    // LSP may or may not connect depending on environment; just verify the dot renders
    await expect(page.locator('.status-dot')).toBeVisible({ timeout: 5_000 });
  });

  test('Monaco editor renders syntax highlighting', async ({ page }) => {
    // Monaco should have tokenized content with span elements
    const editor = page.locator('.monaco-editor');
    const spans = editor.locator('.view-line span span');
    await expect(spans.first()).toBeVisible({ timeout: 10_000 });

    // There should be multiple spans indicating tokenization
    const count = await spans.count();
    expect(count).toBeGreaterThan(5);
  });

  test('editor shows line numbers', async ({ page }) => {
    const lineNumbers = page.locator('.monaco-editor .line-numbers');
    await expect(lineNumbers.first()).toBeVisible();
    const count = await lineNumbers.count();
    expect(count).toBeGreaterThan(10);
  });
});
