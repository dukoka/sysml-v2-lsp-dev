# SysmlLSPClient.setDocumentUri()

## 函数签名
```typescript
setDocumentUri(uri: string): void
```

## 位置
src/workers/lspClient.ts:87

## 参数
- `uri`：string - 要服务的新文档 URI

## 返回值
无 (void)

## 描述
更改 LSP 客户端正在服务的文档 URI。这会更新内部的 documentUri 属性，但不会自动关闭之前的文档或打开新文档。

## 行为
1. 将内部的 `documentUri` 属性更新为新 URI 值
2. 不会自动关闭之前的文档或打开新文档
3. 调用者应在更改 URI 时适当管理文档生命周期

## 使用示例
```typescript
// 最初服务 main.model
client.setDocumentUri('sysmlv2://main.model');

// 稍后切换到服务不同文档
client.setDocumentUri('sysmlv2://components.engine');

// 记得在需要时关闭旧文档并打开新文档
await client.closeDocument();
await client.openDocument(newContent);
```

## 相关函数
- `openDocument()` - 在 LSP Worker 中打开文档
- `closeDocument()` - 关闭当前文档
- `updateDocument()` - 更新文档内容
- `documentOpen` getter - 检查文档是否当前打开