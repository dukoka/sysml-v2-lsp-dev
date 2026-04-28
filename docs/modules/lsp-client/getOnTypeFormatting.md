# SysmlLSPClient.getOnTypeFormatting()

## 函数签名
```typescript
async getOnTypeFormatting(position: { line: number; character: number }, ch: string, options?: { tabSize?: number; insertSpaces?: boolean }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>>
```

## 位置
src/workers/lspClient.ts:374

## 参数
- `position`：{ line: number; character: number } - 输入字符的文档 LSP 0 基位置
- `ch`：string - 输入的字符（例如 '}'、';' 等）
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
从 LSP Worker 获取输入时格式化操作（如输入右大括号或分号）的格式化编辑。这使得在输入特定字符时能够自动格式化。

## 行为
1. 向 Worker 发送 `textDocument/onTypeFormatting` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
   - ch：提供的字符
   - options: { tabSize: options?.tabSize ?? 2, insertSpaces: options?.insertSpaces ?? true }
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 获取用户在第 10 行第 5 列（0 基）输入 '}' 时的格式化
const edits = await client.getOnTypeFormatting({ line: 10, character: 5 }, '}');
if (edits.length > 0) {
  console.log(`输入时格式化需要 ${edits.length} 个更改`);
  // 在实践中，您会将这些编辑应用到您的编辑器/文档
} else {
  console.log('不需要输入时格式化');
}

// 使用自定义选项的示例：
// 获取每个标签 4 个空格的格式化
const edits = await client.getOnTypeFormatting({ line: 10, character: 5 }, ';', { tabSize: 4 });
```

## 相关函数
- `formatDocument()` - 格式化整个文档
- `formatDocumentRange()` - 格式化文档的特定范围
- LSP Worker 的 `connection.onRequest('textDocument/onTypeFormatting')` - 实现输入时格式化的位置
- 编辑器的触发字符自动格式化（通常在语言设置中配置）