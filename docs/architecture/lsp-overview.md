# SysMLv2 LSP 语言服务器协议详解

本文档详细介绍 SysMLv2 编辑器中语言服务器协议 (LSP) 的实现原理、架构和使用方法。

---

## 1. LSP 简介

### 1.1 什么是 LSP

语言服务器协议 (LSP) 是微软定义的一种标准化协议，用于在编程工具和语言服务器之间进行通信。LSP 使得编辑器可以获得各种语言功能，如：

- **代码补全** - 输入时显示建议
- **诊断** - 实时显示错误和警告
- **跳转到定义** - 快速导航到定义位置
- **查找引用** - 查找符号的所有引用
- **悬停信息** - 鼠标悬停显示信息
- **重命名** - 安全地重命名符号
- **语义高亮** - 基于语法的着色

### 1.2 本项目的 LSP 实现

本项目的 SysMLv2 LSP 有以下特点：

- **运行在浏览器中**: 使用 Web Worker 而非后端服务
- **基于 Langium**: 使用 Langium 解析器进行 AST 分析
- **多文件索引**: 支持跨文件引用解析
- **实时诊断**: 输入即显示错误和警告

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React 前端                                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    Monaco 编辑器                       │   │
│  │    - 代码编辑                                            │   │
│  │    - 语法高亮                                            │   │
│  │    - 问题标记                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              LSP 客户端 (lspClient.ts)                  │   │
│  │    - 负责与 Worker 通信                                  │   │
│  │    - 发送请求/接收响应                                   │   │
│  │    - 管理文档生命周期                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ postMessage/onmessage
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Web Worker (sysmlLSPWorker.ts)                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Langium 解析器                          │ │
│  │    - parseSysML(): 解析文本生成 AST                        │ │
│  │    - 语法分析                                            │ │
│  │    - 语义分析                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    LSP 处理器                            │ │
│  │    - onCompletion: 补全                                  │ │
│  │    - onHover: 悬停                                       │ │
│  │    - onDefinition: 跳转定义                             │ │
│  │    - onReferences: 引用                                │ │
│  │    - onDiagnostics: 诊断                               │ │
│  │    - 等等...                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  索引管理器 (indexManager.ts)         │ │
│  │    - 多文件符号索引                                      │ │
│  │    - 跨文件引用解析                                     │ │
│  │    - 工作区符号搜索                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件说明

| 组件 | 文件 | 职责 |
|------|------|------|
| LSP 客户端 | `src/workers/lspClient.ts` | 与 Worker 通信，管理文档 |
| LSP Worker | `src/workers/sysmlLSPWorker.ts` | 处理 LSP 请求，提供语言功能 |
| 索引管理器 | `src/workers/indexManager.ts` | 多文件索引，跨文件引用 |
| 标准库加载器 | `src/workers/stdlibLoader.ts` | 加载标准库文件 |
| Langium 解析器 | `src/grammar/parser.ts` | 解析文本生成 AST |
| 补全逻辑 | `src/languages/sysmlv2/completion.ts` | 生成补全建议 |
| 引用解析 | `src/languages/sysmlv2/references.ts` | 引用解析逻辑 |
| 验证器 | `src/languages/sysmlv2/validator.ts` | 诊断生成 |

---

## 3. LSP 消息流程

### 3.1 初始化流程

```typescript
// 1. 创建 Worker
const worker = new Worker(new URL('./sysmlLSPWorker.ts', import.meta.url));

// 2. 创建 LSP 客户端
const client = new SysmlLSPClient({
  worker,
  documentUri: 'sysmlv2://main.model'
});

// 3. 初始化连接
await client.initialize();

// 4. 打开文档
await client.openDocument(`package Vehicle { ... }`);
```

初始化时序图：
```
前端 → LSP客户端 → LSP Worker
   │              │
   │  initialize  │ ──→ Langium 初始化
   │              │ ──→ 注册所有处理器
   │◄─── 结果 ─────│
   │
   │  initialized │
   │ ──────────►│
```

### 3.2 文档更新流程

