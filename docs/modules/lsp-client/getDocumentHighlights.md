# SysmlLSPClient.getDocumentHighlights()

## 函数签名
```typescript
async getDocumentHighlights(position: { line: number; character: number }): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; kind?: number }>>
```

## 位置
src/workers/lspClient.ts:338

## 参数
- `position`：{ line: number; character: number } - 文档中请求文档高亮的 LSP 0 基位置

## 返回值
- `Promise<Array<DocumentHighlight>>` - 使用文档高亮对象数组解决，或在请求失败或未找到高亮时返回空数组。

其中 DocumentHighlight 为：
```typescript
{
  range: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  },
  kind?: number  // 1 = 写, 2 = 读, 3 = 读/写
}
```

## 描述
从 LSP Worker 获取当前文档中指定位置的符号的文档高亮范围。这使得在光标位于符号的某个出现位置时，可以高亮显示符号的所有出现位置。

## 行为
1. 向 Worker 发送 `textDocument/documentHighlight` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 获取第 8 行第 10 列（0 基）符号的高亮
const highlights = await client.getDocumentHighlights({ line: 8, character: 10 });
if (highlights.length > 0) {
  console.log(`找到 ${highlights.length} 个高亮范围：`);
  highlights.forEach((highlight, index) => {
    const kindText = highlight.kind === 1 ? '写' : 
                     highlight.kind === 2 ? '读' : 
                     highlight.kind === 3 ? '读/写' : '未知';
    console.log(`${index + 1}. 第 ${highlight.range.start.line + 1} 行 (${kindText})`);
  });
} else {
  console.log('未找到文档高亮');
}

// 示例输出可能为：
// 找到 3 个高亮范围：
// 1. 第 5 行 (读)
// 2. 第 8 行 (读/写)  <- 当前位置
// 3. 第 12 行 (读)
```

## 相关函数
- `getDefinition()` - 获取符号的定义位置
- `getReferences()` - 查找符号的所有引用
- LSP Worker 的 `connection.onDocumentHighlight` - 生成文档高亮的位置
- 编辑器的自动高亮触发（当光标在符号上时）