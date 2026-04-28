---
description: SysMLv2 编辑器中的数据流，解释 UI 组件（运行在主线程）与语言服务器协议 (LSP) Worker（运行在 Web Worker 中）之间的通信。
---

# SysMLv2 编辑器中的数据流

## 概述

本文档解释 SysMLv2 编辑器各组件之间的数据流，特别关注 UI 组件（运行在主线程）与语言服务器协议 (LSP) Worker（运行在 Web Worker 中）之间的通信。

## 主要数据流路径

### 1. 用户交互 → 编辑器状态 → 文件存储

```
用户操作（输入、点击等）
          ↓
Monaco 编辑器（在 CodeEditor.tsx 中）
          ↓
事件处理程序（onContentChange、onCursorChange 等）
          ↓
App 组件（通过 props 回调）
          ↓
文件存储更新（updateFileContent、setCursorPosition 等）
          ↓
React 状态更新 → 组件重新渲染
```

### 2. 文件存储 → LSP Worker（文档同步）

```
文件存储内容更改
          ↓
CodeEditor 组件（通过 useEffect 监视 fileUri/fileContent）
          ↓
LSP 客户端方法（updateDocument、openDocument 等）
          ↓
通过 postMessage 发送的 JSON-RPC 消息
          ↓
Web Worker LSP（sysmlLSPWorker.ts）
          ↓
文本文档同步
          ↓
Worker 中的文档已更新
```

### 3. LSP Worker 处理 → 结果 → 主线程

```
LSP Worker 接收请求
          ↓
语言处理（解析、验证等）
          ↓
生成响应（补全项、诊断信息等）
          ↓
通过 postMessage 的 JSON-RPC 响应
          ↓
主线程（CodeEditor.tsx）
          ↓
LSP 客户端 Promise 解决
          ↓
应用状态更新（通过回调）
          ↓
使用新数据重新渲染组件
```

### 4. LSP 结果 → 编辑器 UI 更新

```
接收 LSP 响应
          ↓
处理结果（转换为 Monaco 格式）
          ↓
编辑器更新：
          ↓
- 设置模型标记（诊断信息）
          ↓
- 更新补全提供者
          ↓
- 更新悬停信息
          ↓
- 更新装饰（语义标记等）
          ↓
UI 立即反映更改
```

## 详细流程示例

### 示例 1：输入触发验证

1. 用户在 Monaco 编辑器中输入字符
2. CodeEditor 通过 `model.onDidChangeContent` 检测内容更改
3. 调用 `onContentChange` prop → App.handleContentChange
4. App 调用 `fileStore.updateFileContent(uri, newContent)`
5. FileStore 更新内容，标记为脏，增量版本
6. CodeEditor 的 `useEffect`（监视 fileUri/fileContent）触发
7. 调用 `scheduleDiagnostics(fileUri)`（去抖动）
8. 去抖动延迟后，调用 `applyDiagnostics(uri, content, version)`
9. `applyDiagnostics` 通过 `client.updateDocument()` 发送更新到 LSP worker
10. LSP worker 接收 `textDocument/didChange` 通知
11. Worker 使用 Langium 解析器 + 语义验证验证文档
12. Worker 通过 `textDocument/diagnostic` 请求响应返回诊断信息
13. 主线程接收响应，转换为 Monaco 标记
14. 编辑器通过 `monaco.editor.setModelMarkers()` 更新
15. ProblemsPanel 通过诊断订阅更新
16. StatusBar 更新错误/警告计数

### 示例 2：触发补全

1. 用户在 Monaco 编辑器中输入触发字符（如 `.`）
2. Monaco 内置补全触发
3. CodeEditor 通过 `client.getCompletion()` 转发请求到 LSP 客户端
4. LSP 客户端通过 postMessage 发送 `textDocument/completion` 请求
5. LSP worker 在 `connection.onCompletion` 处理程序中接收请求
6. Worker 解析文档，确定补全上下文
7. Worker 生成补全项（从 AST、关键字等）
8. Worker 通过 JSON-RPC 响应返回补全列表
9. 主线程通过 LSP 客户端 promise 接收响应
10. CodeEditor 处理项，添加 textEdit 范围
11. Monaco 显示补全下拉框
12. 用户选择项，Monaco 应用 textEdit
13. 检测到内容更改，流程从步骤 2 重复

### 示例 3：悬停信息

