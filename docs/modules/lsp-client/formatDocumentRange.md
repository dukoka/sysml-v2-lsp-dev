# SysmlLSPClient.formatDocumentRange()

## 函数签名
```typescript
async formatDocumentRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }, options?: { tabSize?: number; insertSpaces?: boolean }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>>
```

## 位置
src/workers/lspClient.ts:389

## 参数
- `range`：{ start: { line: number; character: number }; end: { line: number; character: number } } - 要格式化的文档范围
- `options`：可选的格式化选项：
  - `tabSize`：number（默认：2）- 每个标签的空格数
  - `insertSpaces`：boolean（默认：true）- 是否插入空格或制表符

## 返回值
- `Promise<Array<TextEdit>>` - 使用文本编辑对象数组解决，或在请求失败或不需要格式化更改时返回空数组。

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
根据 LSP Worker 提供的指定格式化选项格式化当前文档的特定范围。这实现了范围格式化功能（通常用于格式化选中文本）。

## 行为
1. 向 Worker 发送 `textDocument/rangeFormatting` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - range：提供的范围
   - options: { tabSize: options?.tabSize ?? 2, insertSpaces: options?.insertSpaces ?? true }
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 使用默认选项格式化第 5 到 10 行（0 基）
const range = { start: { line: 5, character: 0 }, end: { line: 10, character: 0 } };
const edits = await client.formatDocumentRange(range);
if (edits.length > 0) {
  console.log(`范围格式化需要 ${edits.length} 个更改`);
  // 在实践中，您会将这些编辑应用到您的编辑器/文档
} else {
  console.log('范围已经格式化');
}

// 使用自定义选项的示例：
// 标签大小为 4 并插入空格
const edits = await client.formatDocumentRange(range, { tabSize: 4, insertSpaces: true });
```

## 相关函数
- `formatDocument()` - 格式化整个文档
- `getOnTypeFormatting()` - 获取输入时的格式化
- LSP Worker 的 `connection.onRequest('textDocument/rangeFormatting')` - 实现范围格式化的位置
- 编辑器的格式化选择命令（通常在选中文本时可用）