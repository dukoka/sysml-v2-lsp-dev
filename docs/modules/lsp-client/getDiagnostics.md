# SysmlLSPClient.getDiagnostics()

## 函数签名
```typescript
async getDiagnostics(): Promise<any[]>
```

## 位置
src/workers/lspClient.ts:147

## 参数
无

## 返回值
- `Promise<any[]>` - 使用诊断对象数组解决，或在请求失败时返回空数组。

## 描述
从 LSP Worker 获取当前文档的诊断信息。这包括语法和语义错误、警告以及其他语言特定的诊断。

## 行为
1. 向 Worker 发送 `textDocument/diagnostic` 请求，包含当前文档 URI。
2. 等待 Worker 的响应。
3. 如果成功，返回结果的 `items` 数组，或在 items 未定义时返回空数组。
4. 如果请求失败，记录错误并返回空数组。

## 使用示例
```typescript
const diagnostics = await client.getDiagnostics();
for (const diagnostic of diagnostics) {
  console.log(`${diagnostic.severity}: ${diagnostic.message} 在第 ${diagnostic.range.start.line + 1} 行`);
}
// 示例输出：
// Error: 未知关键字 'defk' 在第 3 行
// Warning: 未使用的部件 'engine' 在第 5 行
```

## 相关函数
- `getG4Diagnostics()` - 单独获取 G4 特定的诊断
- LSP Worker 的 `connection.languages.diagnostics.on` - 生成诊断的位置
- ProblemsPanel 组件 - 向用户显示诊断