1. 用户在 Monaco 编辑器中将光标移动到符号上
2. Monaco 触发悬停请求
3. CodeEditor 通过 `client.getHover()` 转发到 LSP 客户端
4. LSP 客户端发送 `textDocument/hover` 请求
5. LSP worker 在 `connection.onHover` 处理程序中接收请求
6. Worker 找到位置处的 AST 节点
7. Worker 从 AST 提取符号信息
8. Worker 构建悬停内容（签名、类型、文档）
9. Worker 通过 JSON-RPC 响应返回悬停对象
10. 主线程通过 LSP 客户端 promise 接收响应
11. CodeEditor 处理结果
12. Monaco 显示悬停工具提示

### 示例 4：打开新文件

1. 用户在侧边栏点击文件或使用新文件命令
2. 侧边栏/工具栏调用 `handleNewFile` 或文件选择处理程序
3. App 调用 `fileStore.createNewFile()` 或 `fileStore.openTab(uri)`
4. FileStore 创建新文件条目，添加到标签页，设为活动
5. App 组件使用新的 `activeFileUri` 重新渲染
6. CodeEditor 的 `useEffect`（监视 fileUri/fileContent）触发
7. CodeEditor 为文件 URI 创建/获取 Monaco 模型
8. 编辑器设置模型内容，恢复光标位置
9. CodeEditor 调用 `scheduleDiagnostics(fileUri)` 进行初始验证
10. 如示例 1 中继续进行诊断流程

## 跨线程通信详情

### 消息格式

主线程和 Worker 之间的所有通信使用 JSON-RPC 2.0：

**请求消息：**
```json
{
  "jsonrpc": "2.0",
  "id": <递增的整数>,
  "method": "<方法名>",
  "params": { <方法特定参数> }
}
```

**响应消息：**
```json
{
  "jsonrpc": "2.0",
  "id": <匹配的请求 id>,
  "result": { <方法特定结果> }
}
```

**错误响应：**
```json
{
  "jsonrpc": "2.0",
  "id": <匹配的请求 id>,
  "error": {
    "code": <错误代码>,
    "message": "<错误消息>",
    "data": <可选的附加数据>
  }
}
```

**通知**（不期望响应）：
```json
{
  "jsonrpc": "2.0",
  "method": "<方法名>",
  "params": { <方法特定参数> }
}
```

### 消息传输

- **主线程 → Worker**：`worker.postMessage(message)`
- **Worker → 主线程**：`self.postMessage(message)`（在 worker 中）
- **消息处理**：`worker.onmessage = (event) => { const message = event.data; ... }`

## 性能特性

### 延迟因素

1. **Web Worker 开销**：postMessage 序列化/反序列化（~0.1-0.5ms）
2. **语言处理**：解析和验证时间（取决于文件大小/复杂性）
3. **去抖动**：诊断更新延迟 300ms 以减少频率
4. **UI 更新**：Monaco 标记设置和渲染时间

### 优化策略

1. **选择性处理**：只重新验证更改的文档
2. **索引缓存**：维护符号索引以便快速跨文件查找
3. **去抖动请求**：减少昂贵操作的频率
4. **模型重用**：切换标签页时重用 Monaco 模型
5. **增量验证**：尽可能只验证更改的部分
6. **后台加载**：编辑器就绪后异步加载标准库

## 错误处理和降级

### LSP Worker 错误

1. **解析失败**：在 worker 中回退到基于正则表达的验证
2. **服务超时**：客户端超时并回退到本地验证
3. **Worker 崩溃**：主线程检测缺失响应，显示 LSP 不可用
4. **消息失败**：受保护的 postMessage 调用并带有错误处理

### 优雅降级

当 LSP worker 不可用时：
- 编辑器使用内置验证器进行基本语法检查
- 补全、悬停、导航功能禁用或受限
- 诊断信息仅显示基本验证结果
- UI 通过 StatusBar 指示 LSP 状态

## 数据流总结

SysMLv2 编辑器通过���下��式维护响应迅速的用户界面：

1. **卸载重负载**：语言处理在 Web Worker 中运行，保持 UI 线程空闲
2. **高效通信**：使用轻量级的 JSON-RPC over postMessage
3. **智能缓存**：重用编辑器模型并维护符号索引
4. **可预测更新**：去抖动和批处理减少不必要的处理
5. **清晰分离**：UI 关注点与语言处理关注点分离
6. **健壮的错误处理**：服务不可用时优雅降级

这种架构提供了现代 Web 应用的响应能力，同时具备桌面 IDE 的语言智能功能。