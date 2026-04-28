# SysmlLSPClient.getSelectionRanges()

## 函数签名
```typescript
async getSelectionRanges(positions: Array<{ line: number; character: number }>): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; parent?: any }>>
```

## 位置
src/workers/lspClient.ts:403

## 参数
- `positions`：Array<{ line: number; character: number }> - 需要请求选择范围的文档位置

## 返回值
- `Promise<Array<SelectionRange>>` - 使用选择范围对象数组解决，或在请求失败时返回空数组。

其中 SelectionRange 为：
```typescript
{
  range: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  },
  parent?: SelectionRange  // 分层父范围
}
```

## 描述
从 LSP Worker 获取当前文档中指定位置的选择范围。这实现了"智能选择"功能，将选择扩展到语义上有意义的块。

## 行为
1. 向 Worker 发送 `textDocument/selectionRange` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - positions：提供的位置数组
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 获取两个位置的选择范围
const positions = [
  { line: 5, character: 10 },  // 在部件名称内
  { line: 8, character: 5 }    // 在端口名称内
];
const ranges = await client.getSelectionRanges(positions);
if (ranges.length > 0) {
  console.log(`找到 ${ranges.length} 个选择范围：`);
  ranges.forEach((range, index) => {
    const pos = positions[index];
    console.log(`${index + 1}. 位置 [${pos.line + 1},${pos.character + 1}]: ` +
                `[${range.range.start.line + 1},${range.range.start.character + 1}] 到 ` +
                `[${range.range.end.line + 1},${range.range.end.character + 1}]`);
    if (range.parent) {
      console.log(`   父级: [${range.parent.range.start.line + 1},${range.parent.range.start.character + 1}] 到 ` +
                  `[${range.parent.range.end.line + 1},${range.parent.range.end.character + 1}]`);
    }
  });
} else {
  console.log('未找到选择范围');
}

// 示例输出可能为：
// 找到 2 个选择范围：
// 1. 位置 [6,11]: [6,6] 到 [6,15]  // 选择 "engine"
//    父级: [6,2] 到 [6,18]            // 选择 "part engine: Engine"
// 2. 位置 [9,6]: [9,6] 到 [9,12]   // 选择 "wheels"
//    父级: [9,2] 到 [9,16]            // 选择 "part wheels: Wheel[4]"
```

## 相关函数
- LSP Worker 的 `connection.onRequest('textDocument/selectionRange')` - 计算选择范围的位置
- 编辑器的智能选择功能（通常 Shift+Alt+Right/Left 箭头）