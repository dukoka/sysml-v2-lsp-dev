# SysmlLSPClient.getCompletion()

## 函数签名
```typescript
async getCompletion(position: { line: number; character: number }): Promise<any[]>
```

## 位置
src/workers/lspClient.ts:172

## 参数
- `position`：{ line: number; character: number } - 文档中请求补全的 LSP 0 基位置

## 返回值
- `Promise<any[]>` - 使用补全项数组解决，或在请求失败时返回空数组。

## 描述
从 LSP Worker 获取当前文档指定位置的补全项。基于当前光标位置，提供关键字、类型、符号和代码片段的上下文感知建议。

## 行为
1. 向 Worker 发送 `textDocument/completion` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回 result.items 或空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 在第 5 行第 10 个字符（0 基）获取补全
const completions = await client.getCompletion({ line: 5, character: 10 });
for (const completion of completions) {
  console.log(`${completion.label}: ${completion.detail}`);
}
// 示例输出：
// def: 定义关键字
// part: 部件定义关键字
// requirement: 需求定义关键字
```

## 相关函数
- `getHover()` - 获取位置处的悬停信息
- `getSignatureHelp()` - 获取函数调用的签名帮助
- LSP Worker 的 `connection.onCompletion` - 生成补全的位置
- 编辑器的自动补全触发（Ctrl+空格、.、:、() 触发）