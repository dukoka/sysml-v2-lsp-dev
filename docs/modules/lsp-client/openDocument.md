# SysmlLSPClient.openDocument()

## 函数签名
```typescript
async openDocument(content: string): Promise<void>
```

## 位置
src/workers/lspClient.ts:91

## 参数
- `content`：string - 要打开的文档的完整文本内容

## 返回值
- `Promise<void>` - 当文档打开通知已发送到 Worker 时解决

## 描述
在 LSP Worker 中打开文档。发送 `textDocument/didOpen` 通知以通知 Worker 新文档。防止多次打开同一文档 URI。

## 行为
1. 检查文档 URI 是否已在 `openDocuments` 集合中；如果是，则立即返回。
2. 向 Worker 发送 `textDocument/didOpen` 通知，包含：
   - uri：文档 URI
   - languageId：'sysmlv2'
   - version：1（初始版本）
   - text：文档内容
3. 将文档 URI 添加到 `openDocuments` 集合以跟踪其打开状态

## 使用示例
```typescript
await client.openDocument(`
package VehicleExample {
  part def Vehicle {
    part engine: Engine;
    part wheels: Wheel[4];
  }
}
`);
// 文档现已打开，正在由 LSP Worker 处理
```

## 相关函数
- `updateDocument()` - 更新已打开文档的内容
- `closeDocument()` - 关闭文档
- `documentOpen` getter - 检查文档是否当前打开
- `setDocumentUri()` - 更改所服务的文档 URI