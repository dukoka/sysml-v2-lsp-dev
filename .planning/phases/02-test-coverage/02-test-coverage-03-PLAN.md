---
phase: 02-test-coverage
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/completion-contexts.spec.ts
autonomous: true
requirements:
  - TEST-COV-05
must_haves:
  truths:
    - "Sections 5-7 tests pass: keyword/snippet completion in general, definitionBody, and member contexts"
  artifacts:
    - path: "e2e/completion-contexts.spec.ts"
      provides: "Sections 5-7 tests: general keyword/snippet completion, definitionBody context, member (dot) context"
  key_links:
    - from: "e2e/completion-contexts.spec.ts"
      to: ".suggest-widget"
      via: "Ctrl+Space in different cursor contexts"
      pattern: "suggest-widget"
    - from: "cursor inside { } block"
      to: "member keywords (attribute, part, port)"
      via: "definitionBody context detection"
      pattern: "definitionBody"
    - from: "identifier."
      to: "member completion"
      via: "dot trigger"
      pattern: "\\."
---

<objective>
Create E2E tests for completion in general, definitionBody, and member contexts (Sections 5-7 of test-coverage-plan).

Purpose: The existing lsp-features.spec.ts has basic "completion appears" and "contains keywords" tests, but does not test context-specific behavior: keyword snippets in general context (Section 5), member keywords inside { } blocks (Section 6), and dot-triggered member completion (Section 7). This plan fills all those gaps.

Output: e2e/completion-contexts.spec.ts covering Sections 5, 6, and 7.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/test-coverage-plan.md (Sections 5, 6, 7)
@.planning/codebase/TESTING.md
@e2e/lsp-features.spec.ts (existing autocomplete section — DO NOT duplicate basic "completion appears" test)
@e2e/stdlib-completion.spec.ts (existing type-context tests)
</context>

<interfaces>
From e2e/lsp-features.spec.ts — existing tests (DO NOT duplicate):
```typescript
// "completion appears when typing a keyword prefix" — types 'par', Ctrl+Space, widget visible
// "completion contains SysML keywords" — types 'a', Ctrl+Space, widget has content
```

Key patterns from test-coverage-plan:

Section 5 (general context — line start/top level):
- Keywords: part, port, action, state, connection, package, requirement, constraint, calc
- Snippets: pac→package, req→requirement, enu→enum, att→attribute
- Snippet expansion: select enum → expands to `enum Name { value1; value2; }`, cursor at Name

Section 6 (definitionBody context — inside { }):
- Shows attribute, part, port, end keywords
- Shows types (specialization candidates)
- Does NOT show package keyword

Section 7 (member context — after .):
- `vehicleInstance.` → shows ownedElement, member, size, isKindOf
- kind is Function or Property

Key selectors:
- `.suggest-widget:not(.message)` — completion dropdown
- `.suggest-widget .monaco-list-row` — individual items
- `window.__monacoEditorInstance` — editor instance
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Section 5 — General context keyword and snippet tests</name>
  <read_first>e2e/lsp-features.spec.ts (existing autocomplete section), .planning/test-coverage-plan.md (Section 5)</read_first>
  <files>e2e/completion-contexts.spec.ts</files>
  <action>
    Create e2e/completion-contexts.spec.ts with Section 5 tests:

    Helper functions (same pattern as other spec files):
    ```typescript
    import { test, expect, type Page } from '@playwright/test';
    async function waitForEditorAndLsp(page: Page) { ... }
    async function setEditorPosition(page: Page, line: number, column: number) { ... }
    async function typeInEditor(page: Page, text: string) { ... }
    async function getEditorLineCount(page: Page): Promise<number> { ... }
    async function getEditorValue(page: Page): Promise<string> { ... }
    ```

    Tests:

    1. **Line-start keywords (5.1)**:
       - New file (toolbar new file button), wait for LSP
       - Type Ctrl+Space at line start
       - Widget should contain 'part', 'port', 'action', 'package', 'requirement'

    2. **Snippet prefix filtering (5.2 + 5.3)**:
       - Type `pac` → Ctrl+Space → widget should contain 'package'
       - Type `req` → Ctrl+Space → widget should contain 'requirement'
       - Type `enu` → Ctrl+Space → widget should contain 'enum'
       - Type `att` → Ctrl+Space → widget should contain 'attribute'

    3. **Snippet expansion (5.2)**:
       - Type `enu` → Ctrl+Space → select 'enum' item
       - Wait for expansion
       - getEditorValue should contain 'enum' and '{' and '}'
       - Cursor should be positioned for name input

    Each test uses beforeEach: goto('/'), waitForEditorAndLsp, new file via toolbar button.
  </action>
  <verify>
    <automated>npx playwright test e2e/completion-contexts.spec.ts --grep "General" --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>General context tests exist covering keyword completion and snippet prefix/expansion</done>
