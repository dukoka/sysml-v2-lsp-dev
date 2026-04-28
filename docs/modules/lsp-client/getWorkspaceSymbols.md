# SysmlLSPClient.getWorkspaceSymbols()

## 函数签名
```typescript
async getWorkspaceSymbols(query: string): Promise<Array<{ name: string; kind: number; location: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }; containerName?: string }>>
```

## 位置
src/workers/lspClient.ts:351

## 参数
- `query`：string - 用于过滤符号的查询字符串（例如符号名称或其部分）

## 返回值
- `Promise<Array<WorkspaceSymbol>>` - 使用工作区符号对象数组解决，或在请求失败或没有符号匹配查询时返回空数组。

其中 WorkspaceSymbol 为：
```typescript
{
  name: string,
  kind: number,
  location: {
    uri: string,
    range: {
      start: { line: number; character: number },
      end: { line: number; character: number }
    }
  },
  containerName?: string
}
```

## 描述
从 LSP Worker 获取与提供的查询匹配的工作区符号。这实现了工作区范围的符号搜索功能（通常为 Ctrl+T 或类似快捷键），允许用户在工作区的所有索引文档中查找符号。

## 行为
1. 向 Worker 发送 `workspace/symbol` 请求，包含：
   - query：提供的查询字符串
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 搜索名称中包含 "Vehicle" 的所有符号
const symbols = await client.getWorkspaceSymbols("Vehicle");
if (symbols.length > 0) {
  console.log(`找到 ${symbols.length} 个工作区符号：`);
  symbols.forEach((symbol, index) => {
    const container = symbol.containerName ? ` 在 ${symbol.containerName} 中` : '';
    console.log(`${index + 1}. ${symbol.name} (${symbol.kind})${container}`);
  });
} else {
  console.log('未找到匹配的工作区符号');
}

// 示例输出可能为：
// 找到 3 个工作区符号：
// 1. Vehicle (256)  <- kind 256 可能是 Class
// 2. VehicleEngine (256) 在 VehicleExample 中
// 3. Wheel (256) 在 VehicleExample 中
```

## 相关函数
- `getDocumentSymbols()` - 仅获取当前文档中的符号
- LSP Worker 的 `connection.onWorkspaceSymbol` - 实现工作区符号解析的位置
- 编辑器的工作区符号搜索 UI（通常为 Ctrl+T 或 Cmd+T）