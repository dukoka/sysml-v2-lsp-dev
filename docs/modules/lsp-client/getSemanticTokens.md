# SysmlLSPClient.getSemanticTokens()

## 函数签名
```typescript
async getSemanticTokens(): Promise<number[]>
```

## 位置
src/workers/lspClient.ts:263

## 参数
无

## 返回值
- `Promise<number[]>` - 使用表示增量编码格式的语义标记数字数组解决，或在请求失败时返回空数组。

## 描述
从 LSP Worker 获取当前文档的语义标记数据。这实现了超越基本语法高亮的语义高亮，提供基于语义含义的着色（例如，区分类型、变量、函数等）。

返回的数组使用增量编码格式，每个标记由 5 个数字表示：
[deltaLine, deltaStart, length, tokenType, tokenModifiers]

## 行为
1. 向 Worker 发送 `textDocument/semanticTokens/full` 请求，包含：
   - textDocument: { uri: this.documentUri }
2. 等待 Worker 的响应。
3. 如果成功，返回结果的 `data` 数组，或在 data 未定义时返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
const semanticTokens = await client.getSemanticTokens();
// 处理增量编码的标记以应用语义高亮
// 这通常由编辑器/Monaco 集成处理
if (semanticTokens.length > 0) {
  console.log(`收到 ${semanticTokens.length / 5} 个语义标记`);
  // 在实践中，Monaco 编辑器会消耗这些标记进行高亮
} else {
  console.log('没有可用的语义标记');
}
```

## 相关函数
- 编辑器的语义标记提供者集成 - 应用这些标记进行高亮的位置
- LSP Worker 的 `connection.onRequest('textDocument/semanticTokens/full')` - 生成语义标记的位置
- Monarch 分词器 - 提供基本语法高亮，语义标记对其进行增强