</task>

<task type="auto">
  <name>Task 2: Section 6 — definitionBody context tests</name>
  <read_first>.planning/test-coverage-plan.md (Section 6), e2e/completion-contexts.spec.ts (created in Task 1)</read_first>
  <files>e2e/completion-contexts.spec.ts</files>
  <action>
    Add Section 6 tests to e2e/completion-contexts.spec.ts:

    Tests (inside part def { } body):

    1. **Member keywords in body (6.1)**:
       - Type: `part def TestBody {\n` then Ctrl+Space
       - Widget should contain 'attribute', 'part', 'port'
       - Widget should NOT contain 'package' (top-level only)

    2. **Attribute keyword prefix in body (6.3)**:
       - Inside body, type `att` → Ctrl+Space
       - Widget should contain 'attribute'

    3. **end keyword in body (6.4)**:
       - Inside body, type `end` → Ctrl+Space
       - Widget should contain 'end'

    Pattern: Create a new file, type a part def, position cursor inside { }, trigger completion.

    Use test.describe('Completion – definitionBody Context', ...) grouping.
  </action>
  <verify>
    <automated>npx playwright test e2e/completion-contexts.spec.ts --grep "definitionBody" --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>definitionBody context tests added — member keywords visible, package hidden</done>
</task>

<task type="auto">
  <name>Task 3: Section 7 — Member (dot) context tests</name>
  <read_first>.planning/test-coverage-plan.md (Section 7), e2e/completion-contexts.spec.ts</read_first>
  <files>e2e/completion-contexts.spec.ts</files>
  <action>
    Add Section 7 tests to e2e/completion-contexts.spec.ts:

    Tests (after . on an instance/type):

    1. **Dot-triggered member completion (7.1)**:
       - In a new file, type: `package DotTest {\n  part def Foo { }\n  part myFoo: Foo;\n}`
       - Position cursor after `myFoo.`
       - Type Ctrl+Space
       - Widget should show member completions (ownedElement, member, etc.)
       - Items may have kind Function or Property

    2. **Built-in functions on dot (7.2)**:
       - Same setup, check if widget contains 'size' or 'isKindOf'

    Note: If dot completion doesn't trigger in this SysMLv2 editor, the test should use the defensive pattern:
    ```typescript
    const isVisible = await suggestWidget.isVisible().catch(() => false);
    if (isVisible) { ... } else { /* pass — dot completion not implemented */ }
    ```

    Use test.describe('Completion – Member Context', ...) grouping.
  </action>
  <verify>
    <automated>npx playwright test e2e/completion-contexts.spec.ts --grep "Member" --reporter=list 2>&1 | tail -20</automated>
  </verify>
  <done>Member context tests added — dot-triggered completion or graceful skip if not implemented</done>
</task>

</tasks>

<verification>
Overall checks:
- [ ] e2e/completion-contexts.spec.ts exists with all 3 sections (5, 6, 7)
- [ ] Tests grouped by test.describe: 'General Context', 'definitionBody Context', 'Member Context'
- [ ] `npx playwright test e2e/completion-contexts.spec.ts` passes (all or with graceful skips)
- [ ] No duplicate tests with lsp-features.spec.ts autocomplete section
</verification>

<success_criteria>
- TEST-COV-05: Keyword/snippet completion tests pass in general context (Section 5), definitionBody context (Section 6), and member context (Section 7)
</success_criteria>

<output>
After completion, create `.planning/phases/02-test-coverage/02-test-coverage-03-SUMMARY.md`
</output>
