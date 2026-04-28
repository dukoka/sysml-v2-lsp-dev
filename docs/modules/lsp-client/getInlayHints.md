# SysmlLSPClient.getInlayHints()

## 函数签名
```typescript
async getInlayHints(range: { start: { line: number; character: number }; end: { line: number; character: number } }): Promise<Array<{ position: { line: number; character: number }; label: string; kind?: number; paddingLeft?: boolean }>>
```

## 位置
src/workers/lspClient.ts:361

## 参数
- `range`：{ start: { line: number; character: number }; end: { line: number; character: number } } - 需要请求内联提示的文档范围

## 返回值
- `Promise<Array<InlayHint>>` - 使用内联提示对象数组解决，或在请求失败或没有可用的内联提示时返回空数组。

其中 InlayHint 为：
```typescript
{
  position: { line: number; character: number },
  label: string,
  kind?: number,
  paddingLeft?: boolean
}
```

## 描述
从 LSP Worker 获取当前文档中指定范围的内联提示。内联提示是显示有用信息的内联注释，如参数名、类型或其他上下文提示。

## 行为
1. 向 Worker 发送 `textDocument/inlayHint` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - range：提供的范围
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 获取整个文档的内联提示
const fullRange = {
  start: { line: 0, character: 0 },
  end: { line: Number.MAX_SAFE_INTEGER, character: 0 } // 或获取实际文档结尾
};
const hints = await client.getInlayHints(fullRange);
if (hints.length > 0) {
  console.log(`找到 ${hints.length} 个内联提示：`);
  hints.forEach((hint, index) => {
    console.log(`${index + 1}. 第 ${hint.position.line + 1} 行: ${hint.label}`);
  });
} else {
  console.log('没有可用的内联提示');
}

// 示例输出可能为：
// 找到 2 个内联提示：
// 1. 第 5 行: engine: Engine
// 2. 第 9 行: wheels: Wheel[4]
```

## 相关函数
- LSP Worker 的 `connection.languages.inlayHints.on` - 生成内联提示的位置
- 编辑器的内联提示渲染（通常在代码中显示内联提示）