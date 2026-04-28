# Requirements: LSP 语法校验标记与代码格式化问题

## Overview

本里程碑聚焦于修复和改进步骤：
1. 语法诊断标记位置准确性
2. 代码格式化功能

## Requirements

### DIAG-MARK-01: 语法校验标记位置修复

**问题描述：**
- 语法错误标记位置不准确
- 诊断标记与实际错误位置有偏差

**验收标准：**
- 解析错误标记显示在正确的行和列
- 语义验证错误标记位置准确

**优先级：** P0 (Critical)

### FMT-IMP-01: 代码格式化功能改进

**问题描述：**
- Format Document 导致所有行首多出一个缩进
- Format Selection 正常工作
- Format Range 功能待验证

**验收标准：**
- Format Document 不会添加额外缩进
- Format Selection 保持正常
- Format Range 功能正常

**优先级：** P0 (Critical)

## Out of Scope

- 暂时不改进 AST-based formatting（使用 brace-depth）
- 暂不添加新的格式化选项

---

*Created: 2026-04-28*