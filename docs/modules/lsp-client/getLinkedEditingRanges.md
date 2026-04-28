# SysmlLSPClient.getLinkedEditingRanges()

## 函数签名
```typescript
async getLinkedEditingRanges(position: { line: number; character: number }): Promise<{ ranges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }>; wordPattern?: string } | null>
```

## 位置
src/workers/lspClient.ts:416

## 参数
- `position`：{ line: number; character: number } - 请求链接编辑范围的文档 LSP 0 基位置

## 返回值
- `Promise<LinkedEditingRanges | null>` - 解析为：
  - 包含范围和可选单词模式的 LinkedEditingRanges 对象，或
  - 如果请求失败或没有可用的链接编辑范围则返回 null

其中 LinkedEditingRanges 为：
```typescript
{
  ranges: Array<{
    start: { line: number; character: number },
    end: { line: number; character: number }
  }>,
  wordPattern?: string  // 链接编辑中有效内容的正则表达式模式
}
```

## 描述
从 LSP Worker 获取当前文档中指定位置的符号的链接编辑范围。这实现了链接编辑功能，允许同时编辑同一符号的多个出现位置（例如，在编辑一个变量时重命名所有出现位置）。

## 行为
1. 向 Worker 发送 `textDocument/linkedEditingRange` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
2. 等待 Worker 的响应。
3. 如果成功，直接返回结果（应该是 LinkedEditingRanges 对象或 null）。
4. 如果请求失败，记录错误并返回 null。
5. 注意：代码中有一个 TODO 注释，表明需要调查 linkedEditingRange 结果的正确类型。

## 使用示例
```typescript
// 获取第 6 行第 10 列（0 基）符号的链接编辑范围 - 例如，在变量名上
const result = await client.getLinkedEditingRanges({ line: 6, character: 10 });
if (result) {
  console.log(`找到 ${result.ranges.length} 个链接编辑范围：`);
  result.ranges.forEach((range, index) => {
    console.log(`${index + 1}. 第 ${range.start.line + 1} 行到第 ${range.end.line + 1} 行`);
  });
  if (result.wordPattern) {
    console.log(`单词模式: ${result.wordPattern}`);
  }
} else {
  console.log('没有可用的链接编辑范围');
}

// 示例输出可能为：
// 找到 3 个链接编辑范围：
// 1. 第 6 行到第 6 行
// 2. 第 9 行到第 9 行
// 3. 第 12 行到第 12 行
// 单词模式: [a-zA-Z_][a-zA-Z0-9_]*  // 典型的标识符模式
```

## 相关函数
- `getRename()` - 获取符号的重命名编辑（更跨文件的重命名）
- LSP Worker 的 `connection.onRequest('textDocument/linkedEditingRange')` - 计算链接编辑范围的位置
- 编辑器的链接编辑功能（通常在多个光标位于相同符号上时触发）