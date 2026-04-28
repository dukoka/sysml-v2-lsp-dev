---
description: 补全流程文档，详细描述从用户在 Monaco 编辑器触发补全到显示补全建议的执行流程。
---

# 补全流程

本文档详细描述了从用户在 Monaco 编辑器触发补全到显示补全建议的执行流程。

## 概述

当用户触发补全时（通过触发字符或手动请求），会执行以下序列：
1. Monaco 编辑器触发补全请求
2. LSP 客户端将补全请求发送到 Worker
3. Worker 处理请求并生成补全项
4. 补全项返回给客户端
5. 客户端处理并将项返回给 Monaco
6. Monaco 显示补全建议

## 详细步骤

### 1. Monaco 编辑器触发字符或手动请求
- 用户输入触发字符（如 `.`、`:`）或按下 Ctrl+空格
- Monaco 编辑器触发补全请求
- 请求包含当前文档位置和上下文

### 2. LSP 客户端 getCompletion 调用
- LSP 客户端（在 `src/lsp/client.ts` 中）调用 `getCompletion` 方法
- 向 LSP Worker 发送 `textDocument/completion` 请求
- 包含文档 URI、位置和补全上下文

### 3. Worker textDocument/completion 请求处理器
- LSP 客户端（在 `src/lsp/worker/completion.ts` 中）接收请求
- 处理器提取文档和位置信息
- 确定补全上下文（光标前的内容）

### 4. 补全上下文检测和项生成
- Worker 分析光标前的文本以确定需要哪种补全
- 使用 Langium AST 理解语义上下文
- 根据以下情况生成适当的补全项：
  - 关键字（如果在语句开头）
  - 属性名（如果在 `.` 之后）
  - 类型名（如果在 `:` 之后）
  - 变量名（在表达式中）
  - 等等
- 每个补全项包含 label、kind、detail 和文档

### 5. 补全项返回给客户端
- Worker 发送 `textDocument/completion` 响应给 LSP 客户端
- 响应包含补全项数组
- 每个项包含显示和插入所需的信息

### 6. 客户端处理并将项返回给 Monaco
- LSP 客户端接收补全响应
- 处理项（可以过滤、排序或增强）
- 通过 LSP 提供者接口将项返回给 Monaco 编辑器

### 7. Monaco 显示补全建议
- Monaco 编辑器接收补全项
- 在补全小组件中格式化和显示
- 用户可以使用方向键导航列表
- 按 Enter 或 Tab 插入所选补全

## 序列图

有关此流程的可视化表示，请参阅 [执行流程图](execution-flow-diagrams.md)。

## 相关组件

- `src/lsp/client.ts`：LSP 客户端实现
- `src/lsp/worker/completion.ts`：补全请求处理器
- `src/lsp/worker/langium-integration.ts`：Langium 解析器集成
- `src/lsp/worker/scope-completion.ts`：基于作用域的补全逻辑

## 注意事项

- 补全请求被去抖动以防止过多的 Worker 负载
- Worker 缓存 AST 信息以提高补全性能
- 不同的补全提供者处理不同的上下文（值、类型等）