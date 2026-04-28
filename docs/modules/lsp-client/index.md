# LSP 客户端 API

LSP 客户端是与语言服务器通信的接口，提供文档管理、代码补全、诊断等功能。

## 主要方法

### 初始化
- [constructor](./constructor.md) - 创建客户端实例
- [initialize](./initialize.md) - 初始化 LSP 连接
- [setDocumentUri](./setDocumentUri.md) - 设置文档 URI

### 文档操作
- [openDocument](./openDocument.md) - 打开文档
- [updateDocument](./updateDocument.md) - 更新文档内容
- [closeDocument](./closeDocument.md) - 关闭文档

### 代码补全
- [getCompletion](./getCompletion.md) - 获取代码补全建议
- [getHover](./getHover.md) - 获取悬停信息
- [getSignatureHelp](./getSignatureHelp.md) - 获取签名帮助

### 导航与引用
- [getDefinition](./getDefinition.md) - 跳转到定义
- [getReferences](./getReferences.md) - 查找引用
- [getTypeDefinition](./getTypeDefinition.md) - 跳转到类型定义

### 诊断与符号
- [getDiagnostics](./getDiagnostics.md) - 获取诊断信息
- [getDocumentSymbols](./getDocumentSymbols.md) - 获取文档符号
- [getWorkspaceSymbols](./getWorkspaceSymbols.md) - 获取工作区符号
- [getSemanticTokens](./getSemanticTokens.md) - 获取语义标记

### 代码操作
- [getRename](./getRename.md) - 重命名
- [getCodeActions](./getCodeActions.md) - 获取代码操作
- [formatDocument](./formatDocument.md) - 格式化文档