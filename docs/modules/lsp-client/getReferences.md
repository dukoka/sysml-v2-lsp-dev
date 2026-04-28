# SysmlLSPClient.getReferences()

## 函数签名
```typescript
async getReferences(position: { line: number; character: number }, includeDeclaration = false): Promise<Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }>>
```

## 位置
src/workers/lspClient.ts:212

## 参数
- `position`：{ line: number; character: number } - 文档中查找引用的 LSP 0 基位置
- `includeDeclaration`：boolean（默认：false）- 是否在结果中包含声明位置

## 返回值
- `Promise<Array<ReferenceLocation>>` - 使用引用位置数组解决，或在未找到引用或请求失败时返回空数组。

其中 ReferenceLocation 为：
```typescript
{
  uri: string,
  range: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  }
}
```

## 描述
从 LSP Worker 查找当前文档指定位置符号的所有引用。这实现了"查找所有引用"功能（通常为 Shift+F12）。

## 行为
1. 向 Worker 发送 `textDocument/references` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
   - context: { includeDeclaration: 提供的 includeDeclaration 标志 }
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 查找第 8 行第 5 个字符（0 基）符号的引用，包括声明
const references = await client.getReferences({ line: 8, character: 5 }, true);
if (references.length > 0) {
  console.log(`找到 ${references.length} 个引用：`);
  references.forEach((ref, index) => {
    console.log(`${index + 1}. ${ref.uri} 在第 ${ref.range.start.line + 1} 行`);
  });
} else {
  console.log('未找到引用');
}
```

## 相关函数
- `getDefinition()` - 获取符号的定义位置
- `getDocumentHighlights()` - 获取符号的高亮区域
- LSP Worker 的 `connection.onReferences` - 实现引用���析的位置
- 编辑器的"查找所有引用"命令（Shift+F12）