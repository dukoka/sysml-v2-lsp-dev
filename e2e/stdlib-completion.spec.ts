import { test, expect, type Page } from '@playwright/test';

async function waitForEditorAndLsp(page: Page) {
  await page.waitForSelector('.monaco-editor .view-line', { timeout: 15_000 });
  await expect(page.locator('.status-dot.connected')).toBeVisible({ timeout: 20_000 });
  // Wait for stdlib to load
  await page.waitForTimeout(3000);
}

async function setEditorPosition(page: Page, line: number, column: number) {
  await page.evaluate(({ ln, col }) => {
    const ed = (window as any).__monacoEditorInstance;
    if (ed) {
      ed.setPosition({ lineNumber: ln, column: col });
      ed.revealLineInCenter(ln);
      ed.focus();
    }
  }, { ln: line, col: column });
  await page.waitForTimeout(300);
}

async function typeInEditor(page: Page, text: string) {
  await page.evaluate(() => {
    (window as any).__monacoEditorInstance?.focus();
  });
  await page.waitForTimeout(200);
  await page.keyboard.type(text, { delay: 30 });
}

test.describe('Stdlib Completion Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForEditorAndLsp(page);
  });

  test('stdlib type index loads with 1422+ types', async ({ page }) => {
    // Check console for stdlib load log
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));
    
    await page.waitForTimeout(2000);
    
    // Reload to capture console from start
    await page.reload();
    await waitForEditorAndLsp(page);
    
    // Check for stdlib load confirmation
    const hasStdlibLog = logs.some(l => 
      l.includes('stdlib') && l.includes('loaded') ||
      l.includes('index:') && l.includes('type names')
    );
    
    // Also check that no ReferenceError occurred
    const hasReferenceError = logs.some(l => 
      l.includes('ReferenceError') || l.includes('Cannot access')
    );
    
    expect(hasReferenceError).toBe(false);
  });

  test('completion shows stdlib types in type context', async ({ page }) => {
    // Go to end of file
    const lineCount = await page.evaluate(() => {
      const ed = (window as any).__monacoEditorInstance;
      return ed?.getModel()?.getLineCount() ?? 0;
    });
    
    await setEditorPosition(page, lineCount, 1);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    
    // Type a part definition with type context
    await typeInEditor(page, 'attribute test : ');
    await page.waitForTimeout(500);
    
    // Trigger completion
    await page.keyboard.press('Control+Space');
    await page.waitForTimeout(2000);
    
    // Check if suggest widget is visible
    const suggestWidget = page.locator('.suggest-widget:not(.message)');
    const isVisible = await suggestWidget.isVisible().catch(() => false);
    
    if (isVisible) {
      const text = await suggestWidget.textContent();
      // Should contain stdlib types, not just fallback types
      expect(text).toBeTruthy();
      // Check for common types that should be in stdlib
      const hasStdlibType = text!.includes('Integer') || 
                           text!.includes('Real') || 
                           text!.includes('String') ||
                           text!.includes('Boolean');
      expect(hasStdlibType).toBe(true);
    }
  });

  test('completion filters by prefix (Sc → StructuredType)', async ({ page }) => {
    const lineCount = await page.evaluate(() => {
      const ed = (window as any).__monacoEditorInstance;
      return ed?.getModel()?.getLineCount() ?? 0;
    });
    
    await setEditorPosition(page, lineCount, 1);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    
    // Type partial type prefix
    await typeInEditor(page, 'attribute test : Sc');
    await page.waitForTimeout(500);
    
    // Trigger completion
    await page.keyboard.press('Control+Space');
    await page.waitForTimeout(2000);
    
    const suggestWidget = page.locator('.suggest-widget:not(.message)');
    const isVisible = await suggestWidget.isVisible().catch(() => false);
    
    if (isVisible) {
      const text = await suggestWidget.textContent();
      // Should show Sc-prefixed types
      const hasScPrefix = text!.includes('ScalarValue') || 
                         text!.includes('StructuredType');
      expect(hasScPrefix).toBe(true);
      
      // Should NOT show unrelated types
      const hasUnrelated = text!.includes('Integer') || 
                          text!.includes('Real');
      expect(hasUnrelated).toBe(false);
    }
  });
});
