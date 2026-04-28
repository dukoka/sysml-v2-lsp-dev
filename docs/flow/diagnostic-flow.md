---
description: 诊断流程文档，详细描述从用户在 Monaco 编辑器输入到问题面板显示诊断信息的执行流程。
---

# 诊断流程

本文档详细描述了从用户在 Monaco 编辑器输入到在问题面板显示诊断信息的执行流程。

## 概述

当用户在 Monaco 编辑器中输入时，会执行以下序列来生成和显示诊断信息：
1. Monaco 编辑器检测到内容变化
2. 虚拟文件存储被更新
3. LSP 客户端将文档更新发送到 Worker
4. Worker 处理变化并运行验证
5. 诊断信息被收集并返回给客户端
6. 客户端处理诊断信息并转换为 Monaco 标记
7. Monaco 将标记应用到编辑器并更新问题面板

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

### 5. 验证执行（Langium 解析器 + 自定义验证）
- Worker 的验证系统（在 `src/lsp/worker/validation.ts` 中）被触发
- Langium 解析器重新解析更新的文档以生成 AST
- 自定义验证规则被应用到 AST
- 为任何验证错误或警告生成诊断信息
- 每个诊断信息包含消息、严重性、范围和来源

### 6. 诊断信息收集并返回给客户端
- Worker 收集文档的所有诊断信息
- 发送 `textDocument/publishDiagnostics` 通知给 LSP 客户端
- 通知包含文档 URI 和诊断信息数组

### 7. 客户端处理诊断信息并转换为 Monaco 标记
- LSP 客户端接收诊断通知
- 将每个 LSP 诊断信息转换为 Monaco 标记
- 标记包含消息、严重性、起始/结束位置和来源
- 客户端通过 `monaco.editor.setMarkers` 更新 Monaco 编辑器标记

### 8. Monaco 将标记应用到编辑器
- Monaco 编辑器接收标记
- 将视觉指示器（下划线、颜色）应用到相应的文本范围
- 错误显示为红色下划线，警告显示为黄色下划线

### 9. 问题面板通过 onDiagnosticsChange 回调更新
- 问题面板（在 React 前端中）订阅诊断更改
- 当标记更新时，问题面板接收更新
- 面板以文件、消息、消息和严重性列表显示诊断信息
- 用户可以点击条目导航到源位置

## 序列图

有关此流程的可视化表示，请参阅 [执行流程图](execution-flow-diagrams.md)。

## 相关组件

- `src/virtual-file-store.ts`：管理内存文件表示
- `src/lsp/client.ts`：LSP 客户端实现
- `src/lsp/worker/text-documents.ts`：Worker 文本文档管理
- `src/lsp/worker/validation.ts`：验证和诊断生成
- `src/lsp/worker/langium-integration.ts`：Langium 解析器集成
- `src/react-frontend/src/components/ProblemsPanel.tsx`：问题面板组件

## 注意事项

- 验证在每次文本更改时运行，但为了性能会被去抖动
- 只验证打开的文档以节省资源
- 关闭文档时诊断信息会被清除
- 问题面板显示所有打开文档的诊断信息