# FileStore.getState()

## 函数签名
```typescript
getState(): FileStoreState
```

## 描述
返回当前文件存储状态的副本。状态使用浅拷贝以防止直接修改内部状态。

## 参数
- 无

## 返回值
- `FileStoreState` - 包含文件存储当前状态的对象：
  - `files: Map<string, VirtualFile>` - 文件 URI 到文件对象的 Map。
  - `openTabs: string[]` - 表示当前打开标签页的 URI 数组。
  - `activeFileUri: string | null` - 当前活动文件的 URI，如果没有活动文件则为 null。
  - `cursorPosition: CursorPosition` - 活动文件中的当前光标位置。
  - `diagnostics: Map<string, DiagnosticItem[]>` - 文件 URI 到诊断项数组的 Map。
  - `lspReady: boolean` - 指示 LSP 服务器是否就绪并已连接。

## 使用示例
```typescript
const state = fileStore.getState();
console.log(`打开的标签页: ${state.openTabs.length}`);
console.log(`活动文件: ${state.activeFileUri}`);
console.log(`LSP 就绪: ${state.lspReady}`);
```

## 相关函数
- [FileStore.subscribe](./FileStore-subscribe.md) - 订阅状态更改
- [FileStore.getActiveFile](./FileStore-getActiveFile.md) - 获取当前活动文件对象
- [FileStore.getDiagnostics](./FileStore-getDiagnostics.md) - 获取特定文件的诊断

## 实现说明
- 返回状态对象的浅拷贝（使用扩展运算符）以防止意外修改内部状态。
- `files` 和 `diagnostics` Map 不是深度拷贝的；它们的内容与内部状态共享。
- 此方法是同步的，不会触发任何通知。