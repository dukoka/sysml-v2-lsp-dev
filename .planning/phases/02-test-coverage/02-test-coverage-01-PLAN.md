---
phase: 02-test-coverage
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/page-load.spec.ts
  - e2e/file-management.spec.ts
  - e2e/outline-panel.spec.ts
  - e2e/lsp-features.spec.ts
autonomous: true
requirements:
  - TEST-COV-01
  - TEST-COV-02
  - TEST-COV-03
must_haves:
  truths:
    - "User runs npm run test:e2e — Playwright executes and passes tests for page load/init (Section 1)"
    - "Browser automation confirms Monaco editor renders with line numbers, stdlib loads (92 files, 1422 types), and theme switching cycles through SysMLv2 Dark / Light / Dark"
    - "User verifies file switching, tab creation, and file closing all work — Outline panel updates with each file switch"
  artifacts:
    - path: "e2e/page-load.spec.ts"
      provides: "Section 1 tests: page renders, Monaco loads, stdlib console logs, theme cycle, LSP connected"
    - path: "e2e/file-management.spec.ts"
      provides: "Section 2 tests: file switch, new file, close tab, close last tab"
    - path: "e2e/outline-panel.spec.ts"
      provides: "Section 3 tests: outline hierarchy, click-to-jump, Requirements.sysml outline"
  key_links:
    - from: "e2e/page-load.spec.ts"
      to: "page.locator('.monaco-editor')"
      via: "waitForSelector + toBeVisible"
      pattern: "monaco-editor"
    - from: "e2e/file-management.spec.ts"
      to: ".file-item click → tab appears"
      via: "Playwright click + expect tab count"
      pattern: "file-item.*click"
    - from: "e2e/outline-panel.spec.ts"
      to: ".outline-item click → editor position changes"
      via: "click + getEditorPosition"
      pattern: "outline-item"
---

<objective>
Audit existing E2E tests and fill gaps for Sections 1-3 of the test-coverage-plan.

Purpose: The existing test files (editor.spec.ts, ide-layout.spec.ts, tabs.spec.ts, sidebar.spec.ts, theme.spec.ts) already cover most of Sections 1-3, but specific test cases from the plan are missing. This plan creates focused test files that fill those gaps and adds the missing verification points.

Output: 3 new/updated E2E test files covering all checklist items in Sections 1-3.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/test-coverage-plan.md
@.planning/codebase/TESTING.md
@.planning/codebase/CONVENTIONS.md

# Existing test files to reference (not duplicate):
@e2e/editor.spec.ts
@e2e/ide-layout.spec.ts
@e2e/tabs.spec.ts
@e2e/sidebar.spec.ts
@e2e/theme.spec.ts
@e2e/lsp-features.spec.ts

# App structure for selectors:
@src/App.jsx
</context>

<interfaces>
From e2e/lsp-features.spec.ts — shared helper pattern:
```typescript
async function waitForEditorAndLsp(page: Page) {
  await page.waitForSelector('.monaco-editor .view-line', { timeout: 15_000 });
  await expect(page.locator('.status-dot.connected')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
}
```

From e2e/editor.spec.ts — key selectors:
- `.editor-area` — editor container
- `.monaco-editor .view-line` — editor content lines
- `.file-item` — sidebar file entries
- `.toolbar-btn[title*="New File"]` — new file button
- `.status-bar` — bottom status bar

From e2e/sidebar.spec.ts — outline selectors:
- `.outline-item` — outline tree entries
- `.sidebar-section-header` — section headers (Files, Outline)

From e2e/theme.spec.ts — theme selectors:
- `.toolbar-select` — theme dropdown
- `html[data-theme]` — theme attribute
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Section 1 — Page load, stdlib, and theme tests</name>
  <read_first>e2e/editor.spec.ts (existing coverage), e2e/ide-layout.spec.ts, e2e/theme.spec.ts, .planning/test-coverage-plan.md (Section 1)</read_first>
  <files>e2e/page-load.spec.ts</files>
  <action>
    Create e2e/page-load.spec.ts with tests for Section 1 items NOT already covered by existing tests:

    1. **Stdlib console log verification** (1.2 items from plan):
       - Listen to console messages during page load
       - Assert no ReferenceError in console (TDZ check)
       - Assert LSP status dot becomes connected

    2. **Theme cycle test** (1.3 item from plan — full cycle):
       - Default is SysMLv2 Dark (toolbar-select value is 'sysmlv2-dark')
       - Switch to Light → data-theme='light', toolbar bg rgb(243,243,243)
       - Switch to Dark → data-theme='dark', toolbar bg rgb(37,37,38)
       - Switch back to SysMLv2 Dark → data-theme='dark', verify syntax highlighting spans exist

    Use the existing helper pattern from lsp-features.spec.ts:
    ```typescript
    import { test, expect, type Page } from '@playwright/test';
    async function waitForEditorAndLsp(page: Page) { ... }
    ```

    DO NOT duplicate tests from editor.spec.ts or ide-layout.spec.ts — only add what's missing.

    CSS selectors: `.monaco-editor`, `.status-dot.connected`, `.toolbar-select`, `html[data-theme]`, `.toolbar`
  </action>
  <verify>
    <automated>npx playwright test e2e/page-load.spec.ts --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>page-load.spec.ts exists with 4+ tests covering stdlib console check, theme full cycle, LSP connected status</done>
