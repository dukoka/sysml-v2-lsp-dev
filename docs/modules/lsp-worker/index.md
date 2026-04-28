# LSP Worker API

LSP Worker 是运行在 Web Worker 中的语言服务器，处理来自客户端的请求。

## 主要功能

### 初始化
- [onInitialize](./onInitialize.md) - 初始化处理
- [validateDocument](./validateDocument.md) - 文档验证
- [extractUserDefinedTypes](./extractUserDefinedTypes.md) - 提取用户定义类型

### 请求处理
- [onRequestSysmlG4Diagnostics](./onRequestSysmlG4Diagnostics.md) - G4 诊断
- [onRequestSysmlDebugIndexTypes](./onRequestSysmlDebugIndexTypes.md) - 索引类型

### 格式化
- [onRequestTextDocumentFormatting](./onRequestTextDocumentFormatting.md) - 格式化
- [onRequestTextDocumentRangeFormatting](./onRequestTextDocumentRangeFormatting.md) - 范围格式化

### 辅助函数
- [findSimilarKeyword](./findSimilarKeyword.md) - 查找类似关键字
- [levenshteinDistance](./levenshteinDistance.md) - 编辑距离计算