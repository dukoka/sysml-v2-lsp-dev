# SysmlLSPClient.getTypeDefinition()

## 函数签名
```typescript
async getTypeDefinition(position: { line: number; character: number }): Promise<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } } | null>
```

## 位置
src/workers/lspClient.ts:314

## 参数
- `position`：{ line: number; character: number } - 请求类型定义的文档 LSP 0 基位置

## 返回值
- `Promise<TypeDefinitionLocation | null>` - 解析为：
  - 如果找到类型定义，则返回 TypeDefinitionLocation 对象（uri 和 range），或
  - 如果未找到类型定义或请求失败则返回 null

其中 TypeDefinitionLocation 为：
```typescript
{
  uri: string,
  range: {
    start: { line: number; character: number },
    end: { line: number; character: number }
  }
}
```

## 描述
从 LSP Worker 获取当前文档中指定位置的符号的类型定义位置。这实现了"转到类型定义"功能，导航到符号类型的定义（例如，对于变量，导航到该变量的类型）。

## 行为
1. 向 Worker 发送 `textDocument/typeDefinition` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
2. 等待 Worker 的响应。
3. 如果成功，直接返回结果（应该是 TypeDefinitionLocation 或 null）。
4. 如果请求失败，记录错误并返回 null。

## 使用示例
```typescript
// 假设我们有一个变量声明：`part engine: Engine;` 我们想要 `engine` 的类型定义
// 在第 5 行第 15 列（0 基）获取类型定义 - 在单词 'Engine' 上
const typeDef = await client.getTypeDefinition({ line: 5, character: 15 });
if (typeDef) {
  console.log(`在 ${typeDef.uri} 第 ${typeDef.range.start.line + 1} 行找到类型定义`);
  // 示例输出：
  //  在 sysmlv2://stdlib/Parts.model 第 10 行找到类型定义
} else {
  console.log('未找到类型定义');
}
```

## 相关函数
- `getDefinition()` - 获取符号的定义位置（符号声明的位置）
- `getReferences()` - 查找符号的所有引用
- LSP Worker 的 `connection.onRequest('textDocument/typeDefinition')` - 实现类型定义解析的位置
- 编辑器的"转到类型定义"命令（通常是 Ctrl+Shift+F12 或类似）