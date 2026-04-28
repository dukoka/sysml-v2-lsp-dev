# FileStore.openTab()

## 函数签名
```typescript
openTab(uri: string): void
```

## 描述
通过将文件的 URI 添加到打开的标签页列表并将其设置为活动文件来在编辑器中打开文件。如果文件尚未在打开的标签页列表中，则会添加它。然后将活动文件设置为此 URI。

## 参数
- `uri: string` - 要打开的文件的 URI（由 `addFile` 或 `makeUri` 返回）

## 返回值
- `void`

## 使用示例
```typescript
// 假设我们有一个来自 addFile 的文件 URI
const uri = fileStore.addFile("Vehicle.sysml", "package Vehicle {\n  \n}");
// 在编辑器中打开文件
fileStore.openTab(uri);
// 现在文件在 openTabs 中并且是活动文件。
```

## 相关函数
- [FileStore.addFile](./FileStore-addFile.md) - 向存储添加新文件
- [FileStore.closeTab](./FileStore-closeTab.md) - 关闭标签页
- [FileStore.setActiveFile](./FileStore-setActiveFile.md) - 设置活动文件（类似但逻辑不同）
- [FileStore.getActiveFile](./FileStore-getActiveFile.md) - 获取当前活动文件

## 实现说明
- 如果 URI 不在 `openTabs` 数组中，则会添加它。
- `activeFileUri` 被设置为给定的 URI。
- 调用此方法会通过 `notify()` 方法通知所有订阅者。
- 此函数不加载文件内容；它只更新标签页状态。
- 文件必须已存在于存储中（通过 `addFile`）才能正确工作。