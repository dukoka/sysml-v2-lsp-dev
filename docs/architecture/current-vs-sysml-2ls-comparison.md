# 当前项目 vs sysml-2ls 详细对比与改进方向

本文档对比 **sysmlv2-lsp-demo1**（当前项目）与 **sensmetry/sysml-2ls**（参考项目）在架构、已实现功能与实现方式上的差异，并给出可落地的改进方向，便于按优先级迭代。

---

## 1. 项目定位与运行环境

| 维度 | 当前项目（sysmlv2-lsp-demo1） | 参考项目（sysml-2ls） |
|------|------------------------------|------------------------|
| **形态** | 纯前端 Web 应用（React + Vite） | VS Code 扩展 + 独立语言服务（Node/浏览器双入口） |
| **运行环境** | 仅浏览器 | 桌面：Node 子进程；Web：Worker 或扩展宿主 |
| **编辑器** | Monaco Editor（单页内嵌） | VS Code / Cursor（或 vscode.dev 内嵌 Monaco） |
| **语言服务载体** | 无独立进程；能力由 Monaco 原生 API 或未接线的 Worker 实现 | 独立 LSP 进程/Worker，通过 stdio 或 postMessage 与客户端通信 |

---

## 2. 架构对比

### 2.1 当前项目架构

```
┌─────────────────────────────────────────────────────────────────┐
│  浏览器单页（React）                                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  CodeEditor.tsx                                               │ │
│  │  · Monaco 实例 + getWorker(editor.worker) 仅给 Monaco 用     │ │
│  │  · 校验：createSysmlv2Validator() 直接调 validator.ts        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  languages/sysmlv2/index.ts                                   │ │
│  │  · 注册语言、Monarch 词法、语言配置                            │ │
│  │  · 所有“语言能力”通过 Monaco 原生 API 注册：                   │ │
│  │    completion / hover / definition / references / rename /   │ │
│  │    formatting / documentSymbols / folding / signatureHelp /  │ │
│  │    codeActions / selectionRange / rangeFormatting            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ tokenizer.ts │  │ completion.ts │  │ validator.ts │  symbols  │
│  │ (Monarch)    │  │ (上下文+关键词)│  │ (正则+规则)  │  .ts      │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                   │
│  workers/sysmlLSPWorker.ts + lspClient.ts  ← 存在但未接入编辑器   │
└─────────────────────────────────────────────────────────────────┘
```

特点：

- **无 LSP 协议层**：编辑器侧未使用 `vscode-languageclient`，也未把 Worker 当 LSP 服务器用。
- **语言能力与编辑器强耦合**：补全、悬停、跳转等全部走 Monaco 的 `registerXxxProvider`，在主线程、基于当前文档字符串与正则/简单解析完成。
- **校验双源**：仅使用 `validator.ts`（正则 + 关键字/括号/字符串等规则）；Worker 内有 `textDocument/diagnostic` 实现但未被调用。

### 2.2 参考项目（sysml-2ls）架构

```
┌─────────────────────┐         stdio / postMessage          ┌─────────────────────────────┐
│  VS Code / 客户端   │  ◄──────────────────────────────────►  │  syside-languageserver      │
│  · languageclient  │         LSP JSON-RPC                  │  · createConnection         │
└─────────────────────┘                                      │  · createSysMLServices     │
                                                             │  · startLanguageServer()   │
                                                             │  · Connection.listen()     │
                                                             └─────────────┬───────────────┘
                                                                           │
                                                             ┌─────────────▼───────────────┐
                                                             │  Langium + 自定义服务       │
                                                             │  · grammar → 解析器 + AST   │
                                                             │  · Scope/Name/Link/Validator│
                                                             │  · Completion/Hover/Format  │
                                                             │  · SemanticTokens/Commands  │
                                                             └─────────────────────────────┘
```

特点：

- **标准 LSP**：所有能力通过 Connection 的请求/通知暴露，客户端与语言服务解耦。
- **语法与语义分离**：`.langium` 语法 → 生成解析器与 AST；补全/诊断/悬停等基于 AST 与 scope，而不是纯正则。
- **多环境**：同一套服务，Node 用 stdio/管道/套接字，浏览器用 `BrowserMessageReader/Writer(self)`（Worker postMessage）。

