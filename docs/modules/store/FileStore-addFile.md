# FileStore.addFile()

## 函数签名
```typescript
addFile(name: string, content: string, language = 'sysmlv2'): string
```

## 描述
向文件存储添加新的虚拟文件。创建具有给定名称和内容的文件，分配 URI，并将保存的内容初始化为与当前内容匹配（表示干净状态）。文件被添加到内部 files Map，但不自动在任何标签页中打开。

## 参数
- `name: string` - 新文件的文件名（例如 "Vehicle.sysml"）
- `content: string` - 文件的初始内容
- `language: string = 'sysmlv2'` - 文件的语言标识符（默认为 'sysmlv2'）

## 返回值
- `string` - 新创建文件的 URI，格式为 `file:///sysmlv2/${name}`

## 使用示例
```typescript
// 添加一个新的 SysML 文件
const uri = fileStore.addFile("Vehicle.sysml", "package Vehicle {\n  \n}");
// 返回: "file:///sysmlv2/Vehicle.sysml"

// 添加自定义语言的文件
const txtUri = fileStore.addFile("notes.txt", "Some notes", "plaintext");
```

## 相关函数
- [FileStore.removeFile](./FileStore-removeFile.md) - 从存储中移除文件
- [FileStore.openTab](./FileStore-openTab.md) - 在标签页中打开文件
- [FileStore.getFile](./FileStore-getFile.md) - 通过 URI 检索文件
- [FileStore.updateFileContent](./FileStore-updateFileContent.md) - 更新文件内容

## 实现说明
- 文件的 `savedContent` 被初始化为与 `content` 匹配，使文件最初处于"干净"状态（不脏）
- 文件被添加到内部 `files` Map，但不添加到 `openTabs` 或设置为 `activeFileUri`
- 调用此方法会通过 `notify()` 方法通知所有订阅者
- 如果已存在具有相同 URI 的文件，它将被覆盖