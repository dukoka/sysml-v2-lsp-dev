# connection.onRequest('sysml/debugIndexTypes')

## 函数签名
```typescript
connection.onRequest('sysml/debugIndexTypes', (): { count: number; uris: string[]; names: string[] } => {
  const names = getIndexTypeNames();
  const uris = Array.from(getIndex().keys());
  return { count: names.length, uris, names };
});
```

## 位置
src/workers/sysmlLSPWorker.ts:384

## 参数
无

## 返回值
- `{ count: number; uris: string[]; names: string[] }` - 包含以下内容的对象：
  - `count`：number - 索引的类型数量
  - `uris`：string[] - 索引文档的 URI 数组
  - `names`：string[] - 索引类型的名称数组

## 描述
处理来自 LSP 客户端的自定义 `sysml/debugIndexTypes` 请求。返回关于多文件索引当前状态的调试信息，包括索引类型数量、索引文档的 URI 和所有索引类型的名称。

## 行为
1. 调用 `getIndexTypeNames()` 从索引文件中获取所有类型名称的数组
2. 从索引映射中获取键（即文档 URI）并转换为数组
3. 返回包含以下内容的对象：
   - count：名称数组的长度
   - uris：索引中的文档 URI 数组
   - names：在索引文档中找到的所有类型名称数组

## 使用示例
此函数由 LSP 连接在客户端发送 `sysml/debugIndexTypes` 请求时自动调用。应用程序代码不会直接调用它。

客户端调用示例：
```typescript
const indexInfo = await client.getDebugIndexTypes();
console.log(`已索引 ${indexInfo.count} 个类型，来自 ${indexInfo.uris.length} 个文档`);
```

## 相关函数
- `getIndexTypeNames()` - 从所有索引文件中提取类型名称
- `getIndex()` - 获取当前索引映射（uri → IndexEntry）
- LSP 客户端的 `getDebugIndexTypes()` 方法 - 发送此请求