---

## 3. 已实现功能对比

### 3.1 语法高亮（词法）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `tokenizer.ts`，Monaco Monarch | 关键字、类型、字符串、注释、运算符等；规则手写，覆盖常见 SysMLv2/KerML 形态。 |
| **参考** | Langium 从 grammar 生成 + `syntaxes/`（TextMate） | 与语法一致，支持语义高亮（SemanticTokens），可区分同名不同角色。 |

**差异**：当前为纯词法、基于关键字/模式；参考项目在词法之上还有语义阶段，高亮更精确。

---

### 3.2 自动补全（Completion）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `completion.ts` + `index.ts` 的 `registerCompletionItemProvider` | 根据行内上下文（关键词、括号深度等）判断；提供关键字、内置类型、片段（snippet）；可结合 `symbols.ts` 提供用户定义类型名。无 AST，不区分“类型所在命名空间/可见性”。 |
| **参考** | `CompletionProvider` + Langium Scope/引用解析 | 基于 AST 与 scope，可做“在成员列表里补全”“在类型位置补全类型”等；与规范语义一致。 |

**差异**：当前补全为启发式 + 静态列表；参考项目为语义驱动，可扩展为跨文件、导入感知等。

---

### 3.3 悬停（Hover）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `index.ts` 内 `registerHoverProvider` | 取当前单词，返回固定文案（如「SysMLv2 identifier」）。 |
| **参考** | `HoverProvider` + AST/元模型 | 可显示元素类型、文档、关系等，与规范一致。 |

**差异**：当前仅为“有悬停”；参考项目可做到“悬停即文档”。

---

### 3.4 诊断（Validation / Diagnostics）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `validator.ts`，在 `CodeEditor.tsx` 中 `createSysmlv2Validator()` + `setModelMarkers` | 关键字拼写（Levenshtein）、括号匹配、字符串/注释未闭合、标识符规则等；纯规则 + 正则，无 AST。 |
| **参考** | DocumentValidator + ValidationRegistry + SysML/KerML 校验器 | 基于 AST 的语义校验（类型、引用、约束等），符合规范。 |

**差异**：当前适合“快速语法级检查”；参考项目能做完整语义校验。

---

### 3.5 跳转定义（Go to Definition）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `index.ts` + `symbols.ts` 的 `registerDefinitionProvider` | 用 `parseSymbols()` 建符号表（定义/引用），按单词查定义位置；基于正则匹配 `xxx def Name` 等。 |
| **参考** | Langium Linker + References | 基于 AST 与解析后的引用，支持跨文件、导入。 |

**差异**：当前单文件、基于模式；参考项目可多文件、语义准确。

---

### 3.6 查找引用（Find References）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `symbols.ts` 的 `findReferences` + `registerReferenceProvider` | 同一套符号表，按名称找所有出现位置。 |
| **参考** | References 服务 + AST | 区分“定义”与“引用”，可跨文件。 |

**差异**：与跳转定义类似，当前为单文件 + 模式；参考为多文件 + 语义。

---

### 3.7 重命名（Rename）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `index.ts` 的 `registerRenameProvider` | 按当前单词全文正则替换同名标识符；`resolveRenameLocation` 用 `symbols` 做简单校验。 |
| **参考** | ExecuteCommandHandler 等 | 基于引用图，只改“同一语义实体”的引用，避免误改。 |

**差异**：当前可能误改无关同名；参考项目语义安全。

---

### 3.8 文档符号（Document Symbols / 大纲）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `index.ts` 的 `registerDocumentSymbolProvider` | 按行匹配 `part def`、`port def`、`package` 等关键词，生成扁平或简单层级。 |
| **参考** | 基于 AST 的文档符号 | 层级与嵌套符合语法结构。 |

**差异**：当前为关键词扫描；参考为 AST 结构。

---

### 3.9 折叠（Folding）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `index.ts` 的 `registerFoldingRangeProvider` | 大括号块 + 块注释 + 关键词块（part def / requirement 等）。 |
| **参考** | 可由 AST 或 LSP FoldingRange 提供 | 与语法结构一致。 |

