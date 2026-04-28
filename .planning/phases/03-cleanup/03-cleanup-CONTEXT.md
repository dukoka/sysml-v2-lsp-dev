# Phase 03: cleanup - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Clean up the codebase by addressing TODO/FIXME/HACK markers, fixing type suppressions (as any, @ts-ignore), and resolving specific TypeScript type errors to ensure a clean, maintainable codebase with zero blocking issues.

</domain>

<decisions>
## Implementation Decisions

### Handling of TODO/FIXME/HACK Markers
- **D-01:** Classify markers into three categories: blocking (must fix), documented exceptions (can remain with justification), and low-priority (can be deferred)
- **D-02:** Blocking markers are those that represent known bugs, incomplete features, or technical debt that affects core functionality
- **D-03:** Documented exceptions must include a clear justification explaining why the marker cannot be fixed immediately and a target resolution date or condition
- **D-04:** Low-priority markers will be tracked in the project backlog for future consideration but will not block phase completion

### Handling of Type Suppressions (as any, @ts-ignore, @ts-expect-error)
- **D-05:** Type suppressions are only permitted when absolutely necessary and must be accompanied by a detailed comment explaining:
  - Why the suppression is necessary
  - What specific issue it addresses
  - Why alternative approaches were not feasible
  - A plan for removing the suppression when possible
- **D-06:** Blanket suppressions without justification are considered blocking issues that must be resolved
- **D-07:** The @ts-expect-error directive is preferred over @ts-ignore when expecting a specific error, as it provides better type safety

### Fixing Specific TypeScript Type Errors
- **D-08:** Address the playwright.config.ts "process not defined" error by installing @types/node and properly typing the configuration
- **D-09:** Investigate and resolve the sysmlLSPWorker.ts "never type" error by reviewing type annotations and ensuring proper type coverage
- **D-10:** Run npm run typecheck after fixes to verify all TypeScript errors are resolved
- **D-11:** Treat any new type errors discovered during cleanup as blocking issues that must be resolved before phase completion

### Order of Work and Process for Cleanup Phase
- **D-12:** Execute cleanup in this order:
  1. First, fix all TypeScript type errors to establish a clean baseline
  2. Second, address TODO/FIXME/HACK markers starting with blocking issues
  3. Third, review and justify or remove type suppressions
  4. Finally, run comprehensive type checking to verify zero errors
- **D-13:** Use Git to track progress by committing fixes in logical groupings
- **D-14:** Update requirements traceability in REQUIREMENTS.md as cleanup items are completed

### Preventing Regressions
- **D-15:** Enable strict TypeScript options in tsconfig.json to prevent future type safety issues
- **D-16:** Add ESLint rules to detect and prevent common patterns that lead to TODO/FIXME/HACK markers
- **D-17:** Consider adding pre-commit hooks to run type checking and linting before code is committed

### the agent's Discretion
- Specific implementation approaches for fixing individual TODO/FIXME/HACK markers
- Exact refactoring strategies for resolving type suppression needs
- Choice of specific ESLint rules and TypeScript strictness options
- Test methodologies for verifying fixes don't introduce regressions

</decisions>

<specifics>
## Specific Ideas

- "Create a script to automatically detect and report TODO/FIXME/HACK markers with categorization"
- "Establish a template for documenting justified exceptions that includes impact assessment and resolution timeline"
- "Investigate whether the 'never type' error in sysmlLSPWorker.ts is due to missing return paths or incorrect type narrowing"
- "Verify that installing @types/node resolves the playwright.config.ts process type error without causing conflicts"
- "Consider adding a 'cleanup' label in GitHub/GitLab to track these issues going forward"
- "Check if the astUtils.ts file contains actionable TODO comments that were missed in initial scans due to formatting"
</specifics>

<canonical_refs>
## Canonical References

### Quality Standards
- .planning/REQUIREMENTS.md §CLEANUP-01 through CLEANUP-03 �?Specific requirements for code cleanup
- .planning/ROADMAP.md §Phase 3 �?Cleanup phase definition and success criteria
- .planning/PROJECT.md §Key Decisions �?Architectural decisions that inform cleanup approach

### Technical Implementation
- tsconfig.json �?TypeScript configuration that will be updated for stricter checking
- eslint.config.js �?ESLint configuration that will be updated to prevent regressions
- playwright.config.ts �?Configuration file with "process not defined" type error to fix
- src/workers/sysmlLSPWorker.ts �?Worker file with "never type" error to investigate
- src/ �?Source code containing TODO/FIXME/HACK markers and type suppressions to clean up

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/languages/sysmlv2/index.ts �?Shows patterns for handling monaco editor APIs with proper typing
- src/components/CodeEditor.tsx �?Examples of window property extensions that may inform 'as any' usage evaluation
- src/workers/stdlibLoader.ts �?Demonstrates proper async loading patterns in worker context

### Established Patterns
- Proper error handling with specific types rather than blanket 'any' usage
- Modular separation of concerns between main thread and worker
- Consistent use of Langium-generated types for AST nodes

### Integration Points
- Cleanup efforts must maintain compatibility with the Langium grammar framework
- Changes to worker files must preserve the postMessage communication interface
- ESLint and TypeScript configurations must be compatible with existing editor tooling

</code_context>

<deferred>
## Deferred Ideas

- Implementing automated dependency updates to prevent future type definition issues �?potential future maintenance phase
- Adding automated code formatting enforcement (Prettier) �?separated into dedicated developer experience phase
- Creating custom ESLint rules for SysMLv2-specific patterns �?could be its own quality phase
- Setting up automated dependency security scanning �?separate security-focused phase
</deferred>

---

*Phase: 03-cleanup*
*Context gathered: 2026-04-20*