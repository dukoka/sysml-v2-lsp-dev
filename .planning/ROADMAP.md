# Roadmap — SysMLv2 Editor

**Granularity:** coarse (2 phases)
**Mode:** yolo
**Total Requirements:** 2

---

## Phases

- [x] **Phase A: 语法校验标记修复** — 修复语法诊断标记位置不准确 (DIAG-MARK-01)
- [ ] **Phase B: 代码格式化改进** — 改进 Format Document/Selection/Range 功能 (FMT-IMP-01)

---

## Phase Details

### Phase A: 语法校验标记修复
**Goal**: 修复语法诊断标记位置不准确
**Requirements**: DIAG-MARK-01
**Success Criteria**:
1. 解析错误标记显示在正确的行和列
2. 语义验证错误标记位置准确
**Plans**: 1 plan
- [x] A-01-PLAN.md — 修复语法诊断标记位置

### Phase B: 代码格式化改进
**Goal**: 改进代码格式化功能
**Requirements**: FMT-IMP-01
**Success Criteria**:
1. Format Document 不会添加额外缩进
2. Format Selection 保持正常
3. Format Range 功能正常
**Plans**: 1 plan
- [ ] B1-格式化改进-PLAN.md — 改进代码格式化功能

---

## Phase Details

### Phase 4: architecture-documentation
**Goal**: Document overall code architecture including React + Monaco Editor + Web Worker LSP structure, data flow between components, and Langium parser integration
**Requirements**: DOC-ARCH-01, DOC-ARCH-02, DOC-ARCH-03
**Success Criteria** (what must be TRUE):
1. User can access architecture overview documentation explaining the high-level structure
2. Documentation clearly describes data flow between UI components and LSP Worker
3. Documentation explains Langium parser integration and AST generation process
**Plans**: 1 plan
- [ ] 04-architecture-documentation-01-PLAN.md — Create architecture overview docs

### Phase 5: module-documentation
**Goal**: Document src/ directory structure and module responsibilities including LSP Worker, Monaco Editor integration, and virtual file store
**Requirements**: DOC-MOD-01, DOC-MOD-02, DOC-MOD-03, DOC-MOD-04
**Success Criteria** (what must be TRUE):
1. User can find documentation for each major module in the src/ directory
2. LSP Worker implementation in sysmlLSPWorker.ts is documented
3. Monaco Editor integration in editor components is documented
4. Virtual file store and tab management system is documented
**Plans**: 1 plan
- [ ] 05-module-documentation-01-PLAN.md — Create module-level documentation

### Phase 6: execution-flow-documentation
**Goal**: Map code execution flows from user input to syntax highlighting, completion, diagnostics, go-to-definition, and find-references
**Requirements**: DOC-FLOW-01, DOC-FLOW-02, DOC-FLOW-03, DOC-FLOW-04
**Success Criteria** (what must be TRUE):
1. User can trace the execution flow from user input to syntax highlighting
2. Documentation shows completion request flow through LSP Worker
3. Documentation explains diagnostic generation and display process
4. Documentation traces go-to-definition and find-references implementation
**Plans**: 1 plan
- [ ] 06-execution-flow-documentation-01-PLAN.md — Create execution flow documentation

### Phase 7: function-level-documentation
**Goal**: Document key functions in lspClient.ts, sysmlLSPWorker.ts, editor components, and virtual file store utilities
**Requirements**: DOC-FN-01, DOC-FN-02, DOC-FN-03, DOC-FN-04
**Success Criteria** (what must be TRUE):
1. Key functions in lspClient.ts (getCompletion, getHover, etc.) are documented
2. Core functions in sysmlLSPWorker.ts are documented
3. Monaco editor integration functions are documented
4. Virtual file store utility functions are documented
**Plans**: 1 plan
- [ ] 07-function-level-documentation-01-PLAN.md — Create function-level documentation

### Phase 8: hierarchical-organization
**Goal**: Create hierarchical documentation structure from high-level to function-level with proper navigation, table of contents, and sidebar for rspress
**Requirements**: DOC-HIER-01, DOC-HIER-02, DOC-HIER-03
**Success Criteria** (what must be TRUE):
1. Hierarchical documentation structure is created from high-level to function-level
2. Proper navigation exists between architectural overview and detailed implementation
3. Table of contents and sidebar navigation are generated for rspress
**Plans**: 1 plan
- [ ] 08-hierarchical-organization-01-PLAN.md — Create hierarchical structure and navigation

---

*Created: 2026-04-22
*Updated: 2026-04-22 - v1.1 milestone started