# FileStore.setActiveFile()

## 函数签名
```typescript
setActiveFile(uri: string): void
```

## 描述
将活动文件设置为指定的 URI。如果文件不在打开的标签页列表中，则会添加。与 `openTab` 不同，此函数确保文件在设置为活动之前在打开的标签页列表中。

## 参数
- `uri: string` - 要设置为活动的文件 URI

## 返回值
- `void`

## 使用示例
```typescript
// 假设我们有一个来自 addFile 的文件 URI
const uri = fileStore.addFile("Vehicle.sysml", "package Vehicle {\n  \n}");
// 将此文件设置为活动文件
fileStore.setActiveFile(uri);
// 现在文件在 openTabs 中（如果之前不在）并且是活动文件。
```

## 相关函数
- [FileStore.openTab](./FileStore-openTab.md) - 在标签页中打开文件
- [FileStore.closeTab](./FileStore-closeTab.md) - 关闭标签页
- [FileStore.getActiveFile](./FileStore-getActiveFile.md) - 获取当前活动文件
- [FileStore.addFile](./FileStore-addFile.md) - 向存储添加新文件

## 实现说明
- 如果 URI 不在 `openTabs` 数组中，则会添加它。
- `activeFileUri` 被设置为给定的 URI。
- 调用此方法会通过 `notify()` 方法通知所有订阅者。
- 此函数不加载文件内容；它只更新标签页和活动文件状态。
- 文件必须已存在于存储中（通过 `addFile`）才能正确工作。
- 如果文件不存在于存储中，该方法不执行任何操作。