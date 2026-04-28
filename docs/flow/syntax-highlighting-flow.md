# 语法高亮流程

本文档详细描述了从用户在 Monaco 编辑器中输入到更新语法高亮的执行流程。

## 概述

当用户在 Monaco 编辑器中输入时，会执行以下序列来更新语法高亮：

1. Monaco 编辑器检测内容更改
2. 虚拟文件存储被更新
3. LSP 客户端将文档更新发送到 Worker
4. Worker 使用 Langium 重新解析文档
5. Worker 生成语义标记
6. 语义标记返回给客户端
7. 客户端应用语义标记到 Monaco 编辑器
8. Monaco 编辑器更新语法高亮显示

## 详细步骤

### 1. Monaco 编辑器 onDidChangeContent 事件

- 用户在编辑器中输入
- Monaco 编辑器触发 `onDidChangeContent` 事件
- 事件包含更改的文本和位置信息

### 2. 虚拟文件存储更新

- 虚拟文件存储（位于 `src/virtual-file-store.ts`）接收更改通知
- 更新文档的内存表示
- 保持 Monaco 编辑器和 LSP Worker 视图之间的同步

### 3. LSP 客户端 updateDocument 调用

- LSP 客户端（在 `src/lsp/client.ts` 中）调用 `updateDocument` 方法
- 向 LSP Worker 发送 `textDocument/didChange` 通知
- 包含文档 URI、版本和内容更改

### 4. Worker TextDocuments onDidChangeContent 事件

- LSP Worker（在 `src/lsp/worker/text-documents.ts` 中）接收通知
- 为特定文档触发 `onDidChangeContent` 事件
- 更新 Worker 内部文档表示

### 5. Langium 重新解析

- Worker 的语义分析系统被触发
- Langium 解析器重新解析更新的文档
- 生成新的抽象语法树 (AST)

### 6. 语义标记生成

- Worker 遍历 AST 以识别令牌类型
- 生成语义标记（与 TextMate 不同的方法）
- 标记表示标识符、关键字、类型等

### 7. 语义标记返回给客户端

- Worker 发送 `textDocument/semanticTokens` 响应
- 响应包含令牌数据（按行和列）
- 每个令牌有类型和修饰符信息

### 8. 客户端应用语义标记

- LSP 客户端接收语义标记响应
- 转换为 Monaco 装饰格式
- 应用装饰到编辑器

### 9. Monaco 更新语法高亮显示

- Monaco 编辑器接收装饰
- 应用颜色和样式到相应的文本范围
- 用户立即看到更新的高亮

## 序列图

有关此流程的可视化表示，请参阅 [执行流程图](../execution-flows/execution-flow-diagrams.md)。

## 相关组件

- `src/virtual-file-store.ts`：管理内存文件表示
- `src/lsp/client.ts`：LSP 客户端实现
- `src/lsp/worker/text-documents.ts`：Worker 文本文档管理
- `src/lsp/worker/semantic-tokens.ts`：语义标记生成
- `src/languages/sysmlv2/tokens.ts`：令牌类型定义

## 注意事项

- 语义高亮更新是即时的（不去抖动），因为它只影响显示
- Worker 缓存最近的 AST 以提高性能
- 只为打开的文档生成语义标记
- Monaco 使用语义标记更新颜色，而不使用 TextMate 规则