# Phase 04: architecture-documentation - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Document overall code architecture including React + Monaco Editor + Web Worker LSP structure, data flow between components, and Langium parser integration.

</domain>

<decisions>
## Implementation Decisions

### Documentation Structure & Organization
- **D-01:** Use modular approach with separate pages for each major component (React frontend, Monaco Editor integration, LSP Worker, Langium parser, virtual file store, etc.)

### the agent's Discretion
- Specific organization of individual component documentation pages
- Choice of formatting and styling for documentation pages
- Decision on whether to include code snippets or focus on conceptual explanations
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Specifications
- `.planning/ROADMAP.md` §Phase 4 �?Architecture documentation phase definition and success criteria
- `.planning/REQUIREMENTS.md` §DOC-ARCH-01 through DOC-ARCH-03 �?Specific requirements for architecture documentation

### Technical Implementation
- `src/` �?Source code containing the SysMLv2 Editor implementation
- `src/workers/sysmlLSPWorker.ts` �?Web Worker LSP implementation
- `src/languages/sysmlv2/` �?Langium parser integration and SysMLv2 language support
- `src/components/` �?React components including Monaco Editor integration
- `src/store/` �?Virtual file store and tab management system
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/monacoSetup.ts` �?Monaco Editor initialization and configuration patterns
- `src/indexManager.ts` �?Virtual file store and workspace index management implementation
- `src/workers/stdlibLoader.ts` �?Standard library loading patterns in worker context

### Established Patterns
- Dual-path completion providers (LSP + local fallback) for graceful degradation
- Message-based communication between main thread and Worker via postMessage
- Langium-based parsing for SysMLv2 grammar with typed AST output
- Modular separation of concerns between UI components and worker processes

### Integration Points
- LSP Worker communicates with main thread via postMessage with JSON-RPC protocol
- Monaco Editor integration occurs through editor components in src/components/
- Virtual file store provides file abstraction layer for editor functionality
- Langium parser generates typed AST used by both validation and language features
</code_context>

<specifics>
## Specific Ideas

- "Documentation should clearly show how user actions in the editor flow through to the LSP Worker and back"
- "Each major component (React UI, Monaco Editor, LSP Worker, Langium parser) should have its own dedicated documentation section"
- "The virtual file store and tab management system should be documented as a key enabler of the multi-file editing experience"
</specifics>

<deferred>
## Deferred Ideas

- Interactive architectural diagrams showing real-time data flow �?potential enhancement for future documentation phases
- Video walkthroughs of architecture �?separated into dedicated multimedia documentation phase
- Architecture decision records (ADRs) for major technical choices �?could be part of a future technical documentation phase
</deferred>

---

*Phase: 04-architecture-documentation*
*Context gathered: 2026-04-22*