用户输入时，文档更新的完整流程：

```
Monaco 编辑器
      │
      ▼ onDidChangeContent
虚拟文件存储 (fileStore.ts)
      │
      ▼ updateDocument
LSP 客户端
      │
      ▼ textDocument/didChange 通知
LSP Worker
      │
      ▼ parseSysML() 重新解析
Langium 解析器
      │
      ▼ 生成/更新 AST
运行验证规则
      │
      ▼ 生成诊断
textDocument/publishDiagnostics 通知
      │
      ▼ setMarkers
Monaco 编辑器 (显示错误标记)
```

### 3.3 补全流程

补全请求的处理流程：

```
用户触发补全 (输入触发字符 或 Ctrl+Space)
      │
      ▼ getCompletion 请求
LSP 客户端
      │
      ▼ textDocument/completion 请求
LSP Worker
      │
      ▼ detectCompletionContext 分析上下文
      │   - 确定光标前的上下文类型
      │   - 确定需要哪种补全
      ▼ generateCompletionItems 生成补全项
      │   - 关键字 (part, port, attribute...)
      │   - 类型名 (Vehicle, Engine...)
      │   - 包名
      │   - 代码片段
      ▼ textDocument/completion 响应
LSP 客户端
      │
      ▼ 返回补全项
Monaco 编辑器 (显示补全建议)
```

### 3.4 跳转到定义流程

```
用户按 F12 或 Ctrl+点击符号
      │
      ▼ getDefinition 请求
LSP 客户端
      │
      ▼ textDocument/definition 请求
LSP Worker
      │
      ▼ 查找光标处的符号
      │   - 解析 AST 查找引用
      │   - 通过索引解析定义位置
      ▼ textDocument/definition 响应
      │   - 返回定义位置的 URI 和范围
      ▼ 导航到定义
Monaco 编辑器 (跳转到定义位置)
```

### 3.5 诊断流程

诊断的生成和显示：

```
用户输入 → Monaco
      │
      ▼ onDidChangeContent
      │
      ▼ updateDocument (去抖动)
      │
      ▼ textDocument/didChange
      │
      ▼ 验证文档
      │   ├─ Langium 解析 (语法错误)
      │   ├─ 语义验证 (未解析类型)
      │   └─ 自定义验证 (缺失分号等)
      │
      ▼ publishDiagnostics
      │
      ▼ setMarkers
      │
      ▼ Monaco 显示错误标记
          ├─ 红色波浪线 (错误)
          ├─ 黄色波浪线 (警告)
          └─ 问题面板
```

---

## 4. LSP 功能详解

### 4.1 补全 (Completion)

**触发方式**：
- 输入触发字符：`.`、`:`、`(`、`[`
- 手动触发：`Ctrl+Space` (Mac: `Cmd+Space`)

**补全类型**：

| 上下文 | 补全内容 | 示例 |
|--------|----------|------|
| 语句开头 | 关键字 | `part`, `port`, `attribute` |
| `.` 后 | 属性/端口名 | `engine`, `wheels` |
| `:` 后 | 类型名 | `Engine`, `Integer` |
| 包内 | 定义名 | `Vehicle`, `Engine` |

代码示例：

```typescript
// LSP Worker 中的补全逻辑
const keywords = ['part', 'port', 'attribute', 'action', 'state', 'flow'];
const types = ['Integer', 'Real', 'String', 'Boolean'];

// 根据上下文生成补全项
items.push(...keywords.map(k => ({
  label: k,
  kind: monaco.languages.CompletionItemKind.Keyword,
  detail: 'keyword'
})));
```

### 4.2 诊断 (Diagnostics)

**诊断来源**：

| 来源 | 说明 | 严重性 |
|------|------|--------|
| Langium 解析 | 语法错误 | Error |
| 语义验证 | 未解析类型、重复定义 | Warning/Error |
| 自定义验证 | 缺失分号、未知关键字 | Warning |
| G4 验证 | G4 语法错误 (可选) | Error |

**诊断展示**：

