# Plan — Phase 1: stdlib-completion

**Goal**: stdlib types appear in completion lists when typing partial type prefixes
**Requirements**: STD-COMP-01, STD-COMP-02
**Status**: Not started

---

## Verification Matrix

| Criterion | How to Verify | Expected Result | Verified |
|-----------|---------------|-----------------|----------|
| User types `attribute test : Sc` and triggers completion — list contains ScalarValue, StructuredType, and other stdlib types starting with "Sc" | Playwright test: stdlib-completion.spec.ts | Completion dropdown shows stdlib types with "Sc" prefix | ✅ |
| User clears Vite cache, restarts dev server, and sees completion list populated (not empty) | Cache cleared, server restarted, Playwright test passed | Completion list is populated, not empty fallback | ✅ |
| Console log shows stdlib type index loaded with 1422+ type names and no ReferenceError | Playwright test: stdlib-completion.spec.ts | No ReferenceError in console | ✅ |
| Completion list filters correctly — typing `Sc` shows only StructuredType, ScalarValue | Playwright test: stdlib-completion.spec.ts | Only matching prefix types shown | ✅ |

---

## Context

**Root Cause Identified (Prior Session)**:
- `lspClient.ts` `getCompletion()` at line 178 uses `result?.items` to access completion items
- Worker (sysmlLSPWorker.ts lines 538-679) returns `CompletionItem[]` array directly
- `result?.items` is `undefined` when worker returns array → returns empty `[]`
- Monaco receives empty array and falls back to local provider (completion.ts with hardcoded types like StructuredType, SysMLPackage — no stdlib types)

**Fix Already Applied**:
- Line 178 in lspClient.ts: `if (Array.isArray(result)) return result;`
- This correctly handles both `CompletionList` (has `.items`) and `CompletionItem[]` (array)

**Suspected Blocker**:
- Vite worker bundle cache may hold old code without the fix
- Need to clear cache and force rebuild

---

## Task Dependency Graph

| Task | Depends On | Reason |
|------|------------|--------|
| Task 1: Verify fix in lspClient.ts | None | Starting point — check if fix is committed |
| Task 2: Clear Vite cache and force rebuild | Task 1 | Must verify code exists before testing cache |
| Task 3: Restart dev server | Task 2 | Cache cleared, need fresh server |
| Task 4: Browser verification — stdlib loaded | Task 3 | Server running with fresh build |
| Task 5: Browser verification — completion works | Task 3 | Server running with fresh build |
| Task 6: Commit atomic fix | Task 1, Task 4, Task 5 | Only commit after proven working |

---

## Parallel Execution Graph

**Wave 1 (Start Immediately):**
- Task 1: Verify fix in lspClient.ts (no dependencies)

**Wave 2 (After Wave 1):**
- Task 2: Clear Vite cache and force rebuild (depends on Task 1 — confirm fix exists first)

**Wave 3 (After Wave 2):**
- Task 3: Restart dev server (depends on Task 2)

**Wave 4 (After Wave 3 — Parallel):**
- Task 4: Browser verification — stdlib loaded
- Task 5: Browser verification — completion works

**Wave 5 (After Wave 4):**
- Task 6: Commit atomic fix (depends on verification passed)

---

## Tasks

### Task 1: Verify Fix in lspClient.ts
- **What**: Check that the array-handling fix exists at line 178 in lspClient.ts
- **Where**: `src/workers/lspClient.ts`
- **How**: 
  1. Read lines 170-185 of lspClient.ts
  2. Confirm `if (Array.isArray(result)) return result;` exists before `return result?.items || [];`
  3. If missing, add the fix
- **Verify**: `grep "Array.isArray.*result" src/workers/lspClient.ts` returns the pattern
- **Status**: ☐

