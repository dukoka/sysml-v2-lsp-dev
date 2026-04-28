# connection.onRequest('sysml/g4Diagnostics')

## 函数签名
```typescript
connection.onRequest('sysml/g4Diagnostics', (params: { textDocument: { uri: string } }): Diagnostic[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const items = runG4Parse(doc.getText());
  return items.map(d => ({ range: d.range, message: d.message, severity: (d.severity ?? DiagnosticSeverity.Error) as DiagnosticSeverity, source: 'G4' }));
});
```

## 位置
src/workers/sysmlLSPWorker.ts:390

## 参数
- `params`：{ textDocument: { uri: string } } - 包含文本文档 URI 的对象

## 返回值
- `Diagnostic[]` - 诊断对象数组，表示在文档中发现的 G4 特定错误

## 描述
处理来自 LSP 客户端的自定义 `sysml/g4Diagnostics` 请求。返回在文档上运行 G4 解析器产生的诊断，提供与主要 SysMLv2 验证分开的严格 G4 验证。

## 行为
1. 使用提供的 URI 从文档集合中检索文档
2. 如果未找到文档，返回空数组
3. 获取文档的文本内容
4. 使用 `runG4Parse()` 对文本运行 G4 解析器
5. 将每个 G4 解析结果项映射到 Diagnostic 对象：
   - range：来自解析结果
   - message：来自解析结果
   - severity：来自解析结果（默认为 Error），转换为 DiagnosticSeverity
   - source：设置为 'G4' 以指示诊断来源
6. 返回 Diagnostic 对象数组

## 使用示例
此函数由 LSP 连接在客户端发送 `sysml/g4Diagnostics` 请求时自动调用。应用程序代码不会直接调用它。

客户端调用示例：
```typescript
const g4Diagnostics = await client.getG4Diagnostics();
// 返回用于严格验证的 G4 特定诊断
```

## 相关函数
- `runG4Parse()` - 生成原始结果的 G4 解析器函数
- LSP 客户端的 `getG4Diagnostics()` 方法 - 发送此请求
- `validateDocument()` - 主要验证函数，默认包含 SysMLv2 和 G4 诊断