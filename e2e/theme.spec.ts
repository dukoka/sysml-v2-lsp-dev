import { test, expect } from '@playwright/test';

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container');
  });

  test('defaults to dark theme', async ({ page }) => {
    const dataTheme = await page.locator('html').getAttribute('data-theme');
    expect(dataTheme).toBe('dark');
  });

  test('switch to light theme', async ({ page }) => {
    await page.locator('.toolbar-select').selectOption('vs-light');
    const dataTheme = await page.locator('html').getAttribute('data-theme');
    expect(dataTheme).toBe('light');
  });

  test('switch back to dark theme', async ({ page }) => {
    await page.locator('.toolbar-select').selectOption('vs-light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.locator('.toolbar-select').selectOption('vs-dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('light theme changes toolbar background', async ({ page }) => {
    await page.locator('.toolbar-select').selectOption('vs-light');
    const bgColor = await page.locator('.toolbar').evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Light theme --bg-secondary is #f3f3f3 => rgb(243, 243, 243)
    expect(bgColor).toBe('rgb(243, 243, 243)');
  });

  test('dark theme toolbar background', async ({ page }) => {
    const bgColor = await page.locator('.toolbar').evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Dark theme --bg-secondary is #252526 => rgb(37, 37, 38)
    expect(bgColor).toBe('rgb(37, 37, 38)');
  });

  test('SysMLv2 Dark theme still uses dark data-theme', async ({ page }) => {
    await page.locator('.toolbar-select').selectOption('sysmlv2-dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
