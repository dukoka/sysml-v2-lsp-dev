# connection.onRequest('textDocument/formatting')

## 函数签名
```typescript
connection.onRequest('textDocument/formatting', (params: { textDocument: { uri: string }; options?: { tabSize?: number; insertSpaces?: boolean } }): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const text = doc.getText();
  const parseResult = parseSysML(text);
  const root =
    parseResult.parserErrors.length === 0 &&
    parseResult.lexerErrors.length === 0 &&
    parseResult.value &&
    isNamespace(parseResult.value)
      ? parseResult.value
      : undefined;
  const formatted = formatSysmlv2Code(text, {
    tabSize: params.options?.tabSize ?? 2,
    insertSpaces: params.options?.insertSpaces ?? true
  }, root);
  return [{ range: { start: { line: 0, character: 0 }, end: doc.positionAt(text.length) }, newText: formatted }];
});
```

## 位置
src/workers/sysmlLSPWorker.ts:397

## 参数
- `params`：{ textDocument: { uri: string }; options?: { tabSize?: number; insertSpaces?: boolean } } - 包含以下内容的对象：
  - `textDocument.uri`：string - 要格式化的文档的 URI
  - `options.tabSize`：number（可选，默认：2）- 每个标签的空格数
  - `options.insertSpaces`：boolean（可选，默认：true）- 是否插入空格或制表符

## 返回值
- `TextEdit[]` - 包含表示格式化更改的单个文本编辑对象的数组，或如果未找到文档则返回空数组。

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
处理来自 LSP 客户端的 `textDocument/formatting` 请求。根据指定的格式化选项格式化整个文档。

## 行为
1. 使用提供的 URI 从文档集合中检索文档
2. 如果未找到文档，返回空数组
3. 获取文档的文本内容
4. 使用 `parseSysML()` 解析文本以检查是否有效并获取 AST 根
5. 如果文档是有效的 SysMLv2（没有解析器/词法分析器错误且根是 Namespace），将 AST 根传递给格式化程序以进行上下文感知格式化
6. 使用指定选项使用 `formatSysmlv2Code()` 格式化文本
7. 返回单个文本编辑，用格式化后的文本替换整个文档内容

## 使用示例
此函数由 LSP 连接在客户端发送 `textDocument/formatting` 请求时自动调用。应用程序代码不会直接调用它。

客户端调用示例：
```typescript
const edits = await client.formatDocument({ tabSize: 4, insertSpaces: true });
// 返回整个文档的格式化编辑
```

## 相关函数
- `formatSysmlv2Code()` - 执行实际格式化工作的格式化函数
- `parseSysML()` - 用于验证文档和获取 AST 的解析器
- LSP 客户端的 `formatDocument()` 方法 - 发送此请求
- `connection.onRequest('textDocument/rangeFormatting')` - 处理范围格式化
- `connection.onRequest('textDocument/onTypeFormatting')` - 处理输入时格式化