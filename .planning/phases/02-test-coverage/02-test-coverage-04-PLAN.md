---
phase: 02-test-coverage
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/diagnostics.spec.ts
  - e2e/lsp-features.spec.ts
autonomous: true
requirements:
  - TEST-COV-06
must_haves:
  truths:
    - "Sections 8-10 tests pass: diagnostics detect broken code and clear on fix, hover shows type info, go-to-definition jumps to correct definition"
  artifacts:
    - path: "e2e/diagnostics.spec.ts"
      provides: "Section 8 tests: error diagnostics, fix clears diagnostics, warning-level diagnostics"
    - path: "e2e/lsp-features.spec.ts"
      provides: "Sections 9-10: enhanced hover and go-to-def assertions"
  key_links:
    - from: "e2e/diagnostics.spec.ts"
      to: ".problems-panel-body"
      via: "type broken code → check panel → fix code → check panel empty"
      pattern: "problems-panel"
    - from: "editor position on Engine reference"
      to: "position on Engine definition"
      via: "F12 / editor.action.revealDefinition"
      pattern: "revealDefinition"
---

<objective>
Create/enhance E2E tests for diagnostics (Section 8), hover (Section 9), and go-to-definition (Section 10).

Purpose: The existing lsp-features.spec.ts has basic diagnostics (error appears), hover (tooltip visible), and go-to-def (F12 navigates) tests. This plan fills gaps: fix-clears-diagnostics, warning-level diagnostics, hover on type references vs comments, and specific go-to-definition line assertions.

Output: e2e/diagnostics.spec.ts (new) + enhanced lsp-features.spec.ts sections.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/test-coverage-plan.md (Sections 8, 9, 10)
@.planning/codebase/TESTING.md
@e2e/lsp-features.spec.ts (existing diagnostics, hover, go-to-def sections)
@e2e/problems-panel.spec.ts (existing panel UI tests)
</context>

<interfaces>
From e2e/lsp-features.spec.ts — existing tests (DO NOT duplicate):

Diagnostics section:
```typescript
// "erroneous code produces diagnostics" — types 'part def {', checks panel has content
// "valid Vehicle.sysml shows no error badge" — checks badge is 0 or hidden
```

Hover section:
```typescript
// "hover over a definition shows tooltip" — positions on Vehicle, runs showHover action
```

Go-to-definition section:
```typescript
// "F12 navigates to definition" — positions on Engine reference, runs revealDefinition
// "peek definition shows inline widget" — runs peekDefinition
```

Key selectors:
- `.problems-panel-body` — problems content
- `.problems-badge.errors` — error count badge
- `.problems-badge.warnings` — warning count badge
- `.monaco-hover` — hover tooltip widget
- `.suggest-widget` — completion widget
- `.status-dot.connected` — LSP status
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Section 8 — Diagnostics gap tests</name>
  <read_first>e2e/lsp-features.spec.ts (diagnostics section), e2e/problems-panel.spec.ts, .planning/test-coverage-plan.md (Section 8)</read_first>
  <files>e2e/diagnostics.spec.ts</files>
  <action>
    Create e2e/diagnostics.spec.ts with Section 8 tests NOT already covered:

    Helper functions:
    ```typescript
    import { test, expect, type Page } from '@playwright/test';
    async function waitForEditorAndLsp(page: Page) {
      await page.waitForSelector('.monaco-editor .view-line', { timeout: 15_000 });
      await expect(page.locator('.status-dot.connected')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1500);
    }
    async function typeInEditor(page: Page, text: string) { ... }
    async function getEditorValue(page: Page): Promise<string> { ... }
    async function getEditorLineCount(page: Page): Promise<number> { ... }
    ```

    Tests:

    1. **Error badge count (8.2)**:
       - New file → type `part broken {` (unclosed brace)
       - Wait 3s for diagnostics
       - Expand problems panel (.problems-panel-header click)
       - .problems-badge.errors should show count >= 1

    2. **Fix clears diagnostics (8.3)**:
       - Type `part broken {` → wait for error
       - Add `}` to close → wait 3s
       - Problems panel should show "No problems" or empty
       - Error badge should be 0 or hidden

    3. **Warning-level diagnostics (8.4)**:
       - Type `part x : NonExistentType;` → wait 3s
       - Should see warning (orange) or at least a diagnostic about unresolved type
       - .problems-badge.warnings >= 1 OR .problems-panel-body has warning text

    4. **Click problem jumps to line (8.2)**:
       - Create error, expand problems panel
       - Click a problem item
       - Editor cursor should move to the error line

    Each test: beforeEach goto('/'), waitForEditorAndLsp, new file via toolbar.
  </action>
  <verify>
    <automated>npx playwright test e2e/diagnostics.spec.ts --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>diagnostics.spec.ts exists with 4+ tests covering error badge, fix-clears, warning level, click-to-jump</done>
