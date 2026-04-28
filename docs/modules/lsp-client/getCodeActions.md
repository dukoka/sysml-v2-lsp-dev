# SysmlLSPClient.getCodeActions()

## 函数签名
```typescript
async getCodeActions(range: { start: { line: number; character: number }; end: { line: number; character: number } }, diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }>): Promise<Array<{ title: string; kind?: string; edit?: any; command?: any }>>
```

## 位置
src/workers/lspClient.ts:287

## 参数
- `range`: { start: { line: number; character: number }; end: { line: number; character: number } } - 要计算代码操作的文档范围
- `diagnostics`: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; message: string }> - 代码操作应该解决的诊断

## 返回值
- `Promise<Array<CodeAction>>` - 使用代码操作对象数组解决，或在请求失败或没有可用的代码操作时返回空数组。

其中 CodeAction 为：
```typescript
{
  title: string,
  kind?: string,
  edit?: any,
  command?: any
}
```

## 描述
从 LSP Worker 获取当前文档中指定范围的代码操作。代码操作是可以执行以修复问题或改进代码的操作（例如，快速修复、重构）。

## 行为
1. 向 Worker 发送 `textDocument/codeAction` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - range：提供的范围
   - context: { diagnostics: 提供的诊断数组 }
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
// 假设我们在第 3 行第 5 列到第 3 行第 9 列有一个未知关键字的诊断
const range = { start: { line: 3, character: 5 }, end: { line: 3, character: 9 } };
const diagnostics = [
  {
    range: { start: { line: 3, character: 5 }, end: { line: 3, character: 9 } },
    message: "未知关键字 'defk'。您是想输入 'def' 吗？"
  }
];

const codeActions = await client.getCodeActions(range, diagnostics);
if (codeActions.length > 0) {
  console.log(`找到 ${codeActions.length} 个代码操作：`);
  codeActions.forEach((action, index) => {
    console.log(`${index + 1}. ${action.title}`);
    // 在实践中，您会调用操作（例如，应用编辑或运行命令）
  });
} else {
  console.log('没有可用的代码操作');
}

// 示例输出可能为：
// 找到 1 个代码操作：
// 1. 改为 'def'
```

## 相关函数
- `getDiagnostics()` - 获取可传递给此函数的诊断
- LSP Worker 的 `connection.languages.codeActions.on` - 生成代码操作的位置
- 编辑器的代码操作 UI（通常是灯泡图标或键盘快捷键）