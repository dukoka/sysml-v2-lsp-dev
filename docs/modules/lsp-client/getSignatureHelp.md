# SysmlLSPClient.getSignatureHelp()

## 函数签名
```typescript
async getSignatureHelp(position: { line: number; character: number }): Promise<{ signatures: Array<{ label: string; documentation?: string; parameters?: Array<{ label: string }> }>; activeSignature: number; activeParameter: number } | null>
```

## 位置
src/workers/lspClient.ts:274

## 参数
- `position`: { line: number; character: number } - 请求签名帮助的文档 LSP 0 基位置

## 返回值
- `Promise<SignatureHelp | null>` - 解析为 SignatureHelp 对象，或在请求失败或没有可用的签名帮助时返回 null。

其中 SignatureHelp 为：
```typescript
{
  signatures: Array<{
    label: string,
    documentation?: string,
    parameters?: Array<{ label: string }>
  }>,
  activeSignature: number,
  activeParameter: number
}
```

## 描述
从 LSP Worker 获取当前文档中指定位置函数调用的签名帮助。这实现了参数提示功能，显示当前函数签名并在您输入时高亮当前参数。

## 行为
1. 向 Worker 发送 `textDocument/signatureHelp` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
2. 等待 Worker 的响应。
3. 如果成功，直接返回结果（应该是 SignatureHelp 对象或 null）。
4. 如果请求失败，记录错误并返回 null。

## 使用示例
```typescript
// 在第 7 行第 15 列（0 基）获取签名帮助 - 例如，在函数调用内
const signatureHelp = await client.getSignatureHelp({ line: 7, character: 15 });
if (signatureHelp) {
  const activeSig = signatureHelp.signatures[signatureHelp.activeSignature];
  console.log(`活动签名: ${activeSig.label}`);
  if (activeSig.documentation) {
    console.log(`文档: ${activeSig.documentation}`);
  }
  const activeParam = activeSig.parameters?.[signatureHelp.activeParameter];
  if (activeParam) {
    console.log(`活动参数: ${activeParam.label}`);
  }
  // 示例输出可能为：
  //  活动签名: println(message: String, newline?: Boolean)
  //  文档: 向控制台打印消息
  //  活动参数: message
} else {
  console.log('没有可用的签名帮助');
}
```

## 相关函数
- `getCompletion()` - 在位置获取补全项目
- `getHover()` - 在位置获取悬停信息
- LSP Worker 的 `connection.onSignatureHelp` - 提供签名帮助的位置
- 编辑器的自动签名帮助触发（当输入函数调用时）