# SysmlLSPClient.updateDocument()

## 函数签名
```typescript
async updateDocument(content: string, version: number): Promise<void>
```

## 位置
src/workers/lspClient.ts:105

## 参数
- `content`：string - 文档的新完整文本内容
- `version`：number - 文档的版本号（必须单调递增）

## 返回值
- `Promise<void>` - 当文档更新通知已发送到 Worker 时解决

## 描述
更新 LSP Worker 中已打开文档的内容。如果文档当前未打开，它将首先自动打开文档（版本为 1），然后更新。

## 行为
1. 检查文档 URI 是否当前打开（在 `openDocuments` 集合中）。
2. 如果未打开：
   - 调用 `openDocument(content)` 打开文档（内部将版本设置为 1）
   - 打开后返回（注意：在这种情况下忽略 version 参数，因为 openDocument 使用版本 1）
3. 如果已打开：
   - 向 Worker 发送 `textDocument/didChange` 通知，包含：
     - uri：文档 URI
     - version：提供的版本号
     - contentChanges：包含单个更改的数组，其中包含新的完整文本内容
4. 不自动更新 `openDocuments` 集合的版本（该集合仅跟踪打开/关闭状态）。

## 使用示例
```typescript
// 首先，打开文档（版本 1）
await client.openDocument("初始内容");

// 然后，将文档更新到版本 2
await client.updateDocument("更新内容", 2);

// 进一步更新到版本 3
await client.updateDocument("更多更新内容", 3);
```

## 相关函数
- `openDocument()` - 打开文档（第一次使用 updateDocument 前必须调用，否则 updateDocument 会自动打开）
- `closeDocument()` - 关闭文档
- `setDocumentUri()` - 更改所服务的文档 URI
- `documentOpen` getter - 检查文档是否当前打开