</task>

<task type="auto">
  <name>Task 2: Section 2 — File management gap tests</name>
  <read_first>e2e/tabs.spec.ts (existing coverage), e2e/editor.spec.ts, .planning/test-coverage-plan.md (Section 2)</read_first>
  <files>e2e/file-management.spec.ts</files>
  <action>
    Create e2e/file-management.spec.ts with tests for Section 2 items NOT already covered:

    1. **Tab bar shows filename** (2.1 item):
       - After clicking Requirements.sysml, tab text contains 'Requirements.sysml'

    2. **Close last tab behavior** (2.3 item):
       - Open Vehicle.sysml (default), open Requirements.sysml
       - Close Requirements tab, close Vehicle tab
       - Editor shows blank/welcome state OR no tabs remain

    3. **Outline updates on file switch** (2.1 item):
       - Vehicle.sysml outline contains 'VehicleExample'
       - Switch to Requirements.sysml → outline changes to show requirement symbols

    Use existing selectors: `.tab`, `.tab-close`, `.file-item`, `.outline-item`, `.monaco-editor`
    Do NOT duplicate tabs.spec.ts tests — only add gaps.
  </action>
  <verify>
    <automated>npx playwright test e2e/file-management.spec.ts --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>file-management.spec.ts exists with 3+ tests covering tab filename display, close-last-tab, outline update on switch</done>
</task>

<task type="auto">
  <name>Task 3: Section 3 — Outline panel hierarchy and interaction</name>
  <read_first>e2e/sidebar.spec.ts (existing coverage), e2e/lsp-features.spec.ts (document symbols section), .planning/test-coverage-plan.md (Section 3)</read_first>
  <files>e2e/outline-panel.spec.ts</files>
  <action>
    Create e2e/outline-panel.spec.ts with tests for Section 3 items NOT already covered:

    1. **Outline hierarchy for Vehicle.sysml** (3.1 items):
       - Outline shows VehicleExample (package)
       - Under VehicleExample: Vehicle (part def)
       - Under Vehicle: Engine, Wheel (parts)
       - Under Engine: horsepower, displacement (attributes)

       Use `.outline-item` selectors and `.textContent()` to verify symbol names.

    2. **Click outline item jumps to line** (3.2 item):
       - Click an outline item (e.g., Engine)
       - Verify editor cursor position changes (getEditorPosition returns different line)
       - Use evaluate to read `window.__monacoEditorInstance.getPosition()`

    3. **Requirements.sysml outline** (3.3 item):
       - Switch to Requirements.sysml via `.file-item` click
       - Outline updates to show requirement-related symbols

    Helper functions to define inline:
    ```typescript
    async function getEditorPosition(page: Page) {
      return page.evaluate(() => {
        const ed = (window as any).__monacoEditorInstance;
        const pos = ed?.getPosition();
        return { lineNumber: pos?.lineNumber ?? 0, column: pos?.column ?? 0 };
      });
    }
    ```
  </action>
  <verify>
    <automated>npx playwright test e2e/outline-panel.spec.ts --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>outline-panel.spec.ts exists with 3+ tests covering symbol hierarchy, click-to-jump, file-switch outline update</done>
</task>

</tasks>

<verification>
Overall checks:
- [ ] All 3 new spec files exist in e2e/
- [ ] `npx playwright test e2e/page-load.spec.ts` passes
- [ ] `npx playwright test e2e/file-management.spec.ts` passes
- [ ] `npx playwright test e2e/outline-panel.spec.ts` passes
- [ ] No duplicate tests with existing spec files
- [ ] All tests use Playwright patterns from TESTING.md
</verification>

<success_criteria>
- TEST-COV-01: Page load, stdlib loading, and theme switching tests pass
- TEST-COV-02: File switching, tab management, and close behavior tests pass
- TEST-COV-03: Outline hierarchy, click-to-jump, and file-switch outline tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/02-test-coverage/02-test-coverage-01-SUMMARY.md`
</output>