```typescript
// Monaco 标记格式
const markers = diagnostics.map(d => ({
  severity: d.severity === 'Error' 
    ? markersApi.MarkerSeverity.Error 
    : markersApi.MarkerSeverity.Warning,
  message: d.message,
  startLineNumber: d.range.start.line + 1,
  startColumn: d.range.start.character + 1,
  endLineNumber: d.range.end.line + 1,
  endColumn: d.range.end.character + 1,
}));

editor.setModelMarkers(model, 'lsp', markers);
```

### 4.3 跳转到定义 (Go to Definition)

**功能**：快速导航到符号的定义位置

**代码示例**：

```typescript
// LSP Worker 定义查询
const definition = await client.getDefinition({ line: 5, character: 10 });
if (definition) {
  // 导航到定义位置
  editor.revealPositionInCenter(definition.range.start);
}
```

### 4.4 查找引用 (Find References)

**功能**：查找符号的所有引用位置

**代码示例**：

```typescript
// 获取所有引用
const references = await client.getReferences({ line: 5, character: 10 });
// references 是一个位置数组
references.forEach(ref => {
  console.log(`在 ${ref.uri} 第 ${ref.range.start.line + 1} 行`);
});
```

### 4.5 悬停 (Hover)

**功能**：鼠标悬停显示信息

**代码示例**：

```typescript
// 获取悬停信息
const hover = await client.getHover({ line: 5, character: 10 });
if (hover) {
  // 显示悬停内容
  editor.trigger('mouse', 'editor.action.showHover', {
    range: hover.range,
    contents: hover.contents
  });
}
```

### 4.6 重命名 (Rename)

**功能**：安全重命名符号

**流程**：
1. 用户按 `F2`
2. 输入新名称
3. LSP 返回 WorkspaceEdit
4. 应用到所有文件

```typescript
// 重命名请求
const renameResult = await client.getRename(
  { line: 5, character: 10 }, 
  'NewName'
);
if (renameResult) {
  // 应用更改到工作区
  workspace.applyEdit(renameResult);
}
```

---

## 5. 索引管理器

### 5.1 什么是索引

索引管理器 (`indexManager.ts`) 维护一个符号表，支持跨文件引用解析。

### 5.2 索引数据结构

```typescript
interface IndexEntry {
  name: string;           // 符号名称
  type: 'part' | 'port' | 'attribute' | ...;
  uri: string;            // 所在文件 URI
  range: Range;          // 定义位置
  container?: string;    // 父容器名称
}
```

### 5.3 索引操作

```typescript
// 添加到索引
indexManager.add(uri, ast);

// 查找定义
const definition = indexManager.findDefinition(name, uri);

// 查找引用
const references = indexManager.findReferences(name);

// 工作区符号搜索
const symbols = indexManager.search('Vehicle');
```

### 5.4 多文件场景

当打开多个文件时：

```typescript
// 打开多个文档
await client.openDocument('sysmlv2://Vehicle.model', vehicleCode);
await client.openDocument('sysmlv2://Engine.model', engineCode);

// 索引自动更新
const refs = await client.getReferences({ line: 5, character: 10 });
// 返回所有文件中的引用
```

---

## 6. 消息协议

### 6.1 请求/响应模式

```typescript
// 请求格式
{
  jsonrpc: '2.0',
  id: 1,
  method: 'textDocument/completion',
  params: { textDocument: { uri: '...' }, position: { line: 5, character: 10 } }
}

// 响应格式
{
  jsonrpc: '2.0',
  id: 1,
  result: [{ label: 'part', kind: 14, detail: 'keyword' }]
}
```

### 6.2 通知模式 (单向)

```typescript
// 文档打开通知
{
  jsonrpc: '2.0',
  method: 'textDocument/didOpen',
  params: {
    textDocument: {
      uri: 'sysmlv2://main.model',
      languageId: 'sysmlv2',
      version: 1,
      text: 'package Vehicle { }'
    }
  }
}
```

---

## 7. 配置选项

### 7.1 LSP 配置

通过 `src/grammar/config.ts` 配置：