**差异**：当前已可用；参考可更精确对应语法块。

---

### 3.10 格式化（Formatting）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `index.ts` 的 `formatSysmlv2Code` + `registerDocumentFormattingEditProvider` / `registerDocumentRangeFormattingEditProvider` | 按大括号深度算缩进，统一缩进与换行。 |
| **参考** | SysMLFormatter | 可结合 AST 做元素级格式化（如注释块、元素内缩进等）。 |

**差异**：当前为缩进/换行；参考可做更细的格式规则。

---

### 3.11 语义高亮（Semantic Tokens）

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | 无 | 仅 Monarch 词法高亮。 |
| **参考** | SemanticTokenProvider | 基于 AST 区分关键字、类型、成员、局部变量等，高亮更细。 |

**差异**：当前无；参考有完整语义高亮。

---

### 3.12 LSP 协议与 Worker

| 项目 | 实现方式 | 说明 |
|------|----------|------|
| **当前** | `sysmlLSPWorker.ts` + `lspClient.ts` | Worker 内手写 JSON-RPC switch，支持 initialize、didOpen/didChange/didClose、completion、hover、diagnostic；**未在 CodeEditor 或任何组件中接入**，相当于独立雏形。 |
| **参考** | vscode-languageserver + Connection.listen() | 标准 LSP，所有能力通过 Connection 注册；Browser 端用 BrowserMessageReader/Writer(self)。 |

**差异**：当前有 LSP 形态的 Worker，但未与 Monaco 或 UI 连接；参考项目整条链路打通且规范。

---

## 4. 功能有无总表

| 功能 | 当前项目 | 参考项目 |
|------|----------|----------|
| 语法高亮（词法） | ✅ Monarch | ✅ 生成 + 可选语义 |
| 自动补全 | ✅ 启发式+关键词 | ✅ 基于 scope/AST |
| 悬停 | ✅ 简单文案 | ✅ 基于 AST/文档 |
| 诊断 | ✅ 规则+正则 | ✅ 语义校验 |
| 跳转定义 | ✅ 单文件符号表 | ✅ 多文件+语义 |
| 查找引用 | ✅ 单文件 | ✅ 多文件+语义 |
| 重命名 | ✅ 全文同名替换 | ✅ 语义安全 |
| 文档符号/大纲 | ✅ 关键词扫描 | ✅ AST 结构 |
| 折叠 | ✅ 括号+关键词块 | ✅ 可 AST |
| 格式化 | ✅ 缩进/换行 | ✅ 元素级 |
| 语义高亮 | ❌ | ✅ |
| 签名帮助 | ✅ 占位实现 | ✅ 可基于参数 |
| 代码操作 | ✅ 空实现 | ✅ 可修复/重构 |
| 多文件/工作区 | ❌ | ✅ |
| 标准 LSP 接入 | ❌ 未接线 | ✅ |
| 解析器/AST | ❌ | ✅ Langium 生成 |

---

## 5. 技术栈与依赖对比

| 维度 | 当前项目 | 参考项目 |
|------|----------|----------|
| **运行时** | 仅浏览器 | Node + 浏览器双入口 |
| **编辑器** | Monaco（@monaco-editor/react） | VS Code 内置 / 或 Monaco |
| **LSP 库** | 无 | vscode-languageserver、vscode-languageserver/browser |
| **语法/解析** | 无（仅正则+Monarch） | Langium + .langium 语法 |
| **语言客户端** | 无 | syside-languageclient（VS Code 侧） |
| **包管理** | npm + Vite | pnpm workspace 多包 |

---

## 6. 改进方向（按优先级）

### 6.1 短期：统一校验与接通现有 Worker（可选）

- **问题**：校验只用了 `validator.ts`；Worker 里的 diagnostic 未使用。
- **建议**：
  - 方案 A：继续以 `validator.ts` 为主，把其逻辑整理成“规则列表”，便于与参考项目的校验思路对照。
  - 方案 B：在 CodeEditor 中接入 `lspClient`，用 Worker 的 `textDocument/diagnostic` 驱动 `setModelMarkers`，与现有校验二选一或并存（例如 LSP 负责简单规则，Monaco 负责 UI 展示）。
