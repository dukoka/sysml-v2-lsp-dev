---
description: 基于 Web Worker 的语言服务器协议 (LSP) 实现细节，用于 SysMLv2，包括架构、消息处理、语言功能和集成点。
---

# LSP Worker 实现

本文档解释 SysMLv2 编辑器中基于 Web Worker 的语言服务器协议 (LSP) 的实现。

## 概述

LSP Worker（`src/workers/sysmlLSPWorker.ts`）是实现语言服务器协议的 Web Worker，为 SysMLv2 提供语言功能。它在独立于主 UI 的线程中运行，确保计算密集的语言处理不会阻塞用户界面。

## 架构

```
主线程 (UI)
    ↓ postMessage (JSON-RPC)
Web Worker (LSP 服务器)
    ↓ Langium 解析器
SysMLv2 源代码 → 类型化 AST → 语言功能
```

## 职责

LSP Worker 负责：
- 通过 postMessage 从主线程接收 JSON-RPC 请求
- 使用 Langium 解析器处理 SysMLv2 源代码
- 实现 LSP 语言功能：
  * 代码补全
  * 悬停信息
  * 跳转到定义
  * 查找引用
  * 诊断（验证）
  * 符号信息
  * 重命名符号
  * 代码操作
- 将响应和通知发送回主线程
- 管理标准库加载和可用性
- 通过索引管理器维护工作区状态

## 关键实现细节

### Worker 初始化

Worker 初始化 SysMLv2 的 Langium 解析器并设置消息处理：

```typescript
// 初始化 SysMLv2 的 Langium 解析器
const { sysmlV2LangiumService } = await createSysmlV2Services();

// 设置消息处理程序
onmessage = async (event: MessageEvent) => {
  const message = event.data;
  // 处理 JSON-RPC 消息
  await handleMessage(message);
};
```

### 消息处理

Worker 使用 JSON-RPC 处理程序处理传入消息：

```typescript
async function handleMessage(message: unknown): Promise<void> {
  if (!isRpcMessage(message)) {
    return;
  }

  if (isRequest(message)) {
    // 处理请求（返回响应）
    const result = await handleRequest(message);
    // 发送响应
    postMessage({ ...message, id: message.id, result });
  } else if (isNotification(message)) {
    // 处理通知（不期望响应）
    await handleNotification(message);
  }
}
```

### 语言功能实现

每个 LSP 功能都实现为处理程序函数：

#### 代码补全
```typescript
async function handleCompletionRequest(
  request: CompletionRequest
): Promise<CompletionItem[] | CompletionList | null> {
  const document = documents.get(request.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    const completionItems = await sysmlV2LangiumService.completionProvider
      .getCompletions(document, request.position, request.context);
    return completionItems;
  } catch (error) {
    logger.error('补全请求失败：', error);
    return null;
  }
}
```

#### 悬停信息
```typescript
async function handleHoverRequest(
  request: HoverRequest
): Promise<Hover | null> {
  const document = documents.get(request.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    const hover = await sysmlV2LangiumService.hoverProvider.getHover(
      document,
      request.position
    );
    return hover;
  } catch (error) {
    logger.error('悬停请求失败：', error);
    return null;
  }
}
```

#### 诊断信息
```typescript
async function validateDocument(
  document: TextDocument
): Promise<Diagnostic[]> {
  try {
    const diagnosticReport = await sysmlV2LangiumService.diagnostic(
      document
    );
    return diagnosticReport.diagnostics;
  } catch (error) {
    logger.error('验证失败：', error);
    return [];
  }
}
```

### 标准库加载

Worker 使用 `stdlibLoader.ts` 加载标准库文件：

```typescript
// 加载标准库文件
const stdlibFiles = await stdlibLoader.loadStdlibFiles();
// 使它们对 Langium 解析器可用
stdlibFiles.forEach((content, uri) => {
  documents.put(uri, TextDocument.create(uri, 'sysmlv2', 0, content));
});
```

### 工作区索引管理

Worker 使用 `indexManager.ts` 维护工作区状态：

```typescript
// 在索引管理器中更新文档
indexManager.updateDocument(uri, document.getText());

// 获取所有文档以实现跨文件功能
const allDocuments = indexManager.getAllDocuments();
```

## 通信协议

Worker 使用 JSON-RPC over postMessage 与主线程通信：

### 请求格式（主线程 → Worker）
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "textDocument/completion",
  "params": {
    "textDocument": { "uri": "file:///path/to/file.sysml" },
    "position": { "line": 10, "character": 5 },
    "context": { "triggerKind": 1 }
  }
}
```

### 响应格式（Worker → 主线程）
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "label": "part",
      "kind": 14, // 常量
      "detail": "part 定义",
      "documentation": "定义一个部件",
      "insertText": "part ${1:name} : ${2:type};"
    }
  ]
}
```

### 通知格式（Worker → 主线程）
```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/publishDiagnostics",
  "params": {
    "uri": "file:///path/to/file.sysml",
    "diagnostics": [
      {
        "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 10 } },
        "message": "期望 ';'",
        "severity": 1, // 错误
        "source": "SysMLv2"
      }
    ]
  }
}
```

## 线程安全考虑

作为 Web Worker，LSP Worker 有特定的线程考虑：
- 不能直接访问 DOM 或 window 对象
- 所有通信必须通过 postMessage 进行
- 与主线程没有共享状态（除非通过消息）
- Langium 解析器实例隔离到 worker 线程
- 标准库加载完全在 worker 上下文中进行

## 错误处理

Worker 实现健壮的错误处理：
- 单个请求失败不会使 worker 崩溃
- 错误被记录并发送适当的错误响应
- 错误发生后 worker 继续处理其他请求
- 初始化期间的关键错误被记录但不终止 worker

## 性能考虑

- 语言处理在主线程之外进行，防止 UI 冻结
- 通过 Langium 可能进行增量解析和缓存
- 标准库在 worker 初始化期间加载一次
- 文档更新通过索引管理器高效处理
- 内存使用通过限制索引管理器中的文档历史来管理

## 集成点

### 与主线程（lspClient.ts）
- 通过 postMessage 接收 JSON-RPC 请求
- 通过 postMessage 发送 JSON-RPC 响应和通知
- 遵循 LSP 消息格式规范

### 与 Langium 解析器
- 使用 Langium 服务解析 SysMLv2
- 调用语言功能提供者（补全、悬停等）
- 处理验证的诊断报告
- 使用解析器生成的类型化 AST 节点

### 与索引管理器
- 存储和检索文档内容
- 为跨文件功能提供工作区范围的文档访问
- 维护文档版本历史

### 与标准库加载器
- 初始化期间加载标准库文件
- 使标准库内容对 Langium 解析器可用
- 需要时更新标准库

## 使用示例

当用户在编辑器中输入时：
1. CodeEditor.tsx 检测文本更改
2. lspClient.ts 通过 postMessage 发送补全请求
3. sysmlLSPWorker.ts 接收请求
4. Worker 使用 Langium 解析器处理请求
5. Worker 通过 postMessage 发送补全响应
6. lspClient.ts 处理响应
7. CodeEditor.tsx 在 Monaco 编辑器中显示补全建议

这种架构在提供强大语言功能的同���确保响应迅速的 UI。