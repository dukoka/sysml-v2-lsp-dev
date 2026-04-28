# SysmlLSPClient.getFoldingRanges()

## 函数签名
```typescript
async getFoldingRanges(): Promise<Array<{ startLine: number; endLine?: number }>>
```

## 位置
src/workers/lspClient.ts:252

## 参数
无

## 返回值
- `Promise<Array<FoldingRange>>` - 使用折叠范围对象数组解决，或在请求失败时返回空数组。

其中 FoldingRange 为：
```typescript
{
  startLine: number,
  endLine?: number  // undefined 表示折叠到文档末尾
}
```

## 描述
从 LSP Worker 获取当前文档的折叠范围信息。这使编辑器中的代码折叠功能成为可能，允许用户折叠和展开代码部分。

## 行为
1. 向 Worker 发送 `textDocument/foldingRange` 请求，包含：
   - textDocument: { uri: this.documentUri }
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
const foldingRanges = await client.getFoldingRanges();
if (foldingRanges.length > 0) {
  console.log(`找到 ${foldingRanges.length} 个折叠范围：`);
  foldingRanges.forEach((range, index) => {
    const endLine = range.endLine !== undefined ? range.endLine : '<文档末尾>';
    console.log(`${index + 1}. 第 ${range.startLine + 1} 行到第 ${endLine} 行`);
  });
} else {
  console.log('未找到折叠范围');
}

// SysMLv2 文件的示例输出：
// 1. 第 2 到 15 行  (package VehicleExample)
// 2. 第 4 到 10 行  (part def Vehicle)
// 3. 第 12 到 14 行 (part def Engine)
```

## 相关函数
- 编辑器的代码折叠 UI（通常为边距中的 +/- 图标或键盘快捷键）
- LSP Worker 的 `connection.onFoldingRanges` - 计算折叠范围的位置
- 语义标记提供者 - 常与折叠一起使用以更好地理解代码结构