</task>

<task type="auto">
  <name>Task 2: Sections 9-10 — Enhance hover and go-to-def assertions</name>
  <read_first>e2e/lsp-features.spec.ts (hover and go-to-def sections), .planning/test-coverage-plan.md (Sections 9, 10)</read_first>
  <files>e2e/lsp-features.spec.ts</files>
  <action>
    Add gap tests to lsp-features.spec.ts for hover (Section 9) and go-to-def (Section 10).

    **DO NOT modify existing tests** — only ADD new test cases within the existing test.describe blocks.

    Hover additions (add to 'LSP Features – Hover' describe):

    1. **Hover on type reference (Integer)** (9.3):
       - Position on 'Integer' in `part engine: Engine;` line (the type reference)
       - Run editor.action.showHover
       - Check .monaco-hover has content with type info

    2. **Hover on comment shows nothing** (9.4):
       - Position on a comment line (// ...)
       - Run showHover
       - .monaco-hover should be hidden or empty

    Go-to-definition additions (add to 'LSP Features – Go to Definition' describe):

    3. **F12 on Engine reference jumps to Engine def line** (10.1):
       - Position at line 4 col 21 (Engine reference: `part engine: Engine;`)
       - Run revealDefinition
       - Wait 2s
       - getEditorPosition should show lineNumber matching `part def Engine` (around line 8)

    4. **Alt+Left returns after go-to-def** (10.4):
       - After F12 navigation, press Alt+Left (go back)
       - Position should return to original line

    Pattern for adding tests:
    ```typescript
    // Inside existing test.describe('LSP Features – Hover', ...) block:
    test('hover on type reference shows type info', async ({ page }) => {
      // ... new test
    });

    // Inside existing test.describe('LSP Features – Go to Definition', ...) block:
    test('F12 on Engine reference jumps to def line', async ({ page }) => {
      // ... new test
    });
    ```

    The Vehicle.sysml line structure:
    - Line 1: package VehicleExample {
    - Line 2: (comment or blank)
    - Line 3: part def Vehicle {
    - Line 4: part engine: Engine;  ← Engine reference at ~col 21
    - Line 8: part def Engine {     ← Engine definition
  </action>
  <verify>
    <automated>npx playwright test e2e/lsp-features.spec.ts --grep "Hover|Go to Definition" --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>lsp-features.spec.ts enhanced with hover type ref, hover comment, go-to-def line assertion, and go-back tests</done>
</task>

</tasks>

<verification>
Overall checks:
- [ ] e2e/diagnostics.spec.ts exists with 4+ tests
- [ ] e2e/lsp-features.spec.ts has 4 new tests added (not replacing existing)
- [ ] `npx playwright test e2e/diagnostics.spec.ts` passes
- [ ] `npx playwright test e2e/lsp-features.spec.ts` passes (all existing + new)
- [ ] No duplicate tests
</verification>

<success_criteria>
- TEST-COV-06: Diagnostics tests pass (error detection, fix clears, warning level), hover shows type info, go-to-definition navigates to correct line
</success_criteria>

<output>
After completion, create `.planning/phases/02-test-coverage/02-test-coverage-04-SUMMARY.md`
</output>
