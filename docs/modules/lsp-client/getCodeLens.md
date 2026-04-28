# SysmlLSPClient.getCodeLens()

## 函数签名
```typescript
async getCodeLens(): Promise<Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; command?: { title: string; command: string; arguments?: unknown[] }>>
```

## 位置
src/workers/lspClient.ts:326

## 参数
无

## 返回值
- `Promise<Array<CodeLens>>` - 使用代码镜头对象数组解决，或在请求失败或没有可用的代码镜头时返回空数组。

其中 CodeLens 为：
```typescript
{
  range: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  },
  command?: {
    title: string,
    command: string,
    arguments?: unknown[]
  }
}
```

## 描述
从 LSP Worker 获取当前文档的代码镜头信息。代码镜头显示可点击执行命令的内联提示（如引用计数、测试状态等）。

## 行为
1. 向 Worker 发送 `textDocument/codeLens` 请求，包含：
   - textDocument: { uri: this.documentUri }
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
const codeLens = await client.getCodeLens();
if (codeLens.length > 0) {
  console.log(`找到 ${codeLens.length} 个代码镜头条目：`);
  codeLens.forEach((lens, index) => {
    console.log(`${index + 1}. [${lens.range.start.line + 1},${lens.range.start.character + 1}] ${lens.command?.title || '(无命令)'}`);
  });
} else {
  console.log('没有可用的代码镜头');
}

// 示例输出可能为：
// 找到 2 个代码镜头条目：
// 1. [5,10] 引用: 3
// 2. [12,5] 运行测试
```

## 相关函数
- LSP Worker 的 `connection.onCodeLens` - 生成代码镜头的位置
- 编辑器的代码镜头渲染（通常在代码上方/下方显示内联提示）