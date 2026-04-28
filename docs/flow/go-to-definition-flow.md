# 跳转到定义流程

本文档详细描述了从用户在 Monaco 编辑器中触发跳转到定义到导航到符号定义的执行流程。

## 概述

当用户触发跳转到定义时（通过 F12 键、Ctrl+点击符号或上下文菜单），会执行以下序列：

1. Monaco 编辑器检测跳转到定义请求
2. LSP 客户端发送定义请求到 Worker
3. Worker 解析文档并查找光标位置处的符号
4. Worker 通过符号索引解析符号定义
5. 定义位置返回给客户端
6. 客户端处理位置并更新 Monaco 编辑器
7. Monaco 编辑器导航到定义位置

## 详细步骤

### 1. Monaco 编辑器检测跳转到定义请求

- 用户按下 F12 键，或 Ctrl+点击符号，或从上下文菜单选择"跳转到定义"
- Monaco 编辑器触发跳转到定义请求
- 请求包含当前文档 URI 和光标位置

### 2. LSP 客户端 getDefinition 调用

- LSP 客户端（在 `src/lsp/client.ts` 中）调用 `getDefinition` 方法
- 向 LSP Worker 发送 `textDocument/definition` 请求
- 包含文档 URI 和光标位置

### 3. Worker textDocument/definition 请求处理器

- LSP Worker（在 `src/lsp/worker/definition.ts` 中）接收请求
- 提取文档 URI 和位置信息
- 加载文档（如需要）

### 4. 符号查找

- Worker 使用 Langium AST 查找光标位置处的符号
- 确定符号的类型和引用
- 遍历 AST 节点树找到目标符号

### 5. 符号索引解析

- Worker 使用预构建的符号索引解析定义位置
- 符号索引维护符号名称到定义位置的映射
- 找到定义的文件和位置

### 6. 位置返回给客户端

- Worker 发送 `textDocument/definition` 响应
- 响应包含一个或多个位置（Location 对象）
- Location 对象包含 URI、范围信息

### 7. 客户端处理定义位置

- LSP 客户端接收定义位置响应
- 准备编辑器的导航参数
- 将位置信息传递给 Monaco 编辑器

### 8. Monaco 编辑器导航到定义

- Monaco 编辑器接收导航请求
- 创建或激活目标文件的模型
- 将光标移动到定义位置
- 滚动编辑器视图以使定义可见

## 序列图

有关此流程的可视化表示，请参阅 [执行流程图](../execution-flows/execution-flow-diagrams.md)。

## 相关组件

- `src/lsp/client.ts`：LSP 客户端实现
- `src/lsp/worker/definition.ts`：跳转到定义请求处理器
- `src/lsp/worker/langium-integration.ts`：Langium 解析器集成
- `src/lsp/worker/symbol-index.ts`：符号索引构建和查询
- `src/languages/sysmlv2/ast`：Langium AST 节点定义

## 注意事项

- 跳转到定义请求不被去抖动，因为它是用户显式触发的
- 符号索引在工作区加载时构建，并维护以提高性能
- 如果符号定义在同一文件中，则不加载新文档
- 如果找不到定义，编辑器显示"找不到定义"消息
- 多个定义位置时，Monaco 可以显示选择器