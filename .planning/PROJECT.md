# Project: SysMLv2 Language Editor

## What This Is

纯浏览器端的 SysMLv2 语言编辑器，基于 React + Monaco Editor + Web Worker LSP 实现。无需 Node.js 后端，所有语言服务（语法高亮、补全、诊断、跳转定义、引用查找、重命名等）均在浏览器的 Web Worker 线程中完成�?
## Core Value

提供 SysMLv2 建模语言的完�?IDE 体验（补全、诊断、导航、重构），全部在浏览器内运行，零服务器依赖�?

## Current Milestone: LSP 语法校验标记与代码格式化问题。**Status: ACTIVE**

## Requirements

### Validated (existing capabilities)

- �?Monaco Editor integration with syntax highlighting
- �?SysMLv2 Monarch tokenizer (keywords, types, comments, strings)
- �?LSP Worker with JSON-RPC over postMessage
- �?Diagnostics (parse errors + semantic validation)
- �?Code completion (keywords, types, snippets) �?LSP-first with local fallback
- �?Hover information
- �?Go to Definition (single-file + cross-file via index)
- �?Find References (single-file + cross-file)
- �?Rename Symbol (single-file + cross-file)
- �?Document Symbols (outline panel)
- �?Code Folding
- �?Semantic Token highlighting
- �?Signature Help
- �?Code Actions (quick fixes)
- �?Document Formatting
- �?Multi-file workspace index (indexManager.ts)
- �?Standard library loading (92 files from /sysml.library/)
- �?Virtual file store with tab management
- �?Theme switching (dark/light/SysMLv2 Dark)
- �?Stdlib type completion (fixed in v1.0/v1.2) �?STD-COMP-01, STD-COMP-02
- �?E2E test coverage (completed in v1.0/v1.2) �?TEST-COV-01
- �?Codebase cleanup (completed in v1.0/v1.2) �?CLEANUP-01, CLEANUP-02
- �?Project documentation with rspress (completed in v1.1) �?DOC-ARCH-*, DOC-MOD-*, DOC-FLOW-*, DOC-FN-*, DOC-HIER-*

### Active (this session)

- **语法校验标记修复** — 修复语法诊断标记位置不准确 (DIAG-MARK-01)
- **代码格式化改进** — 改进 Format Document/Selection/Range 功能 (FMT-IMP-01)


## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? �?Move to Out of Scope with reason
2. Requirements validated? �?Move to Validated with phase reference
3. New requirements emerged? �?Add to Active
4. Decisions to log? �?Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check �?still the right priority?
3. Audit Out of Scope �?reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-22 after starting milestone v1.1*
