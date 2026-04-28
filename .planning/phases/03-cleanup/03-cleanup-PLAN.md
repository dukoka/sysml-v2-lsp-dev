# Phase 03: cleanup - Plan

**Phase:** 03-cleanup
**Goal:** Codebase is clean �?no blocking TODOs, no unjustified type suppressions, TypeScript compiles without errors
**Depends on:** Phase 2 (testing validates nothing breaks)
**Requirements:** CLEANUP-01, CLEANUP-02, CLEANUP-03
**Success Criteria** (what must be TRUE):
  1. User searches codebase for TODO/FIXME/HACK �?no blocking markers remain (only documented exceptions)
  2. User searches for `as any` and `@ts-ignore` �?no type suppression without documented justification
  3. User runs `npm run typecheck` �?passes with zero errors (including `playwright.config.ts` process type, `sysmlLSPWorker.ts` never type)

## Plans

### 03-cleanup-01-PLAN.md �?Fix TypeScript type errors
**Goal:** Resolve all TypeScript compilation errors to establish clean baseline
**Tasks:**
- [ ] Install @types/node for playwright.config.ts process type
- [ ] Fix playwright.config.ts "process not defined" error
- [ ] Investigate and fix sysmlLSPWorker.ts "never type" error
- [ ] Run npm run typecheck to verify zero errors
- [ ] Address any additional TypeScript errors discovered

### 03-cleanup-02-PLAN.md �?Address TODO/FIXME/HACK markers
**Goal:** Eliminate blocking TODO/FIXME/HACK markers, document exceptions
**Tasks:**
- [ ] Create script to detect and categorize TODO/FIXME/HACK markers
- [ ] Review all markers and classify as blocking, documented exception, or low-priority
- [ ] Fix all blocking markers
- [ ] Document justified exceptions with clear justification and resolution timeline
- [ ] Track low-priority markers in issue tracker for future consideration

### 03-cleanup-03-PLAN.md �?Remove unjustified type suppressions and prevent regressions
**Goal:** Ensure all type suppressions are justified and add防护 measures
**Tasks:**
- [ ] Review all `as any`, `@ts-ignore`, `@ts-expect-error` usages
- [ ] Remove or justify each suppression with detailed comments
- [ ] Prefer `@ts-expect-error` over `@ts-ignore` when expecting specific errors
- [ ] Enable stricter TypeScript options in tsconfig.json
- [ ] Add ESLint rules to prevent TODO/FIXME/HACK patterns
- [ ] Consider adding pre-commit hooks for type checking and linting

--- 

*Created: '$date'
