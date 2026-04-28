# Phase 02: test-coverage - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute end-to-end test coverage for the SysMLv2 Editor via Playwright automation covering Sections 1-10 of the test-coverage-plan. This phase validates all core IDE features work correctly after the stdlib completion fix from Phase 1.

</domain>

<decisions>
## Implementation Decisions

### Test Execution Approach
- **D-01:** Use Playwright for all E2E testing as specified in test-coverage-plan.md
- **D-02:** Execute tests in Sections 1-10 priority order as outlined in the roadmap
- **D-03:** Require stdlib completion fix from Phase 1 to be working before Section 4 tests (type-context completion)

### Test Environment
- **D-04:** Run tests against local dev server (npm run dev) with fresh Vite cache for each test run
- **D-05:** Ensure Monaco editor loads with stdlib types (92 files, 1422+ types) before test execution
- **D-06:** Test theme switching through all available themes (SysMLv2 Dark / Light / Dark)

### Success Validation
- **D-07:** Consider a test section "passing" only when all tests in that section pass consistently
- **D-08:** Require zero test flakiness - tests must pass on multiple consecutive runs
- **D-09:** Capture screenshots and videos for failed test sections for debugging

### the agent's Discretion
- Specific Playwright test implementation details
- Exact timing and waiting strategies for asynchronous operations
- Test data generation approaches for file management tests
- Specific assertion libraries/helpers to use within Playwright tests

</decisions>

<specifics>
## Specific Ideas

- "Tests should verify file switching, tab creation, and file closing all work with outline panel updating accordingly"
- "Type-context completion tests should validate prefix filtering works correctly (Sc→StructuredType, In→Integer, Re→Real)"
- "Diagnostics tests should confirm errors appear for broken code and clear when fixed"
- "Hover tests should validate type information displays correctly for stdlib and user-defined types"
- "Go-to-definition tests should verify navigation to correct definition locations"
</specifics>

<canonical_refs>
## Canonical References

### Test Specifications
- `.planning/test-coverage-plan.md` �?Complete E2E test plan with Sections 1-10 detailing all test cases
- `.planning/ROADMAP.md` §Phase 2 �?Test-coverage phase definition and success criteria
- `.planning/REQUIREMENTS.md` §TEST-COV-01 through TEST-COV-06 �?Specific requirements for test coverage

### Technical Implementation
- `playwright.config.ts` �?Playwright configuration for test execution
- `src/` �?Source code containing the SysMLv2 Editor implementation under test
- `e2e/` �?Directory for E2E test implementations (to be created during this phase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lspClient.ts` �?LSP client that communicates with Worker (fixed in Phase 1)
- `src/sysmlLSPWorker.ts` �?Web Worker LSP implementation returning CompletionItem[]
- `src/monacoSetup.ts` �?Monaco Editor initialization and configuration
- `src/indexManager.ts` �?Virtual file store and workspace index management

### Established Patterns
- Dual-path completion providers (LSP + local fallback) �?Used for graceful degradation when Worker fails
- Message-based communication between main thread and Worker via postMessage
- Langium-based parsing for SysMLv2 grammar with typed AST output

### Integration Points
- Test infrastructure will need to connect to dev server running on localhost
- Tests will interact with Monaco Editor instance via its API
- Test setup should ensure stdlib is loaded from /sysml.library/ virtual filesystem
</code_context>

<deferred>
## Deferred Ideas

- Performance benchmarks for completion response time �?potential future optimization phase
- Additional E2E sections for advanced features (Inlay Hints, Semantic Tokens, etc.) �?v2 requirements
- Visual regression testing for editor appearance �?separated into dedicated UI testing phase
</deferred>

---

*Phase: 02-test-coverage*
*Context gathered: 2026-04-20*