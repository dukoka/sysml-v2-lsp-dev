# SysmlLSPClient.loadLibraryFile()

## 函数签名
```typescript
loadLibraryFile(uri: string, content: string): void
```

## 位置
src/workers/lspClient.ts:129

## 参数
- `uri`：string - 要加载的库文件的 URI
- `content`：string - 库文件的完整文本内容

## 返回值
无 (void)

## 描述
加载具有任意 URI 的库文件，该文件不在 openDocuments 集中跟踪。这用于加载标准库文件或其他应该被索引但不应被视为编辑器中打开文档的依赖项。发送标准的 textDocument/didOpen 通知和自定义的 sysml/indexLibraryFile 通知以确保立即索引。

## 行为
1. 向 Worker 发送 `textDocument/didOpen` 通知，包含：
   - uri：提供的 URI
   - languageId：'sysmlv2'
   - version：1
   - text：文件内容
2. 还发送自定义的 `sysml/indexLibraryFile` 通知，包含：
   - uri：提供的 URI
   - content：文件内容
   此自定义通知确保立即索引，避免与标准 TextDocuments 同步的潜在时序问题。
3. 注意：与 openDocument 不同，此方法不在内部集合中跟踪 URI，因此可以多次加载同一个库文件。

## 使用示例
```typescript
// 加载标准库文件
client.loadLibraryFile(
  'sysmlv2://stdlib/Kernel.model',
  `package Kernel {
    def class Element { }
  }`
);
// 库文件现已索引，可用于引用解析
```

## 相关函数
- `openDocument()` - 打开在 openDocuments 中跟踪的常规文档
- `getDebugIndexTypes()` - 调试函数以检查已索引的内容
- 所有依赖索引库的引用解析函数（getDefinition、getReferences 等）