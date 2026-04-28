# SysmlLSPClient.closeDocument()

## 函数签名
```typescript
async closeDocument(): Promise<void>
```

## 位置
src/workers/lspClient.ts:138

## 参数
无

## 返回值
- `Promise<void>` - 当文档关闭通知已发送到 Worker 时解决

## 描述
关闭 LSP Worker 中当前打开的文档。发送 `textDocument/didClose` 通知以通知 Worker 文档不再打开。仅在文档当前打开时才发送通知。

## 行为
1. 检查文档 URI 是否在 `openDocuments` 集合中；如果不是，则立即返回。
2. 向 Worker 发送 `textDocument/didClose` 通知，包含：
   - uri：文档 URI
3. 从 `openDocuments` 集合中移除文档 URI 以跟踪其关闭状态

## 使用示例
```typescript
// 打开文档
await client.openDocument("some content");

// 稍后，当不再需要时关闭它
await client.closeDocument();
// 文档现已关闭，将不再接收 LSP 更新
```

## 相关函数
- `openDocument()` - 在 LSP Worker 中打开文档
- `updateDocument()` - 更新已打开文档的内容
- `setDocumentUri()` - 更改所服务的文档 URI
- `documentOpen` getter - 检查文档是否当前打开