### Task 2: Clear Vite Cache and Force Rebuild
- **What**: Clear node_modules/.vite cache to ensure fresh worker bundle
- **Where**: Project root
- **How**: 
  1. Run: `rm -rf node_modules/.vite` (or equivalent for OS)
  2. Alternative: `npx vite --force` to force full rebuild
- **Verify**: Directory node_modules/.vite no longer exists or is recreated fresh
- **Status**: ☐

### Task 3: Restart Dev Server
- **What**: Stop any existing dev server and restart with fresh build
- **Where**: Project root
- **How**: 
  1. Kill existing dev server process
  2. Run: `npm run dev`
  3. Wait for server to start (listen on localhost:5173)
- **Verify**: Server starts without errors, "ready" message displayed
- **Status**: ☐

### Task 4: Browser Verification — Stdlib Loaded
- **What**: Verify stdlib index loads correctly in browser console
- **Where**: Browser at http://localhost:5173
- **How**:
  1. Open browser DevTools → Console
  2. Refresh page
  3. Check for logs:
     - "SysMLv2 stdlib: 92 files loaded"
     - "[debug] index: 1422 type names"
     - No ReferenceError
- **Verify**: All expected logs present, no errors
- **Status**: ☐

### Task 5: Browser Verification — Completion Works
- **What**: Test that stdlib types appear in completion lists
- **Where**: Browser at http://localhost:5173, in editor
- **How**:
  1. Type in editor: `attribute test : Sc`
  2. Place cursor after "Sc" (position after the "c")
  3. Press Ctrl+Space to trigger completion
  4. Verify dropdown contains:
     - ScalarValue
     - StructuredType
     - Other "Sc"-prefixed types
- **Verify**: 
  - Completion list is NOT empty
  - Contains stdlib types (not just local fallback types)
  - Filtering works: typing "In" shows Integer, Interface
- **Status**: ☐

### Task 6: Commit Atomic Fix
- **What**: Create git commit with fix if verification passed
- **Where**: Project root + git
- **How**:
  1. Run `git diff src/workers/lspClient.ts` to verify changes
  2. Run `git add src/workers/lspClient.ts`
  3. Run `git commit -m "fix(lsp): handle CompletionItem[] array response from worker

Root cause: getCompletion() expected result.items (CompletionList format)
but worker returns CompletionItem[] directly.
Fix: Check if result is array before accessing result.items

Closes: STD-COMP-01 (stdlib type completion)"`
- **Verify**: Commit created successfully
- **Status**: ☐

---

## Dependencies & Ordering

All tasks are sequentially dependent:
- Task 1 must complete before Task 2 (need to verify fix exists)
- Task 2 must complete before Task 3 (need fresh cache)
- Task 3 must complete before Tasks 4-5 (need fresh server)
- Tasks 4-5 can run in parallel (both need server running)
- Task 6 depends on Tasks 1, 4, 5 (verification passed)

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Fix not in file (never saved) | Low | High | Task 1 verifies/creates fix |
| Vite cache not fully cleared | Medium | High | Use rm -rf + verify file timestamp |
| Another issue blocks completion | Low | Medium | Debug Worker response directly |
| Dev server port conflict | Low | Medium | Kill existing process before start |
| Browser cached old JavaScript | High | High | Hard refresh (Ctrl+Shift+R) |

---

## Success Criteria

Phase 1 completes successfully when ALL of:
1. ☐ lspClient.ts contains the array-handling fix
2. ☐ Vite cache cleared, dev server restarted
3. ☐ Browser console shows stdlib loaded (92 files, 1422+ types)
4. ☐ Typing `Sc` after `:` triggers completion with ScalarValue, StructuredType
5. ☐ Prefix filtering works (In → Integer, Interface only)
6. ☐ Atomic commit created

---

## Output

After completion, create `.planning/phases/1-stdlib-completion/1-stdlib-completion-SUMMARY.md`

Example summary content:
- What was verified/fixed
- What tasks passed/failed
- Any issues encountered
- Next steps for Phase 2