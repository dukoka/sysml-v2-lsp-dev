# SysmlLSPClient.getDebugIndexTypes()

## 函数签名
```typescript
async getDebugIndexTypes(): Promise<{ count: number; uris: string[]; names: string[] }>
```

## 位置
src/workers/lspClient.ts:120

## 参数
无

## 返回值
- `Promise<{ count: number; uris: string[]; names: string[] }>` - 解析为包含以下内容的对象：
  - `count`：number - 索引的类型数量
  - `uris`：string[] - 索引文档的 URI 数组
  - `names`：string[] - 索引类型名称数组
  如果请求失败，返回 `{ count: 0, uris: [], names: [] }`。

## 描述
从 LSP Worker 请求索引类型的调试信息。这是一个自定义 SysMLv2 LSP 扩展（不是标准 LSP 的一部分），用于调试索引机制。

## 行为
1. 向 Worker 发送 `sysml/debugIndexTypes` 请求，不带参数。
2. 等待 Worker 的响应。
3. 如果成功，返回包含 count、uris 和 names 的结果对象。
4. 如果请求失败（例如，Worker 不可用、方法未实现），记录错误并返回默认空结果。

## 使用示例
```typescript
const indexInfo = await client.getDebugIndexTypes();
console.log(`已索引 ${indexInfo.count} 个类型，来自 ${indexInfo.uris.length} 个文档`);
// 已索引 42 个类型，来自 5 个文档
```

## 相关函数
- `loadLibraryFile` - 加载库文件进行索引（也会触发索引）
- 所有其他依赖 Worker 索引的诊断和检查函数