- **价值**：若选 B，可先跑通“编辑器 ↔ Worker LSP”一条线，为后续把更多能力迁到 LSP 打基础。

### 6.2 中期：在 Worker 内采用标准 LSP 协议

- **问题**：Worker 手写 JSON-RPC，与 Monaco 未对接，扩展成本高。
- **建议**：
  - 在 Worker 内引入 `vscode-languageserver/browser`：`BrowserMessageReader(self)`、`BrowserMessageWriter(self)`、`createConnection(reader, writer)`。
  - 实现或复用一套“服务对象”：在 Connection 上注册 `onRequest(CompletionRequest.type, ...)`、`onRequest(HoverRequest.type, ...)`、Diagnostic 等。
  - 主线程用 `vscode-languageclient` 的浏览器版（或自写轻量客户端）连接该 Worker，把 Monaco 的 Document 与 LSP 的 textDocument 同步（didOpen/didChange/didClose），再用 LSP 的补全/悬停/诊断结果驱动 Monaco。
- **价值**：协议统一、易扩展、可与参考项目的 Browser 端对照学习。

### 6.3 中期：引入轻量解析器与 AST

- **问题**：补全/跳转/引用/重命名/大纲都依赖正则与启发式，无法区分“同名不同元素”、难以做多文件与导入。
- **建议**：
  - 选项 1：引入 Langium，使用或移植 sysml-2ls 的 grammar，在 Worker 中跑解析 + 简单 scope，再基于 AST 实现补全/诊断/跳转等（与参考项目一致）。
  - 选项 2：自写一个小的递归下降/手写 parser，只覆盖当前最常用的子集（如 package、part def、port def、简单类型），产出简易 AST 与符号表，再逐步把 completion/hover/definition/references 从“正则”改为“AST”。
- **价值**：语义准确、可扩展多文件与规范校验。

### 6.4 中长期：语义高亮与格式化增强

- **当前**：无语义 token；格式化为缩进规则。
- **建议**：
  - 在已有 AST 或 LSP 上实现 SemanticTokens 提供方，Monaco 侧用 `DocumentSemanticTokensProvider` 或通过 LSP 的 semantic tokens 转成 Monaco 装饰。
  - 格式化：在 AST 上做遍历，按“元素/块”输出空白与换行，对齐参考项目的 Formatter 行为。
- **价值**：体验向参考项目靠齐，便于阅读与重构。

### 6.5 中长期：多文件与工作区

- **当前**：单文件、无项目/工作区概念。
- **建议**：
  - 增加“虚拟工作区”：多文档 URI、可选虚拟文件系统；在 Worker 内维护多文档索引与跨文件引用。
  - 若采用 Langium，可直接复用其 WorkspaceManager、IndexManager 等概念，实现跨文件跳转、引用、重命名。
- **价值**：与真实 SysML 使用场景一致，便于后续做“项目级”校验与导航。

---

## 7. 总结表：差异与改什么

| 维度 | 当前项目 | 参考项目 | 建议改进方向 |
|------|----------|----------|--------------|
| **架构** | Monaco 原生 API + 未接线 Worker | 标准 LSP + Langium | 先接通 Worker↔编辑器，再在 Worker 内用 Connection + 标准 LSP |
| **解析** | 无 AST，正则+Monarch | grammar → AST | 引入 Langium 或轻量 parser，补全/诊断/导航基于 AST |
| **校验** | validator.ts 规则 | AST + 语义校验器 | 保留规则作快速检查；中长期迁到 AST 校验 |
| **补全/悬停/跳转** | 启发式+符号表 | scope + AST | 用 AST/scope 驱动，并考虑多文件 |
| **LSP 使用** | Worker 存在但未用 | 全能力走 LSP | 主线程用 LSP 客户端，Worker 用 vscode-languageserver/browser |
| **多文件** | 无 | 有 | 虚拟工作区 + 多文档索引 |

按上述顺序迭代：先“接通 LSP + 统一校验”，再“解析器/AST”，最后“语义高亮、格式化、多文件”，可以在保持当前技术栈（React + Monaco、纯浏览器）的前提下，逐步对齐参考项目的能力与架构，便于后续维护与扩展。