```typescript
interface GrammarConfig {
  grammarSource: 'langium' | 'g4';  // 解析器来源
  g4Validation: boolean;            // 是否启用 G4 验证
}

// 设置配置
setGrammarConfig({ g4Validation: true });
```

### 7.2 客户端配置

```typescript
interface LSPClientOptions {
  worker: Worker;          // Web Worker 实例
  documentUri: string;   // 初始文档 URI
}
```

---

## 8. 扩展 LSP 功能

### 8.1 添加新的 LSP 处理器

在 `sysmlLSPWorker.ts` 中添加：

```typescript
// 注册新处理器
connection.onRequest('custom/yourFeature', async (params) => {
  // 处理请求
  const result = await processYourFeature(params);
  return result;
});
```

### 8.2 添加新的诊断类型

```typescript
// 在验证器中添加新规则
function validateDocument(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // 现有验证...
  
  // 添加新验证规则
  lines.forEach((line, i) => {
    if (line.includes('TODO')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        message: '包含 TODO 注释',
        range: { start: { line: i, character: 0 }, end: { line: i, character: 4 } }
      });
    }
  });
  
  return diagnostics;
}
```

---

## 9. 调试技巧

### 9.1 查看索引内容

```typescript
// 获取调试信息
const indexInfo = await client.getDebugIndexTypes();
console.log(`已索引: ${indexInfo.count} 个类型`);
console.log('文件:', indexInfo.uris);
console.log('类型名:', indexInfo.names);
```

### 9.2 查看诊断

```typescript
// 获取诊断
const diagnostics = await client.getDiagnostics();
diagnostics.forEach(d => {
  console.log(`${d.severity}: ${d.message}`);
});
```

---

## 10. 常见问题

### 10.1 LSP 不工作

**症状**：补全、跳转等功能不工作

**排查**：
1. 检查浏览器控制台是否有 Worker 加载错误
2. 确认 `initialize()` 已调用
3. 确认文档已打开 (`openDocument`)

### 10.2 诊断不更新

**症状**：输入后诊断不显示

**排查**：
1. 诊断有 300ms 去抖动
2. 确认 `updateDocument` 已调用
3. 检查控制台是否有验证错误

### 10.3 跨文件引用不工作

**症状**：无法跳转到其他文件的定义

**排查**：
1. 确认所有文件都已打开
2. 检查索引中是否包含目标文件
3. 使用 `getDebugIndexTypes` 验证

---

## 11. API 参考

### 11.1 LSP 客户端方法

| 方法 | 说明 |
|------|------|
| `initialize()` | 初始化 LSP 连接 |
| `openDocument(content)` | 打开文档 |
| `closeDocument()` | 关闭文档 |
| `updateDocument(content, version)` | 更新文档内容 |
| `getCompletion(position)` | 获取补全 |
| `getHover(position)` | 获取悬停信息 |
| `getDefinition(position)` | 获取定义位置 |
| `getReferences(position)` | 获取引用列表 |
| `getRename(position, newName)` | 获取重命名编辑 |
| `getDiagnostics()` | 获取诊断 |
| `getDocumentSymbols()` | 获取文档符号 |
| `getWorkspaceSymbols(query)` | 获取工作区符号 |

### 11.2 LSP Worker 处理器

| 处理器 | 方法 |
|--------|------|
| `onInitialize` | 初始化处理 |
| `onCompletion` | 补全处理 |
| `onHover` | 悬停处理 |
| `onDefinition` | 定义查询 |
| `onReferences` | 引用查询 |
| `onRename` | 重命名处理 |
| `onDocumentSymbol` | 文档符号 |
| `onWorkspaceSymbol` | 工作区符号 |
| `onDiagnostics` | 诊断发布 |

---

## 12. 参考文档

- [LSP 规范](https://microsoft.github.io/language-server-protocol/)
- [Langium 文档](https://langium.dev)
- [Monaco 编辑器](https://microsoft.github.io/monaco-editor/)
- [VS Code 扩展文档](https://code.visualstudio.com/api)