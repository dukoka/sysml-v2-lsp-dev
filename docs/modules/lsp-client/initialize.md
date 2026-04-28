# SysmlLSPClient.initialize()

## 函数签名
```typescript
async initialize(): Promise<any>
```

## 位置
src/workers/lspClient.ts:72

## 参数
无

## 返回值
- `Promise<any>` - 使用 LSP 初始化请求的结果解决，或在请求失败时拒绝。

## 描述
初始化与 Worker 的 LSP 连接。向 LSP Worker 发送 `initialize` 请求，然后发送 `initialized` 通知。此方法确保初始化只发生一次。

## 行为
1. 检查客户端是否已初始化；如果是，则立即返回。
2. 使用标准 LSP 初始化参数（processId、rootUri、capabilities、workspaceFolders 设置为 null）向 Worker 发送 `initialize` 请求。
3. 等待 Worker 的响应。
4. 向 Worker 发送 `initialized` 通知。
5. 将 `initialized` 标志设置为 true。
6. 返回初始化请求的结果。

## 使用示例
```typescript
await client.initialize();
// LSP 连接现已初始化，可以发送请求
```

## 相关函数
- `constructor` - 创建 LSP 客户端实例
- `openDocument()` - 在初始化后打开文档
- 所有其他请求方法都需要先调用初始化