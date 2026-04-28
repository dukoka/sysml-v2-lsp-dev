# SysmlLSPClient.getG4Diagnostics()

## 函数签名
```typescript
async getG4Diagnostics(): Promise<any[]>
```

## 位置
src/workers/lspClient.ts:160

## 参数
无

## 返回值
- `Promise<any[]>` - 使用 G4 诊断对象数组解决，或在请求失败或没有可用的 G4 诊断时返回空数组。

## 描述
从 LSP Worker 获取当前文档的 G4 特定诊断信息。这是一个与主要诊断分开的诊断流，用于严格的 G4 验证模式。只有在 g4Validation 配置为 true 时才返回结果。

## 行为
1. 向 Worker 发送 `sysml/g4Diagnostics` 请求，包含当前文档 URI。
2. 等待 Worker 的响应。
3. 如果成功，如果结果是数组则返回结果，否则返回空数组。
4. 如果请求失败（例如，Worker 不可用、方法未实现或 G4 验证未启用），记录警告并返回空数组。

## 使用示例
```typescript
// 仅在 g4Validation 配置为 true 时有用
const g4Diagnostics = await client.getG4Diagnostics();
if (g4Diagnostics.length > 0) {
  console.log(`发现 ${g4Diagnostics.length} 个 G4 特定问题`);
  for (const diag of g4Diagnostics) {
    console.log(`G4 ${diag.severity}: ${diag.message}`);
  }
}
```

## 相关函数
- `getDiagnostics()` - 获取主要诊断（默认包含 SysMLv2 和 G4）
- LSP Worker 的 `connection.onRequest('sysml/g4Diagnostics')` - 生成 G4 诊断的位置
- 启用 G4 验证模式的配置