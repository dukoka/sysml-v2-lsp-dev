# SysmlLSPClient.getDocumentSymbols()

## 函数签名
```typescript
async getDocumentSymbols(): Promise<Array<{ name: string; detail?: string; kind: number; range: { start: { line: number; character: number }; end: { line: number; character: number } }; selectionRange?: { start: { line: number; character: number }; end: { line: number; character: number } }; children?: any[] }>>
```

## 位置
src/workers/lspClient.ts:241

## 参数
无

## 返回值
- `Promise<Array<DocumentSymbol>>` - 使用文档符号对象数组解决，或在请求失败时返回空数组。

其中 DocumentSymbol 为：
```typescript
{
  name: string,
  detail?: string,
  kind: number,
  range: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  },
  selectionRange?: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  },
  children?: DocumentSymbol[]
}
```

## 描述
从 LSP Worker 获取当前文档的文档符号（大纲）。这使编辑器中的大纲/查看符号功能成为可能，显示文件中符号的层级视图。

## 行为
1. 向 Worker 发送 `textDocument/documentSymbol` 请求，包含：
   - textDocument: { uri: this.documentUri }
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
const symbols = await client.getDocumentSymbols();
if (symbols.length > 0) {
  console.log(`找到 ${symbols.length} 个顶级符号：`);
  symbols.forEach((symbol, index) => {
    const indent = "  ".repeat(getDepth(symbol)); // 辅助函数计算深度
    console.log(`${indent}${index + 1}. ${symbol.name} (${symbol.kind})`);
    if (symbol.children) {
      printSymbols(symbol.children, getDepth(symbol) + 1); // 递归辅助函数
    }
  });
} else {
  console.log('文档中未找到符号');
}

// SysMLv2 文件的示例输出：
// 1. VehicleExample (package)
//   1.1 Vehicle (part def)
//       1.1.1 engine (part)
//       1.1.2 wheels (part)
//   1.2 Engine (part def)
//       1.2.1 horsepower (attribute)
//   1.3 FuelPort (port def)
//       1.3.1 fuelFlow (attribute)
```

## 相关函数
- `getWorkspaceSymbols()` - 获取整个工作区中的符号
- LSP Worker 的 `connection.onDocumentSymbol` - 实现文档符号提取的位置
- 编辑器的大纲/符号视图窗格