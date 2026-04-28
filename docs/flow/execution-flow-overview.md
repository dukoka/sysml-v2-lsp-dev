---
description: 执行流程概览文档，介绍 SysML v2 语言服务器协议 (LSP) 实现中的执行流程。
---

# 执行流程概览

本文档概述了 SysML v2 语言服务器协议 (LSP) 实现中的执行流程。解释了用户在 Monaco 编辑器中的交互如何转换为各种 LSP 请求和响应，最终实现语法高亮、代码补全、诊断和导航等功能。

## 核心执行流程

系统实现了四个主要的执行流程：

1. **语法高亮流程**：用户输入 → 语法高亮更新
2. **补全流程**：用户输入 → 补全建议显示
3. **诊断流程**：用户输入 → 诊断生成和显示
4. **导航流程**：用户输入 → 跳转到定义和查找引用

每个流程都遵循类似的模式：
- Monaco 编辑器中的用户交互
- 事件处理和 LSP 客户端请求
- LSP Worker 处理
- 响应返回客户端
- 客户端更新 Monaco 编辑器

## 组件交互

这些流程中涉及的主要组件有：

- **Monaco 编辑器**：前端代码编辑器
- **LSP 客户端**：负责 Monaco 和 LSP Worker 之间通信
- **LSP Worker**：包含 Langium 解析器和语义逻辑
- **虚拟文件存储**：管理文件的内存表示

## 详细流程文档

有关每个流程的详细步骤文档，请参阅：
- [语法高亮流程](syntax-highlighting-flow.md)
- [补全流程](completion-flow.md)
- [诊断流程](diagnostic-flow.md)
- [跳转到定义流程](go-to-definition-flow.md)
- [查找引用流程](find-references-flow.md)

## 序列图

这些流程的可视化表示可以在 [执行流程图](execution-flow-diagrams.md) 文档中找到。