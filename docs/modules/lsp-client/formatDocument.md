# SysmlLSPClient.formatDocument()

## 函数签名
```typescript
async formatDocument(options?: { tabSize?: number; insertSpaces?: boolean }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>>
```

## 位置
src/workers/lspClient.ts:301

## 参数
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
根据 LSP Worker 提供的指定格式化选项格式化整个当前文档。这实现了文档格式化功能（通常是 Shift+Alt+F 或类似快捷键）。

## 行为
1. 向 Worker 发送 `textDocument/formatting` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - options: { tabSize: options?.tabSize ?? 2, insertSpaces: options?.insertSpaces ?? true }
2. 等待 Worker 的响应。
3. 如果成功，返回结果（应该是 TextEdit 对象数组），如果结果未定义则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 使用默认选项（2 个空格，插入空格）格式化整个文档
const edits = await client.formatDocument();
if (edits.length > 0) {
  console.log(`文档格式化需要 ${edits.length} 个更改`);
  // 在实践中，您会将这些编辑应用到您的编辑器/文档
} else {
  console.log('文档已经格式化');
}

// 使用自定义选项的示例：
// 每个标签 4 个空格并插入空格
const edits = await client.formatDocument({ tabSize: 4, insertSpaces: true });
```

## 相关函数
- `formatDocumentRange()` - 格式化文档的特定范围
- `getOnTypeFormatting()` - 获取输入时的格式化（如输入分号或大括号）
- LSP Worker 的 `connection.onRequest('textDocument/formatting')` - 实现文档格式化的位置
- 编辑器的格式化文档命令（通常是 Shift+Alt+F）