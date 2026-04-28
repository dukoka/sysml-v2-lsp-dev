# CodeEditor.switchFile (fileUri/fileContent 的 useEffect)

## 函数签名
```typescript
useEffect(() => {
  // 文件切换逻辑
}, [fileUri, fileContent, language, scheduleDiagnostics]);
```

## 描述
处理切换到不同文件或更新当前文件的内容。只要 fileUri、fileContent、language 或 scheduleDiagnostics 更改，此效果就会运行。

## 参数
- `fileUri: string | null` - 要显示的文件的 URI
- `fileContent: string` - 文件内容
- `language: string` - 语言 ID（默认为 SYSMLV2_LANGUAGE_ID）
- `scheduleDiagnostics: Function` - 调度诊断更新的函数

## 返回值
- 无（更新编辑器状态并设置内容更改监听器）

## 使用示例
```typescript
// 这是组件内部的 - 由 prop 更改触发
// <CodeEditor fileUri={newUri} fileContent={newContent} />
// 当 props 更改时效果自动运行
```

## 相关函数
- [CodeEditor.initializeEditor](#codeeditorinitializeeditor) - 初始设置
- [CodeEditor.scheduleDiagnostics](#codeeditorschedulediagnostics) - 诊断调度
- [CodeEditor.cleanup](#codeeditorcleanup) - 清理函数

## 实现说明
- 从 refs 获取当前编辑器实例和之前的 URI
- 如果没有编辑器或没有 fileUri，提前返回
- 更新 currentUriRef 以跟踪当前显示的文件
- 释放任何现有的内容更改监听器
- 获取或为 fileUri 创建 Monaco 编辑器模型：
  - 如果模型不存在，从 fileContent 和 language 创建它
  - 将其存储在 modelsRef Map 中
- 如果编辑器的当前模型不同，则设置它为新模型
- 如果 LSP 启用则更新 LSP 客户端的活动文档
- 在模型上设置内容更改监听器：
  - 当内容更改时，调用 onContentChange prop
  - 通过 scheduleDiagnostics 调度诊断更新
- 如果 URI 与之前不同，则调度初始诊断