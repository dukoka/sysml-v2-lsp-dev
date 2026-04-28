# SysmlLSPClient.getRename()

## 函数签名
```typescript
async getRename(position: { line: number; character: number }, newName: string): Promise<{ changes: Record<string, Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number }; newText: string }>> } | null>
```

## 位置
src/workers/lspClient.ts:227

## 参数
- `position`：{ line: number; character: number } - 文档中要重命名的符号的 LSP 0 基位置
- `newName`：string - 重命名符号的新名称

## 返回值
- `Promise<RenameResult | null>` - 使用以下之一解决：
  - 包含要进行的更改的 RenameResult 对象，或
  - 如果请求失败或无法重命名则返回 null

其中 RenameResult 为：
```typescript
{
  changes: Record<string, Array<{
    range: {
      start: { line: number; character: number },
      end: { line: number; character: number }
    },
    newText: string
  }>>
}
```

## 描述
从 LSP Worker 获取当前文档指定位置符号的重命名编辑。这实现了"重命名符号"功能（通常为 F2）。

## 行为
1. 向 Worker 发送 `textDocument/rename` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
   - newName：提供的新名称
2. 等待 Worker 的响应。
3. 如果成功，直接返回结果（应该是 RenameResult 或 null）。
4. 如果请求失败，记录错误并返回 null。

## 使用示例
```typescript
// 将第 5 行第 10 个字符（0 基）的符号重命名为 "NewName"
const result = await client.getRename({ line: 5, character: 10 }, "NewName");
if (result) {
  // 将更改应用到文档
  console.log(`重命名影响 ${Object.keys(result.changes).length} 个文件`);
  for (const [uri, changes] of Object.entries(result.changes)) {
    console.log(`  ${uri}: ${changes.length} 个更改`);
    // 在实践中，您会将这些更改应用到编辑器/文档
  }
} else {
  console.log('重命名操作失败或不受支持');
}
```

## 相关函数
- `getDefinition()` - 获取符号的定义位置（重命名前常使用）
- `getReferences()` - 查找符号的所有引用（显示将受影响的内容）
- LSP Worker 的 `connection.onRenameRequest` - 实现重命名解析的位置
- 编辑器的"重命名符号"命令（F2）