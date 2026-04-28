# connection.onRequest('textDocument/rangeFormatting')

## 函数签名
```typescript
connection.onRequest('textDocument/rangeFormatting', (params: { textDocument: { uri: string }; range: { start: { line: number; character: number }; end: { line: number; character: number } }; options?: { tabSize?: number; insertSpaces?: boolean } }): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const fullText = doc.getText();
  const startOffset = doc.offsetAt(params.range.start);
  const endOffset = doc.offsetAt(params.range.end);
  const rangeText = fullText.substring(startOffset, endOffset);
  // Range formatting uses brace-depth only (AST ranges refer to full document)
  const formatted = formatSysmlv2Code(rangeText, {
    tabSize: params.options?.tabSize ?? 2,
    insertSpaces: params.options?.insertSpaces ?? true
  });
  return [{ range: params.range, newText: formatted }];
});
```

## 位置
src/workers/sysmlLSPWorker.ts:416

## 参数
- `params`：{ textDocument: { uri: string }; range: { start: { line: number; character: number }; end: { line: number; character: number } }; options?: { tabSize?: number; insertSpaces?: boolean } } - 包含以下内容的对象：
  - `textDocument.uri`：string - 要格式化的文档的 URI
  - `range.start`：{ line: number; character: number } - 格式化范围的起始位置（0 基）
  - `range.end`：{ line: number; character: number } - 格式化范围的结束位置（0 基）
  - `options.tabSize`：number（可选，默认：2）- 每个标签的空格数
  - `options.insertSpaces`：boolean（可选，默认：true）- 是否插入空格或制表符

## 返回值
- `TextEdit[]` - 包含表示指定范围格式化更改的单个文本编辑对象的数组，或如果未找到文档则返回空数组。

其中 TextEdit 为：
```typescript
{
  range: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  },
  newText: string
}
```

## 描述
处理来自 LSP 客户端的 `textDocument/rangeFormatting` 请求。根据指定的格式化选项格式化文档的特定范围。

## 行为
1. 使用提供的 URI 从文档集合中检索文档
2. 如果未找到文档，返回空数组
3. 获取文档的完整文本内容
4. 计算范围在完整文本中的起始和结束偏移量
5. 提取指定范围内的文本
6. 使用指定选项使用 `formatSysmlv2Code()` 格式化范围文本（注：范围格式化仅使用大括号深度，不使用完整 AST 范围）
7. 返回单个文本编辑，用格式化后的文本替换指定范围

## 使用示例
此函数由 LSP 连接在客户端发送 `textDocument/rangeFormatting` 请求时自动调用。应用程序代码不会直接调用它。

客户端调用示例：
```typescript
const range = { start: { line: 5, character: 0 }, end: { line: 10, character: 0 } };
const edits = await client.formatDocumentRange(range, { tabSize: 4, insertSpaces: true });
// 返回第 5-10 行的格式化编辑
```

## 相关函数
- `formatSysmlv2Code()` - 执行实际格式化工作的格式化函数
- LSP 客户端的 `formatDocumentRange()` 方法 - 发送此请求
- `connection.onRequest('textDocument/formatting')` - 处理文档格式化
- `connection.onRequest('textDocument/onTypeFormatting')` - 处理输入时格式化