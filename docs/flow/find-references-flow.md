# 查找引用流程

本文档详细描述了从用户在 Monaco 编辑器中触发查找引用到显示符号所有引用的执行流程。

## 概述

当用户触发查找引用时（通过 Shift+F12 或上下文菜单），会执行以下序列：

1. Monaco 编辑器检测查找引用请求
2. LSP 客户端发送引用请求到 Worker
3. Worker 解析文档并查找光标位置处的符号
4. Worker 在所有工作区文档中搜索符号引用
5. 引用位置返回给客户端
6. 客户端处理位置并更新 Monaco 编辑器
7. Monaco 编辑器在 Peek 视图或侧边栏中显示引用

## 详细步骤

### 1. Monaco 编辑器检测查找引用请求

- 用户按下 Shift+F12 键，或从上下文菜单选择"查找所有引用"
- Monaco 编辑器触发查找引用请求
- 请求包含当前文档 URI 和光标位置

### 2. LSP 客户端 getReferences 调用

- LSP 客户端（在 `src/lsp/client.ts` 中）调用 `getReferences` 方法
- 向 LSP Worker 发送 `textDocument/references` 请求
- 包含文档 URI 和光标位置

### 3. Worker textDocument/references 请求处理器

- LSP Worker（在 `src/lsp/worker/references.ts` 中）接收请求
- 提取文档 URI 和位置信息
- 加载所有工作区文档

### 4. 符号查找

- Worker 使用 Langium AST 查找光标位置处的符号
- 确定符号的定义位置
- 获取符号名称

### 5. 引用搜索

- Worker 在所有加载的文档中搜索符号引用
- 使用符号索引进行快速查找
- 也进行文本搜索作为后备
- 收集所有匹配的位置

### 6. 引用位置返回给客户端

- Worker 发送 `textDocument/references` 响应
- 响应包含引用位置数组（Location 对象）
- 每个 Location 包含 URI 和范围信息

### 7. 客户端处理引用位置

- LSP 客户端接收引用位置响应
- 按文件对位置进行分组
- 准备编辑器显示参数
- 通过 Peek 视图或侧边栏更新

### 8. Monaco 编辑器显示引用

- Monaco 编辑器接收引用显示请求
- 使用 Peek 界面显示所有引用
- 或者在侧边栏中显示引用列表
- 用户可以点击导航到特定引用

## 序列图

有关此流程的可视化表示，请参阅 [执行流程图](../execution-flows/execution-flow-diagrams.md)。

## 相关组件

- `src/lsp/client.ts`：LSP 客户端实现
- `src/lsp/worker/references.ts`：查找引用请求处理器
- `src/lsp/worker/langium-integration.ts`：Langium 解析器集成
- `src/lsp/worker/symbol-index.ts`：符号索引构建和查询
- `src/languages/sysmlv2/ast`：Langium AST 节点定义

## 注意事项

- 查找引用搜索整个工作区，可能较慢
- 结果按文件分组以便于导航
- 符号索引用于快速查找，但文本搜索作为后备
- 如果符号在多个文件中定义，显示所有定义
- 用户可以快速跳转到任何引用位置