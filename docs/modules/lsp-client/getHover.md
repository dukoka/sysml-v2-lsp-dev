# SysmlLSPClient.getHover()

## 函数签名
```typescript
async getHover(position: { line: number; character: number }): Promise<any>
```

## 位置
src/workers/lspClient.ts:186

## 参数
- `position`：{ line: number; character: number } - 文档中请求悬停信息的 LSP 0 基位置

## 返回值
- `Promise<any>` - 使用悬停内容解决（通常是包含 contents 和 range 的对象），或在请求失败时返回 null。

## 描述
从 LSP Worker 获取当前文档指定位置的悬停信息。当用户悬停在代码上时，显示符号、类型或文档的详细信息。

## 行为
1. 向 Worker 发送 `textDocument/hover` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
2. 等待 Worker 的响应。
3. 如果成功，返回 Worker 的结果。
4. 如果请求失败，记录错误并返回 null。

## 使用示例
```typescript
// 在第 3 行第 5 个字符（0 基）获取悬停信息
const hover = await client.getHover({ line: 3, character: 5 });
if (hover) {
  console.log('悬停内容：', hover.contents);
  // 示例输出可能是：
  // 悬停内容: { 
  //   kind: 'markdown',
  //   value: '定义一个新的部件。\n\n用法: part def PartName { ... }'
  // }
}
```

## 相关函数
- `getCompletion()` - 获取位置的补全项
- `getDefinition()` - 获取位置处的定义位置
- LSP Worker 的 `connection.onHover` - 生成悬停信息的位置
- 编辑器的自动悬停触发（鼠标悬停或键盘快捷键）