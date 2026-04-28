---
phase: 02-test-coverage
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/completion-type-context.spec.ts
  - e2e/stdlib-completion.spec.ts
autonomous: true
requirements:
  - TEST-COV-04
must_haves:
  truths:
    - "Section 4 tests pass: type-context completion triggers with prefix filtering (Sc→StructuredType, In→Integer, Re→Real) and insert behavior is correct (no prefix duplication)"
  artifacts:
    - path: "e2e/completion-type-context.spec.ts"
      provides: "Section 4 tests: prefix filtering for In/Re/Bo prefixes, insert behavior, multiple type keywords"
  key_links:
    - from: "e2e/completion-type-context.spec.ts"
      to: ".suggest-widget"
      via: "Ctrl+Space trigger + textContent assertion"
      pattern: "suggest-widget"
    - from: "type-in-editor + prefix"
      to: "completion list content"
      via: "keyboard.type → Ctrl+Space → widget.textContent"
      pattern: "typeInEditor.*Control.Space"
---

<objective>
Create E2E tests for type-context completion (Section 4 of test-coverage-plan).

Purpose: The existing stdlib-completion.spec.ts covers empty-prefix and Sc-prefix tests. This plan fills the remaining Section 4 gaps: In-prefix, Re-prefix, Bo-prefix, nonexistent prefix, insert behavior (no prefix duplication), and multiple type-context keywords (port, attribute, connection, item).

Output: e2e/completion-type-context.spec.ts with comprehensive type-context completion tests.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/test-coverage-plan.md (Section 4)
@.planning/codebase/TESTING.md
@e2e/stdlib-completion.spec.ts (existing type-context tests — DO NOT duplicate)
@e2e/lsp-features.spec.ts (existing autocomplete tests)
</context>

<interfaces>
From e2e/stdlib-completion.spec.ts — existing tests (DO NOT duplicate):
```typescript
// Test 1: completion shows stdlib types (empty prefix after "attribute test : ")
// Test 2: completion filters by prefix (Sc → StructuredType)
```

From e2e/lsp-features.spec.ts — autocomplete helpers:
```typescript
async function waitForEditorAndLsp(page: Page) {
  await page.waitForSelector('.monaco-editor .view-line', { timeout: 15_000 });
  await expect(page.locator('.status-dot.connected')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
}
async function setEditorPosition(page: Page, line: number, column: number) { ... }
async function typeInEditor(page: Page, text: string) { ... }
async function getEditorLineCount(page: Page): Promise<number> { ... }
async function getEditorValue(page: Page): Promise<string> { ... }
```

Key selectors:
- `.suggest-widget:not(.message)` — completion dropdown
- `window.__monacoEditorInstance` — Monaco editor instance
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Prefix filtering tests (In, Re, Bo, nonexistent)</name>
  <read_first>e2e/stdlib-completion.spec.ts (existing Sc test), .planning/test-coverage-plan.md (Section 4.2)</read_first>
  <files>e2e/completion-type-context.spec.ts</files>
  <action>
    Create e2e/completion-type-context.spec.ts with these tests:

    Helper functions (copy pattern from lsp-features.spec.ts):
    ```typescript
    import { test, expect, type Page } from '@playwright/test';
    async function waitForEditorAndLsp(page: Page) { ... }
    async function setEditorPosition(page: Page, line: number, column: number) { ... }
    async function typeInEditor(page: Page, text: string) { ... }
    async function getEditorLineCount(page: Page): Promise<number> { ... }
    async function getEditorValue(page: Page): Promise<string> { ... }
    ```

    Test cases (prefix filtering — Section 4.2):

    1. **In prefix → Integer, Interface only**:
       - Navigate to end of Vehicle.sysml, new line
       - Type `attribute test : In`
       - Ctrl+Space → wait for .suggest-widget
       - textContent should include 'Integer' and/or 'Interface'
       - textContent should NOT include 'Real', 'Boolean', 'String'

    2. **Re prefix → Real, Relation only**:
       - Same setup, type `attribute test : Re`
       - Ctrl+Space → widget contains 'Real' or 'Relation'
       - Should NOT include 'Integer', 'Boolean'

    3. **Bo prefix → Boolean**:
       - Same setup, type `attribute test : Bo`
       - Ctrl+Space → widget contains 'Boolean'
       - Should NOT include 'Integer', 'Real'

    4. **Nonexistent prefix (xyz123) → empty/no match**:
       - Type `attribute test : xyz123`
       - Ctrl+Space → widget may show empty or "No suggestions"

    Test cases (insert behavior — Section 4.3):

    5. **No prefix duplication on select**:
       - Type `attribute test : In`
       - Ctrl+Space, wait for widget
       - Click or press Enter to select 'Integer'
       - getEditorValue should contain 'attribute test : Integer' (NOT 'attribute test : InInteger')
       - Use `.monaco-editor .view-line` textContent to verify

    Test cases (multiple keywords — Section 4.4):

    6. **port type context triggers completion**:
       - Type `port p : ` then Ctrl+Space
       - Widget should show type suggestions

    7. **connection type context triggers completion**:
       - Type `connection c : ` then Ctrl+Space
       - Widget should show type suggestions

    Each test: beforeEach navigates to page, waitForEditorAndLsp, goes to end of file, presses Enter for new line.
  </action>
  <verify>
    <automated>npx playwright test e2e/completion-type-context.spec.ts --reporter=list 2>&1 | tail -30</automated>
  </verify>
  <done>completion-type-context.spec.ts exists with 7+ tests covering prefix filtering (In/Re/Bo/nonexistent), insert behavior (no duplication), and multiple keyword type contexts</done>
</task>

<task type="auto">
  <name>Task 2: Enhance stdlib-completion.spec.ts with missing assertions</name>
  <read_first>e2e/stdlib-completion.spec.ts, .planning/test-coverage-plan.md (Sections 4.1, 4.3)</read_first>
  <files>e2e/stdlib-completion.spec.ts</files>
  <action>
    Add missing test items to the existing stdlib-completion.spec.ts:

    1. **detail label shows "type"** (Section 4.1):
       - In the existing "completion shows stdlib types" test, after widget is visible:
       - Check `.suggest-widget .details-label` or `.suggest-widget .monaco-list-row` for "type" detail
       - Use page.evaluate to read suggest widget item details

    2. **Cursor position after insert** (Section 4.3):
       - After selecting a completion item, verify cursor is at end of inserted text
       - Use window.__monacoEditorInstance.getPosition() to check column

    DO NOT modify existing test logic — only add additional assertions or new test cases.
    Be conservative: if a selector might not exist in this Monaco version, wrap in try/catch or use isVisible().catch(() => false) pattern.
  </action>
  <verify>
    <automated>npx playwright test e2e/stdlib-completion.spec.ts --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>stdlib-completion.spec.ts enhanced with detail label check and cursor position assertion</done>
</task>

</tasks>

<verification>
Overall checks:
- [ ] e2e/completion-type-context.spec.ts exists with 7+ tests
- [ ] e2e/stdlib-completion.spec.ts enhanced without breaking existing tests
- [ ] `npx playwright test e2e/completion-type-context.spec.ts` passes
- [ ] `npx playwright test e2e/stdlib-completion.spec.ts` passes
- [ ] No duplicate tests between new and existing files
</verification>

<success_criteria>
- TEST-COV-04: Type-context completion tests pass with prefix filtering (Sc/In/Re/Bo), insert behavior (no duplication), and multiple keyword contexts
</success_criteria>

<output>
After completion, create `.planning/phases/02-test-coverage/02-test-coverage-02-SUMMARY.md`
</output>
