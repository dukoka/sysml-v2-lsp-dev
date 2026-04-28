# SysmlLSPClient 构造函数

## 函数签名
```typescript
constructor(options: LSPClientOptions)
```

## 位置
src/workers/lspClient.ts:25

## 参数
- `options`：LSPClientOptions 对象，包含：
  - `worker`：Worker - 运行 LSP 服务的 Web Worker 实例
  - `documentUri`：string - 所服务文档的 URI

## 描述
初始化一个新的 SysmlLSPClient 实例，通过 Web Worker 消息与 SysMLv2 LSP Worker 通信。设置消息处理以处理来自 Worker 的传入响应，并初始化内部状态跟踪，包括待处理请求、文档 URI 和初始化状态。

## 行为
1. 存储 worker 和 documentUri 引用
2. 设置 Worker 的 onmessage 处理程序以处理传入的 LSP 响应
3. 初始化内部数据结构：
   - `pendingRequests`：Map 用于跟踪未完成的请求及其解析器
   - `requestId`：计数器用于生成唯一请求 ID
   - `initialized`：标志用于跟踪 LSP 初始化状态
   - `openDocuments`：Set 用于跟踪哪些文档已被打开

## 使用示例
```typescript
const worker = new Worker(new URL('./sysmlLSPWorker.ts', import.meta.url));
const client = new SysmlLSPClient({
  worker,
  documentUri: 'sysmlv2://main.model'
});
```

## 相关函数
- `initialize()` - 初始化 LSP 连接
- `openDocument()` - 在 LSP Worker 中打开文档
- `setDocumentUri()` - 更改所服务的文档 URI