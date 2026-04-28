# SysmlLSPClient.getDefinition()

## 函数签名
```typescript
async getDefinition(position: { line: number; character: number }): Promise<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } } | { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }[] | null>
```

## 位置
src/workers/lspClient.ts:199

## 参数
- `position`：{ line: number; character: number } - 文档中请求定义的 LSP 0 基位置

## 返回值
- `Promise<Location | Location[] | null>` - 使用以下之一解决：
  - 单个 Location 对象（uri 和 range）
  - Location 对象数组（用于多个定义）
  - 如果未找到定义或请求失败则返回 null

其中 Location 为：
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
从 LSP Worker 获取当前文档指定位置符号的定义位置。这实现了"跳转到定义"功能（通常为 F12 或 Ctrl+点击）。

## 行为
1. 向 Worker 发送 `textDocument/definition` 请求，包含：
   - textDocument: { uri: this.documentUri }
   - position：提供的位置
2. 等待 Worker 的响应。
3. 如果成功，直接返回结果（应该是 Location、Location[] 或 null/undefined）。
4. 如果请求失败，记录错误并返回 null。

## 使用示例
```typescript
// 在第 10 行第 15 个字符（0 基）获取定义
const definition = await client.getDefinition({ line: 10, character: 15 });
if (definition) {
  if (Array.isArray(definition)) {
    // 找到多个定义
    console.log(`找到 ${definition.length} 个定义：`);
    definition.forEach((loc, index) => {
      console.log(`${index + 1}. ${loc.uri} 在第 ${loc.range.start.line + 1} 行`);
    });
  } else {
    // 找到单个定义
    console.log(`定义在 ${definition.uri} 第 ${definition.range.start.line + 1} 行`);
  }
} else {
  console.log('未找到定义');
}
```

## 相关函数
- `getReferences()` - 查找符号的所有引用
- `getTypeDefinition()` - 获取符号的类型定义
- LSP Worker 的 `connection.onDefinition` - 实现定义解析的位置
- 编辑器的"跳转到定义"命令（F12 或 Ctrl+点击）