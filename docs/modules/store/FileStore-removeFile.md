# FileStore.removeFile()

## 函数签名
```typescript
removeFile(uri: string): void
```

## 描述
从文件存储中移除虚拟文件。同时从打开的标签页中移除文件，清除其诊断信息，如果移除的文件是活动文件，则将活动文件设置为第一个打开的标签页（如果有）或 null。

## 参数
- `uri: string` - 要移除的文件的 URI（由 `addFile` 或 `makeUri` 返回）

## 返回值
- `void`

## 使用示例
```typescript
// 假设我们有一个文件 URI
const uri = "file:///sysmlv2/Vehicle.sysml";
fileStore.removeFile(uri);
// 文件从存储、打开的标签页和诊断中移除。
// 如果它是活动文件，活动文件会更新。
```

## 相关函数
- [FileStore.addFile](./FileStore-addFile.md) - 向存储添加新文件
- [FileStore.openTab](./FileStore-openTab.md) - 在标签页中打开文件
- [FileStore.closeTab](./FileStore-closeTab.md) - 关闭标签页
- [FileStore.getFile](./FileStore-getFile.md) - 通过 URI 检索文件

## 实现说明
- 文件从内部 `files` Map 中移除。
- URI 从 `openTabs` 数组中移除。
- 文件的诊断信息从 `diagnostics` Map 中清除。
- 如果移除的文件是 `activeFileUri`，活动文件被设置为 `openTabs` 中的第一个标签页（如果有）或 null。
- 调用此方法会通过 `notify()` 方法通知所有订阅者。
- 如果 URI 不存在于存储中，该方法不执行任何操作（不抛出错误）。