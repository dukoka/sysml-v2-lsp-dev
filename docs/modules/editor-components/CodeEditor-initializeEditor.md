# CodeEditor.initializeEditor (useEffect)

## 函数签名
```typescript
useEffect(() => {
  // 初始化逻辑
}, []); // 空依赖数组表示在挂载时运行一次
```

## 描述
初始化 Monaco 编辑器实例，设置语言注册、主题和 LSP 客户端连接。此效果在组件挂载时运行一次。

## 参数
- 无（使用闭包中的 props 和 refs）

## 返回值
- 清理函数：当组件卸载时释放资源的函数

## 使用示例
```typescript
// 这是组件内部的 - 不是直接调用
// <CodeEditor fileUri={uri} fileContent={content} />
// 初始化在挂载时自动发生
```

## 相关函数
- [CodeEditor.switchTheme](#codeeditorswitchtheme) - 处理主题更改
- [CodeEditor.switchFile](#codeeditorswitchfile) - 处理文件/内容更改
- [CodeEditor.cleanup](#codeeditorcleanup) - 效果返回的清理函数

## 实现���明
- 在容器 div 中创建 Monaco 编辑器实例
- 注册 SysMLv2 语言和主题
- 设置 Monaco 编辑器选项（字体大小、小地图、折叠等）
- 注册自定义命令（'sysml.goToFirstDefinition'、'sysml.showReferences'）
- 设置光标更改监听器
- 初始化 LSP Worker 和客户端：
  - 为 sysmlLSPWorker.ts 创建 Web Worker
  - 使用 createSysmlLSPClient 创建 LSP 客户端
  - 初始化 LSP 连接
  - 在后台加载标准库
- 返回清理函数：
  - 注销 LSP 客户端 getter
  - 清除诊断去抖动计时器
  - 关闭 LSP 客户端中所有打开的文档
  - 终止 LSP Worker
  - 释放所有 Monaco 模型
  - 释放 Monaco 编辑器实例